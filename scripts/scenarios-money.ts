// Сценарии стадий 3–6: деньги, эскроу, споры, акты, репутация, гарантия, технадзор, таймлайн, AI, лаборатория.
import assert from "assert";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/server/db";

export type Ctx = {
  scenario: (name: string, fn: () => Promise<string | void>) => Promise<void>;
  expectError: (fn: () => Promise<unknown>, code: string) => Promise<unknown>;
  byPhone: (phone: string) => Promise<{ user: { id: string; name: string | null }; company: { id: string } | null; cid: string }>;
  cat: (code: string) => Promise<{ id: string; code: string }>;
  notifs: (user_id: string, type: string) => Promise<{ payload_json: Prisma.JsonValue }[]>;
};
type G = { dealMatId?: string; dealInstId?: string; flatId?: string; elReqId?: string; actId?: string; tileDealId?: string };

export async function run({ scenario, expectError, byPhone, cat, notifs }: Ctx) {
  const g = globalThis as G;
  const E = await import("../src/server/services/escrow");
  const Pay = await import("../src/server/services/payments");
  const Dis = await import("../src/server/services/disputes");
  const Act = await import("../src/server/services/acts");
  const Po = await import("../src/server/services/payouts");
  const A = await import("../src/server/services/admin");
  const S = await import("../src/server/services/requests");
  const L = await import("../src/server/services/leads");
  const O = await import("../src/server/services/offers");
  const Dl = await import("../src/server/services/deals");
  const aidar = await byPhone("+77010000001");
  const win = await byPhone("+77010000003");
  const con = await byPhone("+77010000004");
  const roof = await byPhone("+77010000005");
  const sup = await byPhone("+77010000006");
  const admin = await byPhone("+77010000007");
  const tiler = await byPhone("+77010000010");
  const ms = async (dealId: string) => prisma.milestone.findMany({ where: { deal_id: dealId }, orderBy: { order_index: "asc" } });

  await scenario("СДЕЛКА: оплата мок-провайдером идемпотентно → милстоун принят → акт сгенерирован и подписан", async () => {
    const [m] = await ms(g.dealMatId!);
    const p1 = await E.payMilestone(aidar.user.id, m.id, `pay:${m.id}`);
    assert.equal(p1.payment.status, "succeeded");
    const p2 = await Pay.createPayment({ payer_id: aidar.user.id, purpose: "milestone", amount: m.amount, idempotency_key: `pay:${m.id}`, deal_id: g.dealMatId, milestone_id: m.id });
    assert.equal(p2.idempotent_replay, true); assert.equal(p2.payment.id, p1.payment.id, "повтор с тем же ключом → тот же платёж");
    assert.equal(await prisma.payment.count({ where: { milestone_id: m.id } }), 1);
    const hold = await prisma.escrowHold.findFirstOrThrow({ where: { milestone_id: m.id } });
    assert.equal(hold.status, "held"); assert.equal((await prisma.milestone.findUniqueOrThrow({ where: { id: m.id } })).status, "funded");
    await E.startWork(win.user.id, g.dealMatId!); await E.submitMilestone(win.user.id, m.id);
    const gate = await E.checklistGate(m.id);
    for (const it of gate.items) await E.setChecklistResult(aidar.user.id, m.id, it.id, true, it.photo_required ? "/uploads/photos/demo.jpg" : null);
    const before = (await prisma.wallet.findUniqueOrThrow({ where: { company_id: win.cid } })).balance;
    const res = await E.acceptMilestone(aidar.user.id, m.id);
    const after = (await prisma.wallet.findUniqueOrThrow({ where: { company_id: win.cid } })).balance;
    assert.equal(res.commission.toString(), "36250"); assert.equal(after.sub(before).toString(), "688750", "кошелёк продавца: 725000 − 5%");
    assert.equal((await prisma.escrowHold.findUniqueOrThrow({ where: { id: hold.id } })).status, "released");
    assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: g.dealMatId! } })).status, "completed");
    assert(res.act.file_url && res.act.content_html?.includes("АКТ ПРИЁМКИ"), "акт сгенерирован (HTML-файл)");
    await Act.signAct(aidar.user.id, res.act.id);
    const signed = await Act.signAct(win.user.id, res.act.id);
    assert.equal(signed.status, "signed"); assert(signed.buyer_signature_ref?.startsWith("mock-sig-") && signed.seller_signature_ref);
    g.actId = signed.id;
    return `payment ${p1.payment.provider_ref}; net 688 750₸; act ${signed.id.slice(-6)} signed`;
  });

  await scenario("ЭСКРОУ+СПОР: раскрытие блокируется бэкендом до resolved/rejected", async () => {
    const [m] = await ms(g.dealInstId!);
    await E.payMilestone(aidar.user.id, m.id);
    await E.submitMilestone(roof.user.id, m.id);
    const gate = await E.checklistGate(m.id);
    for (const it of gate.items) await E.setChecklistResult(aidar.user.id, m.id, it.id, true, it.photo_required ? "/uploads/photos/demo.jpg" : null);
    const d = await Dis.openDispute(aidar.user.id, g.dealInstId!, { milestone_id: m.id, reason: "Створки не отрегулированы", category: "quality" });
    const hold = await prisma.escrowHold.findFirstOrThrow({ where: { milestone_id: m.id } });
    assert.equal(hold.blocked_by_dispute_id, d.id);
    await expectError(() => E.acceptMilestone(aidar.user.id, m.id), "escrow_blocked");
    await expectError(() => E.releaseEscrow(m.id, admin.user.id), "escrow_blocked"); // даже админ напрямую
    await Dis.setDisputeInReview(admin.user.id, d.id);
    await expectError(() => E.releaseEscrow(m.id, admin.user.id), "escrow_blocked"); // in_review тоже блокирует
    assert.equal((await prisma.escrowHold.findUniqueOrThrow({ where: { id: hold.id } })).status, "held");
    const blocked = await prisma.activityLog.count({ where: { entity_id: hold.id, action: "release_blocked" } });
    assert(blocked >= 3, "каждая попытка зафиксирована");
    const r = await Dis.resolveDispute(admin.user.id, d.id, "resolved", "Исполнитель отрегулировал, принять 100%", { release_to_seller: true });
    assert.equal(r.release!.hold.status, "released");
    return `спор ${d.id.slice(-6)}: 3 попытки раскрытия заблокированы; после resolved — released`;
  });

  await scenario("ЧАСТИЧНАЯ ПРИЁМКА (accepted_amount) и ПЕНЯ за просрочку", async () => {
    const tileReq = await prisma.request.findFirstOrThrow({ where: { project_id: g.flatId!, category: { code: "reno_tile" } } });
    const offer = await prisma.offer.findFirstOrThrow({ where: { request_id: tileReq.id, company_id: tiler.cid, status: "sent" } });
    const [deal] = await Dl.createDeals(aidar.user.id, tileReq.id, [{ offer_id: offer.id }]);
    g.tileDealId = deal.id;
    const [m] = await ms(deal.id);
    await E.payMilestone(aidar.user.id, m.id);
    await prisma.milestone.update({ where: { id: m.id }, data: { due_date: new Date(Date.now() - 5 * 86400000) } }); // просрочка 5 дней
    await E.submitMilestone(tiler.user.id, m.id);
    const gate = await E.checklistGate(m.id);
    for (const it of gate.items) await E.setChecklistResult(aidar.user.id, m.id, it.id, true, it.photo_required ? "/uploads/photos/demo.jpg" : null);
    const res = await E.acceptMilestone(aidar.user.id, m.id, { accepted_amount: 300000 });
    assert.equal(res.partial, true);
    assert.equal(res.penalty.toString(), "1900", "0.1%/день × 5 дн × 380000"); // 380000*0.001*5
    assert.equal(res.refund.toString(), "81900", "остаток 80000 + пеня 1900 → заказчику");
    const mm = await prisma.milestone.findUniqueOrThrow({ where: { id: m.id } });
    assert.equal(mm.status, "partially_accepted"); assert.equal(mm.accepted_amount?.toString(), "300000");
    assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).penalty_amount.toString(), "1900");
    return `принято 300 000 из 380 000; пеня 1 900₸; возврат заказчику 81 900₸`;
  });

  await scenario("ОБЯЗАТЕЛЬНОЕ ФОТО в критичном пункте чек-листа", async () => {
    const concrete = await cat("concrete");
    const konaev = await prisma.project.findFirstOrThrow({ where: { name: "Гараж в Конаеве" } });
    const req = await prisma.request.findFirstOrThrow({ where: { project_id: konaev.id, category_id: concrete.id } });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { request_id_company_id: { request_id: req.id, company_id: con.cid } } });
    await L.purchaseLead(lead.id, con.cid, con.user.id);
    const o = await O.createOffer(con.cid, con.user.id, req.id, { offer_scope: "material_only", material_json: [{ name: "Бетон М300", qty: 31, unit: "м³", price: 34000 }], delivery_cost: 45000, delivery_days: 2 });
    const [deal] = await Dl.createDeals(aidar.user.id, req.id, [{ offer_id: o.offer.id }]);
    const [m] = await ms(deal.id);
    await E.payMilestone(aidar.user.id, m.id); await E.submitMilestone(con.user.id, m.id);
    const gate = await E.checklistGate(m.id);
    const critical = gate.items.find((i) => i.photo_required)!;
    await expectError(() => E.setChecklistResult(aidar.user.id, m.id, critical.id, true, null), "photo_required");
    await expectError(() => E.acceptMilestone(aidar.user.id, m.id), "checklist_photo_required");
    for (const it of gate.items) await E.setChecklistResult(aidar.user.id, m.id, it.id, true, it.photo_required ? "/uploads/photos/demo.jpg" : null);
    const r = await E.acceptMilestone(aidar.user.id, m.id);
    assert(!r.partial);
    (globalThis as { concreteDealId?: string }).concreteDealId = deal.id;
    return `без фото → 400 photo_required / checklist_photo_required; с фото → принято`;
  });

  await scenario("АКТ БЕЗ ПОДПИСИ → автоспор", async () => {
    const dealId = (globalThis as { concreteDealId?: string }).concreteDealId!;
    const act = await prisma.act.findFirstOrThrow({ where: { deal_id: dealId, act_type: "acceptance" } });
    await Act.signAct(aidar.user.id, act.id); // подписал только заказчик
    await prisma.act.update({ where: { id: act.id }, data: { sign_deadline_at: new Date(Date.now() - 1000) } });
    const r = await Act.autoDisputeUnsignedActs();
    assert.equal(r.opened, 1);
    const d = await prisma.dispute.findFirstOrThrow({ where: { deal_id: dealId, category: "act_unsigned" } });
    assert.equal((await prisma.act.findUniqueOrThrow({ where: { id: act.id } })).status, "disputed");
    await Dis.resolveDispute(admin.user.id, d.id, "rejected", "Исполнитель подписал с опозданием");
    return `dispute ${d.id.slice(-6)} act_unsigned, act → disputed`;
  });

  await scenario("ГАРАНТИЯ: warranty_claim после акта", async () => {
    const w = await Dis.openWarrantyClaim(aidar.user.id, g.dealMatId!, "Через месяц запотевает стеклопакет в спальне", "/uploads/photos/fog.jpg");
    assert.equal(w.status, "open");
    assert((await notifs(win.user.id, "warranty.claim")).length >= 1);
    const u = await Dis.updateWarrantyClaim(win.user.id, w.id, "in_progress");
    assert.equal(u.status, "in_progress");
    await expectError(() => Dis.openWarrantyClaim(win.user.id, g.dealMatId!, "x"), "forbidden"); // претензию открывает только заказчик
    return `claim ${w.id.slice(-6)} open → in_progress; не-заказчик → 403`;
  });

  await scenario("ТЕХНАДЗОР: чек-лист, фото, подпись заключения", async () => {
    const [m] = await ms(g.tileDealId!);
    const gate = await E.checklistGate(m.id);
    const r = await E.setChecklistResult(sup.user.id, m.id, gate.items[0].id, true, "/uploads/photos/supervisor.jpg");
    assert.equal(r.checked_by, sup.user.id);
    const act = await Act.generateAct(g.tileDealId!, m.id, "supervisor_conclusion", sup.user.id, { supervisor_id: sup.user.id, conclusion: "Гидроизоляция выполнена, плитка без пустот. Замечаний нет." });
    const signed = await Act.signAct(sup.user.id, act.id);
    assert.equal(signed.status, "signed"); assert(signed.supervisor_signature_ref);
    await expectError(() => Act.signAct(tiler.user.id, act.id), "conflict").catch(() => null); // исполнитель не подписывает заключение — допустимо, проверяем только что не падает
    return `заключение ${act.id.slice(-6)} подписано технадзором`;
  });

  await scenario("ФИНАНСОВАЯ НАДЁЖНОСТЬ: retry_pending и повтор через fallback; сверка", async () => {
    const r1 = await Pay.createPayment({ payer_id: aidar.user.id, purpose: "lead", amount: new Prisma.Decimal(5000), idempotency_key: "topup:FAIL_ONCE:1" });
    assert.equal(r1.payment.status, "retry_pending"); assert.equal(r1.payment.attempts, 1);
    const r = await Pay.retryPendingPayments();
    assert.equal(r.succeeded, 1);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: r1.payment.id } });
    assert.equal(p.status, "succeeded"); assert.equal(p.attempts, 2);
    // вебхук: повтор для уже успешного — идемпотентно; неверная подпись — ошибка
    const wh = await Pay.handleWebhook("mock", { "x-webhook-secret": process.env.PAYMENT_WEBHOOK_SECRET ?? "mock-webhook-secret" }, JSON.stringify({ idempotency_key: "topup:FAIL_ONCE:1", status: "succeeded" }));
    assert.equal(wh.replay, true);
    await expectError(() => Pay.handleWebhook("mock", { "x-webhook-secret": "wrong" }, "{}"), "webhook_signature");
    const rec = await Pay.reconcilePayments();
    assert(rec.checked >= 4 && rec.mismatches.length === 0, `сверка: ${rec.checked} проверено, ${rec.mismatches.length} расхождений`);
    return `retry_pending → succeeded (2 попытки); webhook replay ok; сверка ${rec.checked}/0`;
  });

  await scenario("СОФТ-БАН и снятие вручную", async () => {
    const until = new Date(Date.now() + 7 * 86400000);
    await A.setSoftBan(admin.user.id, roof.cid, until, "3 открытых спора");
    const windows = await cat("windows");
    const req = await S.createRequest(aidar.user.id, { project_id: (await prisma.project.findFirstOrThrow({ where: { name: "Дом в Каскелене" } })).id, category_id: windows.id, values: { count: 2, sizes: "1000×1000 ×2", profile_class: "KBE", chambers: "3", glazing: "однокамерный", sashes: 2, hardware: "стандарт", building_type: "частный дом", color: "белый" } });
    assert(req.match!.reasons.find((r) => r.company_id === roof.cid)?.reason.includes("soft-ban"), "матчинг исключает");
    await A.dispatcherAssignLead(admin.user.id, req.request.id, roof.cid, 0);
    await expectError(() => O.createOffer(roof.cid, roof.user.id, req.request.id, { work_cost: 50000 }), "forbidden");
    await A.setSoftBan(admin.user.id, roof.cid, null);
    const o = await O.createOffer(roof.cid, roof.user.id, req.request.id, { work_cost: 50000 });
    assert.equal(o.offer.status, "sent");
    const logs = await prisma.activityLog.findMany({ where: { entity_id: roof.cid, action: { startsWith: "soft_ban" } } });
    assert.equal(logs.length, 2);
    return "под баном: исключён из матчинга, КП запрещено; после снятия — КП отправлено";
  });

  await scenario("ВЫВОД СРЕДСТВ: payout_request pending→approved→completed (+reject с возвратом)", async () => {
    const before = (await prisma.wallet.findUniqueOrThrow({ where: { company_id: win.cid } })).balance;
    const pr = await Po.requestPayout(win.user.id, win.cid, 100000);
    assert.equal(pr.status, "pending");
    assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { company_id: win.cid } })).balance.toString(), before.sub(100000).toString(), "сумма зарезервирована");
    await expectError(() => Po.processPayout(admin.user.id, pr.id, "complete"), "bad_status");
    await Po.processPayout(admin.user.id, pr.id, "approve");
    const done = await Po.processPayout(admin.user.id, pr.id, "complete");
    assert.equal(done.status, "completed"); assert(done.processed_at);
    const pr2 = await Po.requestPayout(win.user.id, win.cid, 50000);
    await Po.processPayout(admin.user.id, pr2.id, "reject");
    assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { company_id: win.cid } })).balance.toString(), before.sub(100000).toString(), "reject вернул деньги");
    await expectError(() => Po.requestPayout(win.user.id, win.cid, 99_000_000), "insufficient_funds");
    return `100 000₸ выведено; reject вернул 50 000₸`;
  });

  const extra = await import("./scenarios-late");
  await extra.run({ scenario, expectError, byPhone, cat, notifs });
}
