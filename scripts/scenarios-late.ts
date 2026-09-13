import assert from "assert";
import { prisma } from "../src/server/db";
import type { Ctx } from "./scenarios-money";
type G = { dealMatId?: string; flatId?: string; tileDealId?: string };

export async function run({ scenario, expectError, byPhone, cat, notifs }: Ctx) {
  const g = globalThis as G;
  const R = await import("../src/server/services/reviews");
  const AI = await import("../src/server/services/ai");
  const T = await import("../src/server/services/timeline");
  const Pr = await import("../src/server/services/projects");
  const aidar = await byPhone("+77010000001");
  const win = await byPhone("+77010000003");
  const sup = await byPhone("+77010000006");
  const admin = await byPhone("+77010000007");

  await scenario("СДЕЛКА (продолжение): отзыв verified=true → пересчёт company_reputation + AI-саммари", async () => {
    const review = await R.createReview(aidar.user.id, g.dealMatId!, { rating: 5, text: "Окна поставили в срок, монтаж аккуратный, замер бесплатно", photo_urls: ["/uploads/photos/win-done.jpg"] });
    assert.equal(review.verified, true); assert(review.weight > 1, "вес по сумме сделки");
    await expectError(() => R.createReview(win.user.id, g.dealMatId!, { rating: 5 }), "forbidden");
    await R.rateCounterparty(win.user.id, g.dealMatId!, 5, "Заказчик оплатил вовремя");
    const res = await R.recalculateReputation(win.cid);
    const rep = await prisma.companyReputation.findUniqueOrThrow({ where: { company_id: win.cid } });
    assert.equal(rep.avg_rating, 5); assert.equal(rep.deals_count, 1); assert(rep.ai_summary_praise, "AI-саммари «Хвалят»");
    assert.equal((await prisma.company.findUniqueOrThrow({ where: { id: win.cid } })).rating, 5);
    const c = await prisma.company.findUniqueOrThrow({ where: { id: win.cid } });
    assert((c.portfolio_json as unknown[]).length >= 2, "фото из отзыва → portfolio_json");
    return `avg=${rep.avg_rating}, deals=${rep.deals_count}, on_time=${rep.on_time_pct}%, praise="${rep.ai_summary_praise?.slice(0, 40)}…" (${res.recalculated})`;
  });

  await scenario("ОТЗЫВ И ОСПАРИВАНИЕ через review_responses/review_disputes", async () => {
    const review = await prisma.review.findFirstOrThrow({ where: { target_company_id: win.cid } });
    const resp = await R.respondToReview(win.user.id, review.id, "Спасибо! Гарантия 5 лет действует.");
    assert(resp.id); assert((await notifs(aidar.user.id, "review.response")).length >= 1);
    const d = await R.disputeReview(win.user.id, review.id, "Тестовое оспаривание: фото не относится к нашему объекту");
    assert.equal(d.status, "open");
    await expectError(() => R.disputeReview(aidar.user.id, review.id, "x"), "forbidden");
    const r = await R.resolveReviewDispute(admin.user.id, d.id, "rejected");
    assert.equal(r.status, "rejected");
    assert.equal((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).verified, true, "отзыв остался verified");
    return `response ${resp.id.slice(-6)}, dispute ${d.id.slice(-6)} → rejected`;
  });

  await scenario("AI-РАЗБОР: предзаполненная форма из LLM; адрес/телефон не попадают в промпт", async () => {
    const concrete = await cat("concrete");
    const house = await prisma.project.findFirstOrThrow({ where: { name: "Дом в Каскелене" } });
    const text = "Нужен ленточный фундамент под дом 12×8, высота 1.2 м, ширина 0.5 — примерно 31 м3 бетона М300 с насосом. Адрес: ул. Абылай хана 15, Каскелен. Звоните +7 701 234 56 78, Айдар. aidar@mail.kz";
    const r = await AI.aiParseRequest(aidar.user.id, { project_id: house.id, category_id: concrete.id, text });
    assert.equal(r.values.structure_type, "лента"); assert.equal(r.values.volume_m3, 31); assert.equal(r.values.grade, "М300 (В22.5)");
    const row = await prisma.aiParse.findUniqueOrThrow({ where: { id: r.parse_id } });
    for (const pii of ["701 234", "Абылай", "aidar@mail.kz", "Абылай хана"]) assert(!row.sent_prompt.includes(pii), `в промпте не должно быть: ${pii}`);
    assert(!row.sent_prompt.includes(house.address!), "адрес объекта не в промпте");
    assert(row.sent_prompt.includes("Тип объекта: house"), "техническое содержимое есть");
    // rate limit
    for (let i = 0; i < 9; i++) await AI.aiParseRequest(aidar.user.id, { project_id: house.id, category_id: concrete.id, text: "бетон 10 м3" });
    await expectError(() => AI.aiParseRequest(aidar.user.id, { project_id: house.id, category_id: concrete.id, text: "ещё" }), "ai_rate_limit");
    return `provider=${r.provider}, values=${JSON.stringify(r.values).slice(0, 80)}…; PII отсутствует; лимит 10/день`;
  });

  await scenario("ПРЕДИКТИВНЫЙ ТАЙМЛАЙН: планировщик создаёт уведомление заранее", async () => {
    const house = await prisma.project.findFirstOrThrow({ where: { name: "Дом в Каскелене" }, include: { stages: { orderBy: { order_index: "asc" } } } });
    const roofStage = house.stages.find((s) => s.name === "Крыша")!;
    const sched = await prisma.stageSchedule.findFirstOrThrow({ where: { stage_id: roofStage.id } });
    assert(sched.predicted_next_need_category_id && sched.predicted_date, "прогноз есть");
    // до даты далеко → уведомления нет
    const r0 = await T.predictiveNotifications(new Date());
    assert(!(await notifs(aidar.user.id, "timeline.upcoming_need")).some((n) => (n.payload_json as { stage: string }).stage === "Крыша"));
    // за lead_time_days до прогноза → уведомление
    const r1 = await T.predictiveNotifications(new Date(sched.predicted_date!.getTime() - (sched.lead_time_days - 1) * 86400000));
    const n = (await notifs(aidar.user.id, "timeline.upcoming_need")).find((x) => (x.payload_json as { stage: string }).stage === "Крыша");
    assert(n, "уведомление «скоро понадобится крыша» создано");
    // завершение фундамента с опозданием сдвигает последующие этапы
    const found = house.stages.find((s) => s.name === "Фундамент")!;
    await T.updateStageProgress(aidar.user.id, found.id, 100);
    const after = await prisma.stageSchedule.findFirstOrThrow({ where: { stage_id: roofStage.id } });
    assert(after.planned_start!.getTime() !== sched.planned_start!.getTime(), "график сдвинут по факту");
    void r0; void r1;
    return `roof predicted ${sched.predicted_date!.toISOString().slice(0, 10)} → notified; after shift ${after.planned_start!.toISOString().slice(0, 10)}`;
  });

  await scenario("ЛАБОРАТОРИЯ: lab_report на объекте (с юридической пометкой)", async () => {
    const house = await prisma.project.findFirstOrThrow({ where: { name: "Дом в Каскелене" } });
    const r = await T.addLabReport(aidar.user.id, { project_id: house.id, lab_name: "ТОО «КазСтройЛаб»", report_type: "concrete", file_url: "/uploads/lab/concrete-28d.pdf", verdict_summary: "Прочность на 28 сут 32.1 МПа — соответствует В25" });
    assert.equal(r.verified, false);
    assert(T.LAB_DISCLAIMER.includes("не заменяет заключение"));
    await expectError(() => T.addLabReport(win.user.id, { project_id: house.id, lab_name: "x", report_type: "soil" }), "forbidden");
    return `lab_report ${r.id.slice(-6)}: ${r.verdict_summary?.slice(0, 40)}…`;
  });

  await scenario("НАПОМИНАНИЕ О ВЫБОРЕ КП (непринятые offers дольше срока)", async () => {
    const S = await import("../src/server/services/requests");
    const req = await prisma.request.findFirstOrThrow({ where: { status: "published", offers: { some: { status: "sent" } } }, include: { project: true } });
    await prisma.offer.updateMany({ where: { request_id: req.id, status: "sent" }, data: { created_at: new Date(Date.now() - 5 * 86400000) } });
    const r = await S.remindPendingOffers();
    assert(r.sent >= 1);
    const n = await notifs(req.project.owner_id, "offers.reminder");
    assert(n.some((x) => (x.payload_json as { request_id: string }).request_id === req.id));
    const r2 = await S.remindPendingOffers();
    assert.equal(r2.sent, 0, "повторно в тот же день не шлёт (dedup)");
    return `напоминаний: ${r.sent}, повтор: ${r2.sent}`;
  });

  await scenario("ЛОГ АКТИВНОСТИ: hash-цепочка целостна, UPDATE/DELETE запрещены роли приложения", async () => {
    const { verifyChain } = await import("../src/server/activity");
    const v = await verifyChain(10000);
    assert(v.ok, `цепочка сломана на ${v.brokenAt}`);
    const first = await prisma.activityLog.findFirstOrThrow();
    await assert.rejects(prisma.activityLog.update({ where: { id: first.id }, data: { action: "tampered" } }), /permission denied/);
    await assert.rejects(prisma.activityLog.delete({ where: { id: first.id } }), /permission denied/);
    return `${v.checked} записей, цепочка ok; UPDATE/DELETE → permission denied`;
  });

  await scenario("ЗАКАЗЧИК: выключить open_to_pitches, дубль адреса — предупреждение, валидация файла", async () => {
    const talgar = await prisma.project.findFirstOrThrow({ where: { name: "Дом в Талгаре" } });
    const asel = await byPhone("+77010000011");
    await Pr.updateProject(talgar.id, asel.user.id, { open_to_pitches: false });
    const P = await import("../src/server/services/pitches");
    const winCat = await cat("windows");
    await expectError(() => P.createPitch(win.cid, win.user.id, { project_id: talgar.id, category_id: winCat.id, message: "x" }), "forbidden");
    const dup = await Pr.createProject(aidar.user.id, { name: "Дом в Каскелене (дубль)", object_type: "house", region: "kaskelen", city: "Каскелен", address: "ул. Абылай хана, 15", area: 100 });
    assert(dup.duplicate, "дубль по адресу обнаружен (предупреждение, объект создан)");
    assert.throws(() => Pr.validateUpload({ size: 20 * 1024 * 1024, name: "plan.pdf" }, 15));
    assert.throws(() => Pr.validateUpload({ size: 100, name: "virus.exe" }, 15));
    assert(Pr.validateUpload({ size: 100, name: "plan.pdf" }, 15));
    void sup;
    return "open_to_pitches=false → 403; дубль адреса → warning; файл: размер/формат";
  });
}
