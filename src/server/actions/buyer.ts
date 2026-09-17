"use server";
import { requireSession, companyOf } from "../auth";
import { act, str, num, bool } from "./helpers";
import * as Pr from "../services/projects";
import * as Rq from "../services/requests";
import * as Dl from "../services/deals";
import * as P from "../services/pitches";
import * as T from "../services/timeline";
import * as AI from "../services/ai";
import * as C from "../services/chat";
import { prisma } from "../db";
import type { DealItemPortion } from "@prisma/client";
import { saveUpload, fileFrom } from "../services/uploads";

export async function createProjectAction(fd: FormData) {
  const s = await requireSession();
  let dest = "/projects/new";
  await act("/projects/new", async () => {
    const companyId = str(fd, "company_id") || null;
    const r = await Pr.createProject(s.user.id, {
      name: str(fd, "name"), object_type: str(fd, "object_type"), construction_type: str(fd, "construction_type") || null, region: str(fd, "region"), city: str(fd, "city"), district: str(fd, "district") || null, address: str(fd, "address") || null,
      geo_lat: num(fd, "geo_lat"), geo_lng: num(fd, "geo_lng"), area: num(fd, "area"), rooms: num(fd, "rooms"), floor: num(fd, "floor"), floors: num(fd, "floors"), budget_min: num(fd, "budget_min"), budget_max: num(fd, "budget_max"),
      open_to_pitches: bool(fd, "open_to_pitches"), parent_project_id: str(fd, "parent_project_id") || null, company_id: companyId, land_purpose: str(fd, "land_purpose") || null,
      tu_electric: bool(fd, "tu_electric"), tu_gas: bool(fd, "tu_gas"), tu_water: bool(fd, "tu_water"), tu_sewer: bool(fd, "tu_sewer"), tu_heat: bool(fd, "tu_heat"), deadline: str(fd, "deadline") ? new Date(str(fd, "deadline")) : null,
    });
    dest = `/projects/${r.project.id}`;
    return `${dest}${r.duplicate ? "?ok=" + encodeURIComponent("Внимание: похожий объект по этому адресу уже есть — «" + r.duplicate.name + "»") : ""}`;
  });
  void dest;
}

export async function updateProjectAction(fd: FormData) {
  const s = await requireSession(); const id = str(fd, "id");
  await act(`/projects/${id}`, async () => {
    await Pr.updateProject(id, s.user.id, { open_to_pitches: bool(fd, "open_to_pitches"), status: (str(fd, "status") || undefined) as never, commissioning_status: (str(fd, "commissioning_status") || undefined) as never, budget_min: num(fd, "budget_min"), budget_max: num(fd, "budget_max"), tu_electric: bool(fd, "tu_electric"), tu_gas: bool(fd, "tu_gas"), tu_water: bool(fd, "tu_water"), tu_sewer: bool(fd, "tu_sewer"), tu_heat: bool(fd, "tu_heat") });
    return "Объект обновлён";
  });
}

export async function stageProgressAction(fd: FormData) {
  const s = await requireSession(); const pid = str(fd, "project_id");
  await act(`/projects/${pid}`, async () => { await T.updateStageProgress(s.user.id, str(fd, "stage_id"), Number(str(fd, "progress"))); return "Прогресс этапа обновлён"; });
}

export async function addLabReportAction(fd: FormData) {
  const s = await requireSession(); const pid = str(fd, "project_id");
  await act(`/projects/${pid}`, async () => { const f = fileFrom(fd, "file"); const url = f ? await saveUpload(f, "lab", s.user.id) : str(fd, "file_url") || undefined; await T.addLabReport(s.user.id, { project_id: pid, lab_name: str(fd, "lab_name"), report_type: str(fd, "report_type") as never, verdict_summary: str(fd, "verdict_summary") || undefined, file_url: url }); return "Лабораторный отчёт добавлен"; });
}

export async function createRequestAction(fd: FormData) {
  const s = await requireSession(); const pid = str(fd, "project_id"); const cat = str(fd, "category_id");
  const back = `/projects/${pid}/requests/new?category=${cat}${str(fd, "target_company_id") ? "&target=" + str(fd, "target_company_id") : ""}${str(fd, "delivery_for") ? "&delivery_for=" + str(fd, "delivery_for") : ""}`;
  await act(back, async () => {
    const tpl = await Rq.currentTemplate(cat);
    const values: Record<string, unknown> = {};
    for (const p of tpl.parameters) {
      if (p.field_type === "boolean") values[p.key] = bool(fd, `v_${p.key}`);
      else if (p.field_type === "multiselect") values[p.key] = fd.getAll(`v_${p.key}`).map(String);
      else if (p.field_type === "number") values[p.key] = num(fd, `v_${p.key}`) ?? "";
      else values[p.key] = str(fd, `v_${p.key}`);
    }
    const ai = str(fd, "ai_parse_id") ? await prisma.aiParse.findUnique({ where: { id: str(fd, "ai_parse_id") } }) : null;
    const r = await Rq.createRequest(s.user.id, { project_id: pid, category_id: cat, stage_id: str(fd, "stage_id") || null, values, mode: (str(fd, "mode") || "matched") as never, target_company_id: str(fd, "target_company_id") || null, ai_extracted: ai?.result_json ?? undefined });
    if (str(fd, "delivery_for")) await Rq.linkDeliveryRequest(s.user.id, str(fd, "delivery_for"), r.request.id);
    const n = r.match?.leads.length ?? 0;
    const info = r.match ? (n ? `Она отправлена ${n} подходящим поставщикам — ждите предложений (обычно в течение дня).` : `Подходящих поставщиков рядом пока не нашлось — заявка передана диспетчеру, он назначит исполнителя.`) : "";
    return `/requests/${r.request.id}?ok=${encodeURIComponent(`Заявка опубликована. ${info}${r.warnings.length ? " Обратите внимание: " + r.warnings.join("; ") : ""}`)}`;
  });
}

export async function aiParseAction(fd: FormData) {
  const s = await requireSession(); const pid = str(fd, "project_id"); const cat = str(fd, "category_id");
  const base = `/projects/${pid}/requests/new?category=${cat}${str(fd, "target_company_id") ? "&target=" + str(fd, "target_company_id") : ""}`;
  await act(base, async () => {
    const r = await AI.aiParseRequest(s.user.id, { project_id: pid, category_id: cat, text: str(fd, "text"), input_kind: (str(fd, "input_kind") || "text") as never });
    return `${base}&ai=${r.parse_id}&ok=${encodeURIComponent(`AI-разбор (${r.provider}): заполнено полей ${Object.keys(r.values).length}, осталось разборов сегодня: ${r.remaining}`)}`;
  });
}

export async function cancelRequestAction(fd: FormData) {
  const s = await requireSession(); const id = str(fd, "request_id");
  await act(`/requests/${id}`, async () => { await Rq.cancelRequest(id, s.user.id, str(fd, "reason") || "cancelled"); return "Заявка отменена"; });
}

export async function createDealAction(fd: FormData) {
  const s = await requireSession(); const rid = str(fd, "request_id");
  await act(`/requests/${rid}`, async () => {
    const sel = new Map<string, DealItemPortion[]>();
    for (const v of fd.getAll("select").map(String)) { const [offer, portion] = v.split(":"); sel.set(offer, [...(sel.get(offer) ?? []), portion as DealItemPortion]); }
    const deals = await Dl.createDeals(s.user.id, rid, [...sel].map(([offer_id, portions]) => ({ offer_id, portions })));
    return `/deals/${deals[0].id}?ok=${encodeURIComponent(`Сделок создано: ${deals.length}. Комиссия ${deals[0].commission_percent}%`)}`;
  });
}

export async function respondPitchAction(fd: FormData) {
  const s = await requireSession();
  await act("/inbox", async () => { const r = await P.respondPitch(str(fd, "pitch_id"), s.user.id, str(fd, "action") as "accept" | "decline"); return r.request ? `/requests/${r.request.id}?ok=${encodeURIComponent("Предложение принято — создана точечная заявка")}` : "Предложение отклонено"; });
}

export async function broadcastAction(fd: FormData) {
  const s = await requireSession();
  await act("/broadcast", async () => {
    const company = companyOf(s, str(fd, "company_id"));
    const cat = str(fd, "category_id");
    const tpl = await Rq.currentTemplate(cat);
    const values: Record<string, unknown> = {};
    for (const p of tpl.parameters) { if (p.field_type === "boolean") values[p.key] = bool(fd, `v_${p.key}`); else if (p.field_type === "multiselect") values[p.key] = fd.getAll(`v_${p.key}`).map(String); else if (p.field_type === "number") values[p.key] = num(fd, `v_${p.key}`) ?? ""; else values[p.key] = str(fd, `v_${p.key}`); }
    const projectIds = fd.getAll("project_ids").map(String);
    if (!projectIds.length) throw new Error("Отметьте хотя бы один объект, по которому нужна рассылка");
    const r = await Rq.broadcastRequests(s.user.id, company.id, { category_id: cat, project_ids: projectIds, values, filter: { category_id: cat } });
    return `/outbox?ok=${encodeURIComponent(`Рассылка: ${r.results.length} заявок × ${r.recipients} поставщиков`)}`;
  });
}

export async function sendMessageAction(fd: FormData) {
  const s = await requireSession(); const tid = str(fd, "thread_id");
  await act(`/threads/${tid}`, async () => { const r = await C.sendMessage(tid, s.user.id, str(fd, "body")); return r.warning ? `/threads/${tid}?error=${encodeURIComponent(r.warning)}` : undefined; });
}

export async function openThreadAction(fd: FormData) {
  const s = await requireSession(); const rid = str(fd, "request_id");
  await act(`/requests/${rid}`, async () => { const t = await C.getOrCreateThread(rid, str(fd, "seller_id"), s.user.id); return `/threads/${t.id}`; });
}
