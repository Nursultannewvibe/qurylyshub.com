import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ActType } from "@prisma/client";
import { prisma } from "../db";
import { conflict, forbidden, notFound } from "../errors";
import { signatureProvider } from "../providers";
import { config } from "../config";
import { logActivity } from "../activity";
import { getDeal } from "./deals";
import { notify, notifyCompany } from "./notifications";
import { fmtKZT } from "@/lib/money";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * 10. Генерация акта. Платформа НЕ подписывает акт — только формирует документ; подписывают стороны (SignatureProvider-мок).
 */
export async function generateAct(dealId: string, milestoneId: string | null, type: ActType, actorId: string, extra: { supervisor_id?: string; conclusion?: string } = {}) {
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { seller: true, request: { include: { project: { include: { owner: true } }, category: true } }, items: true } });
  const milestone = milestoneId ? await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId }, include: { checklist_results: { include: { item: true } } } }) : null;
  const buyerName = deal.request.project.owner.name ?? deal.request.project.owner.phone;
  const title = type === "acceptance" ? "АКТ ПРИЁМКИ ВЫПОЛНЕННЫХ РАБОТ / ПОСТАВКИ" : type === "reconciliation" ? "АКТ СВЕРКИ ВЗАИМОРАСЧЁТОВ" : "ЗАКЛЮЧЕНИЕ ТЕХНИЧЕСКОГО НАДЗОРА";
  const rows = milestone ? milestone.checklist_results.map((r) => `<tr><td>${esc(r.item.item_text)}</td><td>${r.checked ? "✔" : "—"}</td><td>${r.photo_url ? (/^data:image|\.(png|jpe?g|webp)$/i.test(r.photo_url) ? `<img src="${esc(r.photo_url)}" style="max-height:110px;max-width:160px" alt="фото">` : `<a href="${esc(r.photo_url)}">фото</a>`) : r.item.photo_required ? "⚠ нет фото" : ""}</td></tr>`).join("") : "";
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px}.sig{margin-top:40px;display:flex;gap:40px}.sig div{flex:1;border-top:1px solid #333;padding-top:8px}.note{font-size:12px;color:#666;margin-top:32px}</style>
<h2>${esc(title)}</h2>
<p>г. ${esc(deal.request.project.city)}, ${new Date().toLocaleDateString("ru-RU")}</p>
<p><b>Заказчик:</b> ${esc(buyerName)}<br><b>Исполнитель:</b> ${esc(deal.seller.name)} (${deal.seller.legal_type === "individual_contractor" ? "физлицо-исполнитель" : "БИН " + esc(deal.seller.bin)})<br>
<b>Объект:</b> ${esc(deal.request.project.name)}, ${esc(deal.request.project.address ?? "")}<br>
<b>Категория работ:</b> ${esc(deal.request.category.name)}<br>
<b>Сделка:</b> ${deal.id} на сумму ${fmtKZT(deal.amount)}</p>
${milestone ? `<p><b>Этап:</b> ${esc(milestone.name)} — ${fmtKZT(milestone.amount)}${milestone.accepted_amount && !milestone.accepted_amount.eq(milestone.amount) ? ` (принято частично: ${fmtKZT(milestone.accepted_amount)})` : ""}</p>` : ""}
${rows ? `<h3>Чек-лист приёмки</h3><table><tr><th>Пункт</th><th>Отметка</th><th>Фото</th></tr>${rows}</table>` : ""}
${extra.conclusion ? `<h3>Заключение</h3><p>${esc(extra.conclusion)}</p>` : ""}
${type === "supervisor_conclusion" ? `<p class="note">Заключение выдано аттестованным специалистом технического надзора, действующим от своего имени.</p>` : ""}
<div class="sig"><div>Заказчик: ${esc(buyerName)}<br><small>подпись (ЭЦП)</small></div><div>Исполнитель: ${esc(deal.seller.name)}<br><small>подпись (ЭЦП)</small></div>${type === "supervisor_conclusion" ? "<div>Технадзор<br><small>подпись (ЭЦП)</small></div>" : ""}</div>
<p class="note">Документ сформирован платформой Qurylys Hub автоматически по данным сделки. Платформа является информационным посредником, не является стороной договора и не подписывает акт. Юридическую силу документу придают подписи сторон.</p></html>`;
  const hash = createHash("sha256").update(html).digest("hex");
  const dir = path.join(config.uploadDir, "acts");
  await mkdir(dir, { recursive: true });
  const act = await prisma.act.create({ data: { deal_id: dealId, milestone_id: milestoneId, act_type: type, content_html: html, content_hash: hash, supervisor_id: extra.supervisor_id ?? null, sign_deadline_at: new Date(Date.now() + config.actSignDeadlineDays * 86400000) } });
  // Файл — best-effort (на serverless-хостинге диск временный); источник истины — content_html в БД, отдаётся по /acts/<id>.
  await writeFile(path.join(dir, `${act.id}.html`), html, "utf8").catch(() => null);
  const saved = await prisma.act.update({ where: { id: act.id }, data: { file_url: `/acts/${act.id}` } });
  await logActivity({ actor_id: actorId, entity_type: "act", entity_id: act.id, action: "generated", meta: { type, hash } });
  await notify({ user_id: deal.buyer_id, type: "act.generated", payload: { act_id: act.id, deal_id: dealId } });
  await notifyCompany(deal.seller_id, { type: "act.generated", payload: { act_id: act.id, deal_id: dealId } });
  return saved;
}

/** Подпись стороны через SignatureProvider (мок ЭЦП). Обе подписи → signed. */
export async function signAct(userId: string, actId: string) {
  const act = await prisma.act.findUnique({ where: { id: actId } });
  if (!act) throw notFound("Акт не найден");
  if (act.status === "disputed") throw conflict("disputed", "Акт оспорен");
  const { isBuyer, isSeller, isSupervisor } = await getDeal(act.deal_id, userId);
  const sig = await signatureProvider.sign({ user_id: userId, document_hash: act.content_hash ?? "" });
  const data: Record<string, unknown> = {};
  if (act.act_type === "supervisor_conclusion" && isSupervisor && (!act.supervisor_id || act.supervisor_id === userId)) { data.signed_by_supervisor_at = sig.signed_at; data.supervisor_signature_ref = sig.signature_ref; data.supervisor_id = userId; }
  else if (isBuyer) { data.signed_by_buyer_at = sig.signed_at; data.buyer_signature_ref = sig.signature_ref; }
  else if (isSeller) { data.signed_by_seller_at = sig.signed_at; data.seller_signature_ref = sig.signature_ref; }
  else throw forbidden("Подписывать могут только стороны сделки / технадзор");
  let upd = await prisma.act.update({ where: { id: actId }, data });
  const complete = act.act_type === "supervisor_conclusion" ? !!upd.signed_by_supervisor_at : !!upd.signed_by_buyer_at && !!upd.signed_by_seller_at;
  if (complete) upd = await prisma.act.update({ where: { id: actId }, data: { status: "signed" } });
  await logActivity({ actor_id: userId, entity_type: "act", entity_id: actId, action: "signed", meta: { ref: sig.signature_ref, complete } });
  return upd;
}

/** Джоб: отказ подписать дольше срока → автоматически dispute (category act_unsigned), акт → disputed. */
export async function autoDisputeUnsignedActs(now = new Date()) {
  const { openDispute } = await import("./disputes");
  const acts = await prisma.act.findMany({ where: { status: "draft", act_type: "acceptance", sign_deadline_at: { lt: now } }, include: { deal: true } });
  let opened = 0;
  for (const a of acts) {
    const oneSided = (a.signed_by_buyer_at && !a.signed_by_seller_at) || (!a.signed_by_buyer_at && a.signed_by_seller_at);
    if (!oneSided) continue;
    const opener = a.signed_by_buyer_at ? a.deal.buyer_id : (await prisma.companyMember.findFirst({ where: { company_id: a.deal.seller_id } }))?.user_id;
    if (!opener) continue;
    await openDispute(opener, a.deal_id, { milestone_id: a.milestone_id, reason: `Акт ${a.id} не подписан второй стороной в срок (${config.actSignDeadlineDays} дн.)`, category: "act_unsigned" });
    await prisma.act.update({ where: { id: a.id }, data: { status: "disputed" } });
    opened++;
  }
  return { opened };
}
