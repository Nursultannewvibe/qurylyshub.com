/* Живой QA-прогон матрицы кейсов (раунд 2). Запуск:
 *   QA_BASE=https://qurylyshub-com.vercel.app DATABASE_URL=<та же БД, что у сайта> QA_DOCS=./qa-docs npx tsx scripts/qa-live/index.ts [фильтр]
 * Все действия — через формы сайта; чтение ID/проверки — из БД; фикстуры дат — через БД (помечены «фикстура»). */
import "dotenv/config";
import assert from "assert";
import path from "path";
import { prisma } from "../../src/server/db";
import * as D from "./driver";
import { B, DOCS, OTP, QA, page, submit, forms, loginSeed, registerUser, registerCompany, createProject, createRequest, buyLead, sendOffer, declineOffer, declineLead, createDeal, payMilestone, startWork, submitMilestone, fillChecklist, acceptMilestone, signAct, review, openDispute, cancelDeal, warranty, warrantyStatus, supervisorConclusion, adminResolveDispute, adminVerify, adminJob, adminAssign, adminSoftBan, adminPayout, uploadVerification, topUp, requestPayout, happyCycle, catByCode } from "./driver";

type Row = { id: string; role: string; title: string; type: string; steps: string[]; result: string; finding: string | null; ms: number };
const rows: Row[] = [];
const only = process.argv[2];
async function run(id: string, role: string, title: string, type: string, fn: (steps: string[]) => Promise<string | void>) {
  if (only && !id.startsWith(only) && !title.toLowerCase().includes(only.toLowerCase())) return;
  const steps: string[] = []; const t = Date.now();
  try { const r = await fn(steps); rows.push({ id, role, title, type, steps, result: r ?? "ок", finding: null, ms: Date.now() - t }); console.log(`✅ ${id} ${title}`); }
  catch (e) { const msg = ((e as Error).message.split("\n").find((l) => l.trim()) ?? "").slice(0, 300) || `(${(e as { code?: string }).code ?? "ошибка без сообщения"})`; rows.push({ id, role, title, type, steps, result: "", finding: msg, ms: Date.now() - t }); console.log(`❌ ${id} ${title}: ${msg}`); }
}
const PNG = path.join(DOCS, "charter_too.png"), PDF = path.join(DOCS, "license_smr.pdf"), JPG = path.join(DOCS, "ip_talon.jpg"), JPG2 = path.join(DOCS, "license_smr.jpg"), BIG = path.join(DOCS, "license_3mb.jpg"), EXE = path.join(DOCS, "license.exe");
const photo = PNG;
const inDays = (n: number) => new Date(Date.now() + n * 86400000);
const cid = async (s: D.Session) => (await prisma.company.findFirstOrThrow({ where: { members: { some: { user_id: s.userId } } }, orderBy: { created_at: "desc" } })).id;
const wallet = async (companyId: string) => Number((await prisma.wallet.findUniqueOrThrow({ where: { company_id: companyId } })).balance);

(async () => {
  console.log(`→ ${B} · документы: ${DOCS}`);
  const aidar = await loginSeed("+77010000001"), big = await loginSeed("+77010000002"), win = await loginSeed("+77010000003"), con = await loginSeed("+77010000004"), roof = await loginSeed("+77010000005"), reno = await loginSeed("+77010000008"), tiler = await loginSeed("+77010000010"), sup = await loginSeed("+77010000006"), adm = await loginSeed("+77010000007"), unl = await loginSeed("+77010000009");
  const winC = await cid(win), conC = await cid(con), roofC = await cid(roof), renoC = await cid(reno), tilerC = await cid(tiler), unlC = await cid(unl);
  // фикстура прогона: дневные лимиты лидов сидовых поставщиков подняты (5/3/8 исчерпываются за один прогон; это штатная работа лимита, не баг)
  await prisma.company.updateMany({ where: { id: { in: [winC, conC, roofC, renoC, tilerC] } }, data: { daily_lead_limit: 1000, pitch_daily_limit: 1000 } });
  // объекты сидовых заказчиков на этот прогон
  const house = await createProject(aidar, { name: "Дом (прогон)", object_type: "house", construction_type: "new", region: "almaty", city: "Алматы", district: "Наурызбайский", address: "ул. QA 1", area: "150", floors: "2", budget_min: "10000000", budget_max: "30000000", open_to_pitches: "on" });
  const flat = await createProject(aidar, { name: "Квартира капремонт (прогон)", object_type: "apartment_renovation", construction_type: "capital", region: "almaty", city: "Алматы", address: "пр. QA 2, кв. 5", area: "70", rooms: "3", floor: "4", floors: "9" });
  const wh = await createProject(big, { name: "Склад (прогон)", object_type: "warehouse", construction_type: "new", region: "boraldai", city: "Боралдай", address: "промзона QA", area: "2000", floors: "1", company_id: (await cid(big)) });
  const cafe = await createProject(big, { name: "Кафе (прогон)", object_type: "cafe", construction_type: "new", region: "almaty", city: "Алматы", address: "ул. QA 3", area: "200", floors: "1", company_id: (await cid(big)) });

  // ══════════ ЗАКАЗЧИК (частный, сид) ══════════
  await run("B1", "Заказчик", "Окна — happy (Окна Алматы)", "happy/seed", async (st) => { const r = await createRequest(aidar, house.id, "windows"); st.push(r.flash); const h = await happyCycle(aidar, win, r.id, photo, { sellerCompanyId: winC }); st.push(...h.steps); });
  await run("B2", "Заказчик", "Крыша — happy (КровляМастер)", "happy/seed", async (st) => { const r = await createRequest(aidar, house.id, "roof"); st.push(r.flash); const h = await happyCycle(aidar, roof, r.id, photo, { sellerCompanyId: roofC }); st.push(...h.steps); });
  await run("B3", "Заказчик", "Бетон — unhappy: отмена заявки как дубля → лид возвращён", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "concrete"); const before = await wallet(conC); await buyLead(con, r.id); assert.equal(await wallet(conC), before - 2000, "лид списан");
    const c = await submit(`/requests/${r.id}`, aidar, (f) => f.inputs.includes("reason") && f.buttons.some((b) => b.label === "Отменить"), { reason: "duplicate" }); assert(!c.error, c.flash); st.push(c.flash);
    assert.equal(await wallet(conC), before, "деньги за лид вернулись"); const lead = await prisma.lead.findFirstOrThrow({ where: { request_id: r.id, company_id: conC } }); assert.equal(lead.status, "refunded");
    const sl = await page("/supplier/leads", con); assert(sl.text.includes("возвращён"), "поставщик видит статус «возвращён»"); return "лид refunded, баланс восстановлен";
  });
  await run("B4", "Заказчик", "Плитка (капремонт) — happy + проигравшее КП → «не выбрано»", "happy+unhappy/seed", async (st) => {
    const r = await createRequest(aidar, flat.id, "reno_tile"); st.push(r.flash); await buyLead(tiler, r.id); const o2 = await sendOffer(tiler, r.id, { scope: "install_only", work: 400000 }); assert(!o2.error, o2.flash);
    const h = await happyCycle(aidar, reno, r.id, photo, { sellerCompanyId: renoC, offer: { scope: "install_only", work: 380000 } }); st.push(...h.steps);
    const lost = await prisma.offer.findFirstOrThrow({ where: { request_id: r.id, company_id: tilerC } }); assert.equal(lost.status, "not_selected");
    const tl = await page("/supplier/leads", tiler); assert(tl.text.includes("не выбрано"), "МастерПлитка видит «не выбрано»"); const n = await prisma.notification.findFirst({ where: { user_id: tiler.userId, type: "offer.not_selected" } }); assert(n, "уведомление проигравшему"); return "второе КП → not_selected + уведомление";
  });
  await run("B5", "Заказчик", "Сантехника — unhappy: спор → админ resolved с частичным раскрытием 50%", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, flat.id, "reno_plumbing"); await buyLead(reno, r.id); const o = await sendOffer(reno, r.id, { scope: "install_only", work: 200000 }); assert(!o.error, o.flash);
    const d = await createDeal(aidar, r.id); const p = await payMilestone(aidar, d.id); assert(/succeeded/.test(p.flash), p.flash); await startWork(reno, d.id); await submitMilestone(reno, d.id);
    const ds = await openDispute(aidar, d.id, "QA: течь в соединении"); assert(!ds.error, ds.flash); st.push(ds.flash);
    const acc = await acceptMilestone(aidar, d.id); assert(acc.error && /спор/.test(acc.flash), `приёмка при споре должна быть заблокирована: ${acc.flash}`); st.push("приёмка заблокирована: " + acc.flash.slice(0, 60));
    const dsp = await prisma.dispute.findFirstOrThrow({ where: { deal_id: d.id } }); const res = await adminResolveDispute(adm, dsp.id, "resolved", true, "0.5"); assert(!res.error, res.flash); st.push(res.flash);
    const m = await prisma.milestone.findFirstOrThrow({ where: { deal_id: d.id } }); assert.equal(m.status, "partially_accepted"); assert.equal(Number(m.accepted_amount), 100000);
    const dp = await page(`/deals/${d.id}`, aidar); assert(dp.text.includes("принят частично"), "заказчик видит «принят частично»"); return "спор решён, 50% исполнителю, статус «принят частично»";
  });
  await run("B6", "Заказчик", "OTP — unhappy: 5 неверных кодов → понятная блокировка", "unhappy/new", async (st) => {
    const phone = D.newPhone(); await fetch(`${B}/api/auth/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
    let last = ""; for (let i = 0; i < 5; i++) { const r = await fetch(`${B}/api/auth/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code: "111111" }) }); last = ((await r.json()) as { message: string }).message; st.push(last); }
    assert(/заблокирован/.test(last) && /минут/.test(last), "сообщение о блокировке с длительностью"); return last;
  });

  // ══════════ КРУПНЫЙ ЗАКАЗЧИК (сид) ══════════
  await run("L1", "Крупный заказчик", "Окна — массовая рассылка → 2 поставщика → happy", "happy/seed", async (st) => {
    const cat = await catByCode("windows"); const pg = await page(`/broadcast?category=${cat.id}`, big); const f = forms(pg.html).find((x) => x.inputs.includes("project_ids"))!;
    const ids = [...f.html.matchAll(/name="project_ids"[^>]*value="([^"]+)"/g)].map((m) => m[1]).filter((v) => [wh.id, cafe.id].includes(v)); assert.equal(ids.length, 2, "оба объекта прогона в списке");
    const r = await submit(`/broadcast?category=${cat.id}`, big, (x) => x.inputs.includes("project_ids"), { project_ids: ids, ...(await D.requestValues(cat.id)) }, { noDefaults: true }); assert(!r.error && /2 заявок/.test(r.flash), r.flash); st.push(r.flash);
    const req = await prisma.request.findFirstOrThrow({ where: { project_id: cafe.id, category_id: cat.id, mode: "broadcast" } });
    const wl = await page("/supplier/leads", win); assert(wl.text.includes("массовая рассылка"), "Окна Алматы видит рассылку сразу"); const rl = await page("/supplier/leads", roof); assert(rl.text.includes("массовая рассылка"), "КровляМастер видит рассылку");
    const h = await happyCycle(big, win, req.id, photo, { sellerCompanyId: winC }); st.push(...h.steps);
  });
  await run("L2", "Крупный заказчик", "Электроснабжение (лицензия) на складе — happy (КровляМастер)", "happy/seed", async (st) => { const r = await createRequest(big, wh.id, "eng_electrical"); st.push(r.flash); assert(/1 подходящим/.test(r.flash), "только лицензированный получает: " + r.flash); const h = await happyCycle(big, roof, r.id, photo, { sellerCompanyId: roofC }); st.push(...h.steps); });
  // новые компании для инженерки/пожарки/газа (регистрация через реальные формы)
  const enUser = await registerUser("Тимур (ЭнергоМонтаж Тест)", "contractor");
  const en = await registerCompany(enUser, { name: "ЭнергоМонтаж Тест", legal_type: "too", role: "contractor", doc: PNG, docType: "image/png", categories: ["eng_gas", "eng_security", "eng_fire", "eng_electrical"] });
  await run("L3", "Крупный заказчик", "Пожарная безопасность — unhappy→happy: нет лицензированных → диспетчер → лицензия pending (КП заблокировано) → verified → happy", "unhappy+happy/new", async (st) => {
    assert(en.company, "регистрация ЭнергоМонтаж: " + en.flash); st.push("регистрация: " + en.flash);
    const r = await createRequest(big, wh.id, "eng_fire"); st.push(r.flash); const req = await prisma.request.findUniqueOrThrow({ where: { id: r.id } }); assert.equal(req.status, "needs_dispatcher", "без лицензированных → needs_dispatcher");
    const an = await prisma.notification.findFirst({ where: { user_id: adm.userId, type: "request.needs_dispatcher", payload_json: { path: ["request_id"], equals: r.id } } }); assert(an, "админ уведомлён");
    const fire = await catByCode("eng_fire"); const up = await uploadVerification(enUser, "license", fire.id, PDF, "2028-12-31", "application/pdf"); assert(!up.error, up.flash); st.push("лицензия загружена: " + up.flash);
    const as = await adminAssign(adm, r.id, en.company!.id); assert(!as.error, as.flash); st.push(as.flash);
    const op = await page(`/supplier/offers/new?request=${r.id}`, enUser); assert(/лицензи/.test(op.text) && !op.html.includes(">Отправить КП</button>") || /disabled/.test(op.html.match(/<button[^>]*>Отправить КП/)?.[0] ?? ""), "при pending лицензии кнопка отправки недоступна с объяснением");
    const blocked = await sendOffer(enUser, r.id); assert(blocked.error && /лицензи/.test(blocked.flash), "бэкенд отклоняет КП без verified лицензии: " + blocked.flash); st.push("pending → " + blocked.flash.slice(0, 70));
    const ver = await prisma.verification.findFirstOrThrow({ where: { company_id: en.company!.id, category_id: fire.id } }); const ap = await page("/admin", adm); assert(ap.html.includes(ver.id), "админ видит верификацию"); assert(/документ/.test(ap.text), "у админа есть ссылка на документ");
    const v = await adminVerify(adm, ver.id, "verified", "2028-12-31"); assert(!v.error, v.flash); st.push("админ: verified");
    const h = await happyCycle(big, enUser, r.id, photo, { sellerCompanyId: en.company!.id }); st.push(...h.steps);
  });
  await run("L4", "Крупный заказчик", "Стены (БетонСервис) кафе — happy", "happy/seed", async (st) => { const r = await createRequest(big, cafe.id, "walls"); st.push(r.flash); const h = await happyCycle(big, con, r.id, photo, { sellerCompanyId: conC }); st.push(...h.steps); });
  const inUser = await registerUser("Асхат (ИнжСети Тест)", "supplier");
  const inz = await registerCompany(inUser, { name: "ИнжСети Тест", legal_type: "too", role: "supplier", doc: JPG, docType: "image/jpeg", categories: ["eng_water_sewer", "eng_heating", "eng_hvac", "eng_smart_home", "eng_cctv"] });
  await run("L5", "Крупный заказчик", "Отопление (новая ИнжСети) — unhappy: отмена после оплаты до начала работ → полный возврат; затем happy", "unhappy+happy/new", async (st) => {
    assert(inz.company, "регистрация ИнжСети: " + inz.flash); const tu = await topUp(inUser, 20000); assert(!tu.error, tu.flash); st.push("пополнение: " + tu.flash);
    const r = await createRequest(big, wh.id, "eng_heating"); await buyLead(inUser, r.id); const o = await sendOffer(inUser, r.id, { material: 50000, work: 300000 }); assert(!o.error, o.flash);
    const d = await createDeal(big, r.id); const p = await payMilestone(big, d.id); assert(/succeeded/.test(p.flash), p.flash);
    const c = await cancelDeal(big, d.id); assert(!c.error, c.flash); st.push(c.flash);
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: d.id }, include: { escrow_holds: true } }); assert.equal(deal.status, "cancelled"); assert(deal.escrow_holds.every((h) => h.status === "refunded"), "эскроу возвращён заказчику");
    const sp = await page(`/deals/${d.id}`, inUser); assert(sp.text.includes("отменена"), "исполнитель видит отмену"); st.push("сделка отменена, эскроу refunded");
    const r2 = await createRequest(big, cafe.id, "eng_heating"); const h = await happyCycle(big, inUser, r2.id, photo, { sellerCompanyId: inz.company!.id }); st.push(...h.steps); return "отмена (полный возврат) + happy";
  });
  await run("L6", "Крупный заказчик", "Газоснабжение — happy после verified лицензии; unhappy: просроченная лицензия исключает из матчинга", "happy+unhappy/new", async (st) => {
    const gas = await catByCode("eng_gas"); const up = await uploadVerification(enUser, "license", gas.id, JPG2, "2028-12-31", "image/jpeg"); assert(!up.error, up.flash);
    const ver = await prisma.verification.findFirstOrThrow({ where: { company_id: en.company!.id, category_id: gas.id } }); await adminVerify(adm, ver.id, "verified", "2028-12-31");
    const r = await createRequest(big, wh.id, "eng_gas"); st.push(r.flash); assert(/1 подходящим/.test(r.flash), "лицензированная новая компания получила лид");
    const h = await happyCycle(big, enUser, r.id, photo, { sellerCompanyId: en.company!.id }); st.push(...h.steps);
    await prisma.verification.update({ where: { id: ver.id }, data: { valid_until: new Date(Date.now() - 86400000) } }); st.push("фикстура: лицензия просрочена");
    const r2 = await createRequest(big, cafe.id, "eng_gas"); assert(!/подходящим/.test(r2.flash) || /0 /.test(r2.flash), "просроченная лицензия → лидов нет: " + r2.flash);
    const sl = await page("/supplier/leads", enUser); assert(/лицензи/.test(sl.text), "поставщик видит объяснение про лицензию"); return "verified → happy; просроченная → исключён";
  });

  // ══════════ ПОСТАВЩИК Окна Алматы (сид) ══════════
  await run("S1", "Поставщик", "Благоустройство — pitch с карты → принят → happy", "happy/seed", async (st) => {
    const land = await catByCode("landscaping"); const p = await submit("/supplier/map", win, (f) => f.hidden.project_id === house.id && f.inputs.includes("message"), { category_id: land.id, message: "QA: рулонный газон", price_estimate: "300000" }, { noDefaults: true }); assert(!p.error, p.flash); st.push(p.flash);
    const ib = await page("/inbox", aidar); assert(ib.text.includes("QA: рулонный газон"), "заказчик видит pitch во входящих");
    const pitch = await prisma.supplierPitch.findFirstOrThrow({ where: { project_id: house.id, company_id: winC }, orderBy: { created_at: "desc" } });
    const acc = await submit("/inbox", aidar, (f) => f.hidden.pitch_id === pitch.id, {}, { button: { name: "action", value: "accept" } }); assert(!acc.error, acc.flash); st.push(acc.flash);
    const rid = acc.finalUrl.match(/requests\/([a-z0-9]+)/)?.[1]!; const rp = await page(`/requests/${rid}`, aidar); assert(rp.text.includes("создана из встречного предложения"), "баннер о pitch");
    const h = await happyCycle(aidar, win, rid, photo, { sellerCompanyId: winC }); st.push(...h.steps);
  });
  await run("S2", "Поставщик", "Окна — unhappy: отказ от лида, rematch не возвращает", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "windows"); const d = await declineLead(win, r.id); assert(!d.error, d.flash); st.push(d.flash);
    const sl = await page("/supplier/leads", win); assert(!sl.html.includes(r.id), "отклонённый лид скрыт"); const j = await adminJob(adm, "rematch"); st.push(j.flash);
    const lead = await prisma.lead.findFirstOrThrow({ where: { request_id: r.id, company_id: winC } }); assert.equal(lead.status, "declined"); return "declined, после rematch статус прежний";
  });
  await run("S3", "Поставщик", "Окна — happy с сохранением/использованием шаблона КП + вывод средств pending→approved→completed", "happy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "windows"); await buyLead(win, r.id); const o = await sendOffer(win, r.id, { template: true }); assert(!o.error, o.flash);
    const tpl = await prisma.offerTemplate.findFirstOrThrow({ where: { company_id: winC, name: "QA шаблон" } }); const op = await page(`/supplier/offers/new?request=${r.id}&template=${tpl.id}`, win); assert(op.html.includes('value="30000"'), "шаблон подставляет цену");
    const d = await createDeal(aidar, r.id, winC); await payMilestone(aidar, d.id); await startWork(win, d.id); await submitMilestone(win, d.id); await fillChecklist(aidar, d.id, photo); const a = await acceptMilestone(aidar, d.id); assert(/принят/.test(a.flash), a.flash); st.push(a.flash.slice(0, 60));
    const before = await wallet(winC); const po = await requestPayout(win, 50000); assert(!po.error, po.flash); st.push(po.flash); assert.equal(await wallet(winC), before - 50000, "сумма зарезервирована");
    const pr = await prisma.payoutRequest.findFirstOrThrow({ where: { company_id: winC, status: "pending" }, orderBy: { requested_at: "desc" } });
    const a1 = await adminPayout(adm, pr.id, "approve"); assert(!a1.error, a1.flash); const a2 = await adminPayout(adm, pr.id, "complete"); assert(!a2.error, a2.flash);
    const wp = await page("/supplier/wallet", win); assert(/завершена|выполнен/.test(wp.text), "поставщик видит завершённый вывод"); return "шаблон переиспользован; выплата completed";
  });
  await run("S4", "Поставщик", "Благоустройство — unhappy: pitch истёк (фикстура + джоб)", "unhappy/seed", async (st) => {
    const p2 = await createProject(aidar, { name: "Дача (для pitch)", object_type: "house", construction_type: "new", region: "talgar", city: "Талгар", address: "QA дача", area: "80", floors: "1", open_to_pitches: "on" });
    const land = await catByCode("landscaping"); const p = await submit("/supplier/map", win, (f) => f.hidden.project_id === p2.id && f.inputs.includes("message"), { category_id: land.id, message: "QA: pitch истечёт", price_estimate: "1" }, { noDefaults: true }); assert(!p.error, p.flash);
    const pitch = await prisma.supplierPitch.findFirstOrThrow({ where: { project_id: p2.id, company_id: winC } }); await prisma.supplierPitch.update({ where: { id: pitch.id }, data: { expires_at: new Date(Date.now() - 1000) } }); st.push("фикстура: expires_at в прошлом");
    const j = await adminJob(adm, "expire_pitches"); st.push(j.flash); assert.equal((await prisma.supplierPitch.findUniqueOrThrow({ where: { id: pitch.id } })).status, "expired");
    const ib = await page("/inbox", aidar); const seg = ib.text.split("QA: pitch истечёт")[0].split("\n").slice(-3).join(" "); assert(/истек/.test(seg) || ib.text.includes("истекло"), "заказчик видит «истекло»"); return "pitch expired, у заказчика без кнопок";
  });
  await run("S5", "Поставщик", "Окна — unhappy: «Отказаться от участия» → КП declined, не в сравнении", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "windows"); await buyLead(win, r.id); const d = await declineOffer(win, r.id); assert(!d.error, d.flash); st.push(d.flash);
    const o = await prisma.offer.findFirstOrThrow({ where: { request_id: r.id, company_id: winC } }); assert.equal(o.status, "declined");
    const rp = await page(`/requests/${r.id}`, aidar); assert(!rp.text.includes("Окна Алматы v1"), "отказавшегося нет в сравнении"); return "offer declined";
  });

  // ══════════ ПОСТАВЩИК БетонСервис (сид) ══════════
  await run("C1", "Поставщик", "Бетон — happy в Конаеве (fallback: расширение радиуса)", "happy/seed", async (st) => {
    const kon = await createProject(aidar, { name: "Гараж Конаев", object_type: "garage", construction_type: "new", region: "konaev", city: "Конаев", address: "QA", area: "40", floors: "1" });
    const r = await createRequest(aidar, kon.id, "concrete"); st.push(r.flash); assert((await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).radius_expanded, "радиус расширен");
    const h = await happyCycle(aidar, con, r.id, photo, { sellerCompanyId: conC }); st.push(...h.steps);
  });
  await run("C2", "Поставщик", "Бетон — unhappy: частичная приёмка с пеней за просрочку (фикстура срока)", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "concrete"); await buyLead(con, r.id); const o = await sendOffer(con, r.id, { scope: "material_only", material: 30000 }); assert(!o.error, o.flash);
    const d = await createDeal(aidar, r.id); await payMilestone(aidar, d.id); const m = await prisma.milestone.findFirstOrThrow({ where: { deal_id: d.id } }); await prisma.milestone.update({ where: { id: m.id }, data: { due_date: new Date(Date.now() - 5 * 86400000) } }); st.push("фикстура: срок этапа −5 дн.");
    await startWork(con, d.id); await submitMilestone(con, d.id); await fillChecklist(aidar, d.id, photo); const a = await acceptMilestone(aidar, d.id, 200000); assert(!a.error && /частично/.test(a.flash) && /пеня/.test(a.flash), a.flash); st.push(a.flash.slice(0, 100));
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: d.id } }); assert(Number(deal.penalty_amount) > 0, "пеня начислена"); return a.flash.slice(0, 80);
  });
  const sbUser = await registerUser("Ержан (СтройБаза)", "supplier");
  const sb = await registerCompany(sbUser, { name: "СтройБаза Тест", legal_type: "ip", role: "supplier", doc: JPG, docType: "image/jpeg", categories: ["walls", "concrete"] });
  await run("C3", "Поставщик", "Стены — unhappy: новый поставщик с нулевым балансом → «Недостаточно средств» → пополнение → покупка", "unhappy/new", async (st) => {
    assert(sb.company, sb.flash); const r = await createRequest(big, cafe.id, "walls"); const lead = await prisma.lead.findFirstOrThrow({ where: { request_id: r.id, company_id: sb.company!.id } }); assert.equal(lead.status, "offered", "новый поставщик получил лид");
    const buy = await submit("/supplier/leads", sbUser, (f) => f.hidden.lead_id === lead.id, {}, { button: { name: "action", value: "purchase" } }); assert(buy.error && /Недостаточно/.test(buy.flash), "понятная ошибка: " + buy.flash); st.push(buy.flash);
    const tu = await topUp(sbUser, 10000); assert(!tu.error, tu.flash); const buy2 = await submit("/supplier/leads", sbUser, (f) => f.hidden.lead_id === lead.id, {}, { button: { name: "action", value: "purchase" } }); assert(!buy2.error, buy2.flash); st.push(buy2.flash); return "после пополнения лид куплен";
  });
  await run("C4", "Поставщик", "Бетон — happy с флагом «подозрительно дёшево» и уведомлением «выше бюджета»", "happy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "concrete"); await buyLead(con, r.id); const cheap = await sendOffer(con, r.id, { scope: "material_only", material: 100 }); assert(/дёшево/.test(cheap.flash), cheap.flash); st.push(cheap.flash);
    const rp = await page(`/requests/${r.id}`, aidar); assert(rp.text.includes("подозрительно дёшево"), "заказчик видит флаг");
    const o2 = await sendOffer(con, r.id, { scope: "material_only", material: 5000000 }); assert(!o2.error, o2.flash); const n = await prisma.notification.findFirst({ where: { user_id: aidar.userId, type: "offers.over_budget", payload_json: { path: ["request_id"], equals: r.id } } }); assert(n, "уведомление «выше бюджета»");
    const d = await createDeal(aidar, r.id); await payMilestone(aidar, d.id); await startWork(con, d.id); await submitMilestone(con, d.id); await fillChecklist(aidar, d.id, photo); const a = await acceptMilestone(aidar, d.id); assert(/принят/.test(a.flash), a.flash); return "флаг + уведомление о бюджете; сделка принята";
  });

  // ══════════ ПОДРЯДЧИК КровляМастер (сид) ══════════
  await run("K1", "Подрядчик", "Крыша — unhappy: заявка истекла (фикстура + expire_stale) → КП нельзя", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "roof"); await buyLead(roof, r.id); await prisma.request.update({ where: { id: r.id }, data: { expires_at: new Date(Date.now() - 1000) } }); st.push("фикстура: expires_at в прошлом");
    const j = await adminJob(adm, "expire_stale"); st.push(j.flash); assert.equal((await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).status, "expired");
    const o = await sendOffer(roof, r.id); assert(o.error && /закрыт/.test(o.flash), "КП по истёкшей заявке отклонено понятно: " + o.flash); const sl = await page("/supplier/leads", roof); assert(sl.text.includes("истекла"), "статус «истекла» у лида"); return o.flash;
  });
  await run("K2", "Подрядчик", "Электроснабжение — unhappy: soft-ban → КП 403 → снятие → ок", "unhappy/seed", async (st) => {
    const r = await createRequest(big, cafe.id, "eng_electrical"); await buyLead(roof, r.id); const ban = await adminSoftBan(adm, roofC, inDays(3).toISOString().slice(0, 10)); assert(!ban.error, ban.flash);
    const o = await sendOffer(roof, r.id); assert(o.error && /soft-ban|ограничен/.test(o.flash), "под баном КП запрещено: " + o.flash); st.push(o.flash);
    const sl = await page("/supplier/leads", roof); assert(/soft-ban/.test(sl.text), "подрядчик видит статус бана"); const un = await adminSoftBan(adm, roofC, null); assert(!un.error, un.flash);
    const o2 = await sendOffer(roof, r.id); assert(!o2.error, o2.flash); return "бан → 403; снят → КП отправлено";
  });
  await run("K3", "Подрядчик", "Окна — happy + гарантийная претензия после акта → в работу → решено", "happy+unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "windows"); await buyLead(win, r.id); const h = await happyCycle(aidar, roof, r.id, photo, { sellerCompanyId: roofC, offer: { scope: "install_only", work: 90000 } }); st.push(...h.steps);
    const w = await warranty(aidar, h.dealId); assert(!w.error, w.flash); st.push(w.flash); const s1 = await warrantyStatus(roof, h.dealId, "in_progress"); assert(!s1.error, s1.flash); const s2 = await warrantyStatus(roof, h.dealId, "resolved"); assert(!s2.error, s2.flash);
    assert.equal((await prisma.warrantyClaim.findFirstOrThrow({ where: { deal_id: h.dealId } })).status, "resolved"); return "гарантия open → in_progress → resolved";
  });
  await run("K4", "Подрядчик", "Крыша — unhappy: спор от технадзора → админ rejected → приёмка проходит", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "roof"); await buyLead(roof, r.id); const o = await sendOffer(roof, r.id); assert(!o.error, o.flash); const d = await createDeal(aidar, r.id); await payMilestone(aidar, d.id); await startWork(roof, d.id); await submitMilestone(roof, d.id);
    const ds = await openDispute(sup, d.id, "QA технадзор: нахлёсты не по инструкции", "quality"); assert(!ds.error, ds.flash); st.push("технадзор открыл спор");
    const dsp = await prisma.dispute.findFirstOrThrow({ where: { deal_id: d.id } }); const res = await adminResolveDispute(adm, dsp.id, "rejected"); assert(!res.error, res.flash);
    await fillChecklist(aidar, d.id, photo); const a = await acceptMilestone(aidar, d.id); assert(!a.error && /принят/.test(a.flash), a.flash); return "после rejected приёмка прошла";
  });

  // ══════════ ПОДРЯДЧИК РемСтрой (сид) ══════════
  await run("R1", "Подрядчик", "Электрика (ремонт, лицензия) — happy", "happy/seed", async (st) => { const r = await createRequest(aidar, flat.id, "reno_electrical"); st.push(r.flash); const h = await happyCycle(aidar, reno, r.id, photo, { sellerCompanyId: renoC }); st.push(...h.steps); });
  await run("R2", "Подрядчик", "Стяжка — happy; unhappy: отмена заявки заказчиком → КП «истекло»", "happy+unhappy/seed", async (st) => {
    const r = await createRequest(aidar, flat.id, "reno_screed"); const h = await happyCycle(aidar, reno, r.id, photo, { sellerCompanyId: renoC }); st.push(...h.steps);
    const r2 = await createRequest(aidar, flat.id, "reno_screed"); await buyLead(reno, r2.id); await sendOffer(reno, r2.id); const c = await submit(`/requests/${r2.id}`, aidar, (f) => f.inputs.includes("reason"), { reason: "cancelled" }); assert(!c.error, c.flash);
    assert.equal((await prisma.offer.findFirstOrThrow({ where: { request_id: r2.id } })).status, "expired"); const sl = await page("/supplier/leads", reno); assert(sl.text.includes("отменена"), "подрядчик видит «отменена»"); return "happy + отмена заявки";
  });
  await run("R3", "Подрядчик", "Штукатурка — unhappy: заказчик отменяет сделку до оплаты; затем happy", "unhappy+happy/seed", async (st) => {
    const r = await createRequest(aidar, flat.id, "reno_plaster"); await buyLead(reno, r.id); await sendOffer(reno, r.id, { scope: "install_only", work: 120000 }); const d = await createDeal(aidar, r.id, renoC);
    const sp = await page(`/deals/${d.id}`, reno); assert(sp.text.includes("Ждём оплату"), "исполнитель видит «ждём оплату»"); const c = await cancelDeal(aidar, d.id); assert(!c.error, c.flash); st.push(c.flash);
    const r2 = await createRequest(aidar, flat.id, "reno_plaster"); const h = await happyCycle(aidar, tiler, r2.id, photo, { sellerCompanyId: tilerC, offer: { scope: "install_only", work: 110000 } }); st.push(...h.steps); return "отмена до оплаты; затем happy";
  });
  await run("R4", "Подрядчик", "Электрика — unhappy: ЭлектроМонтаж (лицензия pending) не получает лид; админ отклоняет → «отклонён»", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, flat.id, "reno_electrical"); const lead = await prisma.lead.findFirst({ where: { request_id: r.id, company_id: unlC } }); assert(!lead, "нелицензированный не получил лид");
    const sl = await page("/supplier/leads", unl); assert(/лицензи/.test(sl.text) && /на проверке/.test(sl.text), "баннер про лицензию на проверке"); st.push("баннер есть");
    const ver = await prisma.verification.findFirstOrThrow({ where: { company_id: unlC, doc_type: "license", status: "pending" } }); const rj = await adminVerify(adm, ver.id, "rejected"); assert(!rj.error, rj.flash);
    const ss = await page("/supplier/settings", unl); assert(ss.text.includes("отклонён"), "компания видит «отклонён»"); const n = await prisma.notification.findFirst({ where: { user_id: unl.userId, type: "verification.rejected" } }); assert(n, "уведомление об отклонении");
    await prisma.verification.update({ where: { id: ver.id }, data: { status: "pending" } }); st.push("фикстура: статус возвращён в pending для следующих прогонов"); return "лид не выдан; reject виден";
  });
  await run("R5", "Подрядчик", "Сантехника — happy (второй цикл)", "happy/seed", async (st) => { const r = await createRequest(aidar, flat.id, "reno_plumbing"); const h = await happyCycle(aidar, reno, r.id, photo, { sellerCompanyId: renoC, offer: { scope: "install_only", work: 150000 } }); st.push(...h.steps); });

  // ══════════ ТЕХНАДЗОР (сид) ══════════
  await run("V1", "Технадзор", "Чек-лист с фото + заключение с подписью на активной сделке", "happy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "roof"); await buyLead(roof, r.id); await sendOffer(roof, r.id); const d = await createDeal(aidar, r.id); await payMilestone(aidar, d.id); await startWork(roof, d.id); await submitMilestone(roof, d.id);
    const sv = await page("/supervisor", sup); assert(sv.html.includes(d.id), "технадзор видит сделку"); const n = await fillChecklist(sup, d.id, photo); st.push(`чек-лист технадзора: ${n}`);
    const c = await supervisorConclusion(sup, d.id); assert(!c.error, c.flash); st.push(c.flash); const act = await prisma.act.findFirstOrThrow({ where: { deal_id: d.id, act_type: "supervisor_conclusion" } }); assert.equal(act.status, "signed");
    const dp = await page(`/deals/${d.id}`, aidar); assert(dp.text.includes("заключение технадзора"), "заказчик видит заключение"); const a = await acceptMilestone(aidar, d.id); assert(/принят/.test(a.flash), a.flash); return "заключение подписано, заказчик принял";
  });
  await run("V2", "Технадзор", "Отзыв от технадзора (author_role=supervisor) виден на карточке", "happy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "roof"); const h = await happyCycle(aidar, roof, r.id, photo, { sellerCompanyId: roofC, offer: { scope: "install_only", work: 100000 } }); st.push(...h.steps); const deal = { id: h.dealId };
    const rv = await review(sup, deal.id, 4, "QA технадзор: аккуратно, мелкие замечания"); assert(!rv.error, rv.flash); st.push(rv.flash); const cp = await page("/catalog/krovlya-master"); assert(cp.text.includes("технадзор") && cp.text.includes("QA технадзор"), "отзыв технадзора на карточке"); return "отзыв виден";
  });

  // ══════════ АДМИН (сид) ══════════
  await run("A1", "Админ", "Оспаривание отзыва → resolved + скрыть → отзыв не показывается", "unhappy/seed", async (st) => {
    const rev = await prisma.review.findFirstOrThrow({ where: { target_company_id: renoC, verified: true }, orderBy: { created_at: "desc" } });
    const dsp = await submit("/catalog/remstroy", reno, (f) => f.hidden.review_id === rev.id && f.inputs.includes("reason"), { reason: "QA: отзыв не по нашей работе" }); assert(!dsp.error, dsp.flash); st.push(dsp.flash);
    const rd = await prisma.reviewDispute.findFirstOrThrow({ where: { review_id: rev.id } }); const res = await submit("/admin", adm, (f) => f.hidden.review_dispute_id === rd.id, { hide: "on" }, { button: { name: "outcome", value: "resolved" }, noDefaults: true }); assert(!res.error, res.flash);
    const cp = await page("/catalog/remstroy"); assert(!cp.text.includes(rev.text ?? "∅"), "скрытый отзыв не показан"); return "отзыв скрыт";
  });
  await run("A2", "Админ", "Выплата reject → деньги вернулись на баланс", "unhappy/seed", async (st) => {
    const before = await wallet(conC); const po = await requestPayout(con, 30000); assert(!po.error, po.flash); const pr = await prisma.payoutRequest.findFirstOrThrow({ where: { company_id: conC, status: "pending" }, orderBy: { requested_at: "desc" } });
    const rj = await adminPayout(adm, pr.id, "reject"); assert(!rj.error, rj.flash); assert.equal(await wallet(conC), before, "баланс восстановлен"); const n = await prisma.notification.findFirst({ where: { user_id: con.userId, type: "payout.rejected" } }); assert(n, "уведомление об отклонении"); return "reject → возврат";
  });
  await run("A3", "Админ", "Джобы вручную: reputation, predictive_timeline, lead_auto_refund (фикстура 48ч), act_auto_dispute; цепочка activity_log", "happy/seed", async (st) => {
    for (const j of ["reputation", "predictive_timeline"]) { const r = await adminJob(adm, j); assert(!r.error, r.flash); st.push(r.flash.slice(0, 60)); }
    const r = await createRequest(aidar, house.id, "windows"); await buyLead(win, r.id); const lead = await prisma.lead.findFirstOrThrow({ where: { request_id: r.id, company_id: winC } }); await prisma.lead.update({ where: { id: lead.id }, data: { purchased_at: new Date(Date.now() - 49 * 3600000) } }); st.push("фикстура: лид куплен 49 ч назад без ответа");
    const before = await wallet(winC); const j = await adminJob(adm, "lead_auto_refund"); assert(!j.error, j.flash); assert.equal(await wallet(winC), before + 2000, "автовозврат лида"); st.push(j.flash);
    const ap = await page("/admin", adm); assert(/цепочка: ✓/.test(ap.text), "hash-цепочка целостна"); return "джобы отработали";
  });
  await run("A4", "Админ", "Автоспор по неподписанному акту (фикстура дедлайна) → акт «оспорен», спор в кабинете", "unhappy/seed", async (st) => {
    const r = await createRequest(aidar, house.id, "windows"); await buyLead(win, r.id); await sendOffer(win, r.id); const d = await createDeal(aidar, r.id, winC); await payMilestone(aidar, d.id); await startWork(win, d.id); await submitMilestone(win, d.id); await fillChecklist(aidar, d.id, photo); await acceptMilestone(aidar, d.id);
    await signAct(aidar, d.id); const act = await prisma.act.findFirstOrThrow({ where: { deal_id: d.id, act_type: "acceptance" } }); await prisma.act.update({ where: { id: act.id }, data: { sign_deadline_at: new Date(Date.now() - 1000) } }); st.push("фикстура: дедлайн подписи прошёл");
    const j = await adminJob(adm, "act_auto_dispute"); assert(!j.error, j.flash); assert.equal((await prisma.act.findUniqueOrThrow({ where: { id: act.id } })).status, "disputed"); const ap = await page("/admin", adm); assert(/акт не подписан/.test(ap.text), "спор «акт не подписан» у админа"); return "автоспор создан";
  });

  // ══════════ НОВЫЕ РЕГИСТРАЦИИ ══════════
  const nb = await registerUser("Айгерим (новый заказчик)", "buyer");
  const nbFlat = await createProject(nb, { name: "Новая квартира", object_type: "apartment_renovation", construction_type: "cosmetic", region: "almaty", city: "Алматы", address: "QA новый 1", area: "55", rooms: "2", floor: "3", floors: "5" });
  const nbHouse = await createProject(nb, { name: "Новый дом", object_type: "house", construction_type: "new", region: "kaskelen", city: "Каскелен", address: "QA новый 2", area: "120", floors: "1", open_to_pitches: "on" });
  const otUser = await registerUser("Талгат (ОтделкаПро)", "contractor");
  const ot = await registerCompany(otUser, { name: "ОтделкаПро Тест", legal_type: "ip", role: "contractor", doc: JPG, docType: "image/jpeg", categories: ["reno_demolition", "reno_ceiling", "reno_floor", "reno_doors", "reno_paint"] });
  await run("N1", "Новый заказчик + новый подрядчик", "Демонтаж — happy (оба аккаунта зарегистрированы через формы, талон ИП JPG); unhappy: отказ от лида", "happy+unhappy/new", async (st) => {
    assert(ot.company, ot.flash); st.push("регистрация ОтделкаПро: " + ot.flash); const tu = await topUp(otUser, 30000); assert(!tu.error, tu.flash);
    const dash = await page("/dashboard", nb); assert(dash.text.includes("Следующий шаг"), "новому заказчику показан следующий шаг"); const r = await createRequest(nb, nbFlat.id, "reno_demolition"); st.push(r.flash); const h = await happyCycle(nb, otUser, r.id, photo, { sellerCompanyId: ot.company!.id, offer: { scope: "install_only", work: 80000 } }); st.push(...h.steps);
    const r2 = await createRequest(nb, nbFlat.id, "reno_demolition"); const dl = await declineLead(otUser, r2.id); assert(!dl.error, dl.flash); const rp = await page(`/requests/${r2.id}`, nb); assert(rp.text.includes("отказалась"), "заказчик видит, что подрядчик отказался"); st.push("вторая заявка: подрядчик отказался — заказчик видит статус"); return "happy + отказ от лида";
  });
  await run("N2", "Новый подрядчик", "Потолки — happy; unhappy: частичная приёмка без пени", "happy+unhappy/new", async (st) => {
    const r = await createRequest(nb, nbFlat.id, "reno_ceiling"); const h = await happyCycle(nb, otUser, r.id, photo, { sellerCompanyId: ot.company!.id, offer: { scope: "install_only", work: 90000 } }); st.push(...h.steps);
    const r2 = await createRequest(nb, nbFlat.id, "reno_ceiling"); await buyLead(otUser, r2.id); await sendOffer(otUser, r2.id, { scope: "install_only", work: 100000 }); const d = await createDeal(nb, r2.id); await payMilestone(nb, d.id); await startWork(otUser, d.id); await submitMilestone(otUser, d.id); await fillChecklist(nb, d.id, photo);
    const a = await acceptMilestone(nb, d.id, 70000); assert(/частично/.test(a.flash) && !/пеня/.test(a.flash), a.flash); return "happy + частичная приёмка 70 000 без пени";
  });
  await run("N3", "Новый подрядчик", "Полы — happy; unhappy: гарантийная претензия отклонена", "happy+unhappy/new", async (st) => {
    const r = await createRequest(nb, nbFlat.id, "reno_floor"); const h = await happyCycle(nb, otUser, r.id, photo, { sellerCompanyId: ot.company!.id, offer: { scope: "install_only", work: 95000 } }); st.push(...h.steps);
    await warranty(nb, h.dealId); const s = await warrantyStatus(otUser, h.dealId, "rejected"); assert(!s.error, s.flash); assert.equal((await prisma.warrantyClaim.findFirstOrThrow({ where: { deal_id: h.dealId } })).status, "rejected"); return "гарантия rejected";
  });
  await run("N4", "Новый подрядчик", "Двери — unhappy: отмена после начала работ → 50% исполнителю; затем happy", "unhappy+happy/new", async (st) => {
    const r = await createRequest(nb, nbFlat.id, "reno_doors"); await buyLead(otUser, r.id); await sendOffer(otUser, r.id, { scope: "install_only", work: 60000 }); const d = await createDeal(nb, r.id); await payMilestone(nb, d.id); await startWork(otUser, d.id);
    const before = await wallet(ot.company!.id); const c = await cancelDeal(nb, d.id); assert(!c.error, c.flash); st.push(c.flash); const after = await wallet(ot.company!.id); assert(after > before, `исполнителю выплачена часть: ${before} → ${after}`);
    const r2 = await createRequest(nb, nbFlat.id, "reno_doors"); const h = await happyCycle(nb, otUser, r2.id, photo, { sellerCompanyId: ot.company!.id, offer: { scope: "install_only", work: 60000 } }); st.push(...h.steps); return `отмена после старта: +${after - before} ₸ исполнителю; happy`;
  });
  await run("N5", "Новый подрядчик", "Малярка — happy (фото отзыва → портфолио); unhappy: оспаривание отзыва отклонено", "happy+unhappy/new", async (st) => {
    const r = await createRequest(nb, nbFlat.id, "reno_paint"); const h = await happyCycle(nb, otUser, r.id, photo, { sellerCompanyId: ot.company!.id, offer: { scope: "install_only", work: 70000 } }); st.push(...h.steps);
    const c = await prisma.company.findUniqueOrThrow({ where: { id: ot.company!.id } }); assert((c.portfolio_json as unknown[]).length > 0, "фото отзыва в портфолио"); const cp = await page(`/catalog/${c.public_slug}`); assert(/src="(data:image|\/f\/)/.test(cp.html), "превью в карточке");
    const rev = await prisma.review.findFirstOrThrow({ where: { deal_id: h.dealId } }); const dsp = await submit(`/catalog/${c.public_slug}`, otUser, (f) => f.hidden.review_id === rev.id && f.inputs.includes("reason"), { reason: "QA: не согласны с оценкой" }); assert(!dsp.error, dsp.flash);
    const rd = await prisma.reviewDispute.findFirstOrThrow({ where: { review_id: rev.id } }); const res = await submit("/admin", adm, (f) => f.hidden.review_dispute_id === rd.id, {}, { button: { name: "outcome", value: "rejected" }, noDefaults: true }); assert(!res.error, res.flash);
    const cp2 = await page(`/catalog/${c.public_slug}`); assert(cp2.text.includes("QA: отличная работа"), "отзыв остался после отклонённого оспаривания"); return "портфолио с превью; оспаривание отзыва отклонено — отзыв остался";
  });
  await run("N6", "Новый поставщик", "Водоснабжение и канализация — happy; unhappy: спор → resolved 50%", "happy+unhappy/new", async (st) => {
    const r = await createRequest(nb, nbHouse.id, "eng_water_sewer"); const h = await happyCycle(nb, inUser, r.id, photo, { sellerCompanyId: inz.company!.id }); st.push(...h.steps);
    const r2 = await createRequest(nb, nbHouse.id, "eng_water_sewer"); await buyLead(inUser, r2.id); await sendOffer(inUser, r2.id, { scope: "install_only", work: 200000 }); const d = await createDeal(nb, r2.id); await payMilestone(nb, d.id); await startWork(inUser, d.id); await submitMilestone(inUser, d.id);
    const ds = await openDispute(nb, d.id, "QA: давление не держит", "quality"); assert(!ds.error, ds.flash); const dsp = await prisma.dispute.findFirstOrThrow({ where: { deal_id: d.id } }); const res = await adminResolveDispute(adm, dsp.id, "resolved", true, "0.5"); assert(!res.error, res.flash); return "happy + спор 50%";
  });
  await run("N7", "Новый поставщик", "Вентиляция — unhappy: спор rejected → приёмка; затем happy", "unhappy+happy/new", async (st) => {
    const r = await createRequest(nb, nbHouse.id, "eng_hvac"); await buyLead(inUser, r.id); await sendOffer(inUser, r.id); const d = await createDeal(nb, r.id); await payMilestone(nb, d.id); await startWork(inUser, d.id); await submitMilestone(inUser, d.id);
    const ds = await openDispute(nb, d.id, "QA: шумит", "quality"); assert(!ds.error, ds.flash); const dsp = await prisma.dispute.findFirstOrThrow({ where: { deal_id: d.id } }); await adminResolveDispute(adm, dsp.id, "rejected"); await fillChecklist(nb, d.id, photo); const a = await acceptMilestone(nb, d.id); assert(/принят/.test(a.flash), a.flash); st.push(a.flash.slice(0, 60));
    const r2 = await createRequest(nb, nbHouse.id, "eng_hvac"); const h = await happyCycle(nb, inUser, r2.id, photo, { sellerCompanyId: inz.company!.id }); st.push(...h.steps);
  });
  await run("N8", "Новый поставщик", "Умный дом — happy; unhappy: заказчик не отвечает 48 ч → автовозврат лида", "happy+unhappy/new", async (st) => {
    const r = await createRequest(nb, nbHouse.id, "eng_smart_home"); const h = await happyCycle(nb, inUser, r.id, photo, { sellerCompanyId: inz.company!.id }); st.push(...h.steps);
    const r2 = await createRequest(nb, nbHouse.id, "eng_smart_home"); await buyLead(inUser, r2.id); const lead = await prisma.lead.findFirstOrThrow({ where: { request_id: r2.id, company_id: inz.company!.id } }); await prisma.lead.update({ where: { id: lead.id }, data: { purchased_at: new Date(Date.now() - 50 * 3600000) } });
    const before = await wallet(inz.company!.id); await adminJob(adm, "lead_auto_refund"); assert.equal(await wallet(inz.company!.id), before + 2000, "лид возвращён"); return "happy + автовозврат";
  });
  await run("N9", "Новый поставщик", "Видеонаблюдение — unhappy: отказ от участия; затем happy", "unhappy+happy/new", async (st) => {
    const r = await createRequest(nb, nbHouse.id, "eng_cctv"); await buyLead(inUser, r.id); const d = await declineOffer(inUser, r.id); assert(!d.error, d.flash); st.push(d.flash);
    const r2 = await createRequest(nb, nbHouse.id, "eng_cctv"); const h = await happyCycle(nb, inUser, r2.id, photo, { sellerCompanyId: inz.company!.id }); st.push(...h.steps);
  });
  await run("N10", "Новый подрядчик", "Охранная сигнализация — лицензия rejected → блок; повторная pending → блок; verified → happy", "unhappy+happy/new", async (st) => {
    const sec = await catByCode("eng_security"); const u1 = await uploadVerification(enUser, "license", sec.id, PNG, "2028-12-31", "image/png"); assert(!u1.error, u1.flash);
    const v1 = await prisma.verification.findFirstOrThrow({ where: { company_id: en.company!.id, category_id: sec.id }, orderBy: { created_at: "desc" } }); await adminVerify(adm, v1.id, "rejected");
    const r = await createRequest(nb, nbHouse.id, "eng_security"); assert(!(await prisma.lead.findFirst({ where: { request_id: r.id, company_id: en.company!.id } })), "с отклонённой лицензией лид не выдан"); st.push("rejected → лид не выдан");
    const u2 = await uploadVerification(enUser, "license", sec.id, PDF, "2028-12-31", "application/pdf"); assert(!u2.error, u2.flash); const v2 = await prisma.verification.findFirstOrThrow({ where: { company_id: en.company!.id, category_id: sec.id, status: "pending" } });
    await adminAssign(adm, r.id, en.company!.id); const b = await sendOffer(enUser, r.id); assert(b.error && /лицензи/.test(b.flash), "pending → блок: " + b.flash); st.push("pending → блок");
    await adminVerify(adm, v2.id, "verified", "2028-12-31"); const h = await happyCycle(nb, enUser, r.id, photo, { sellerCompanyId: en.company!.id }); st.push(...h.steps);
  });
  const zUser = await registerUser("Бауыржан (ЗаборСтрой)", "contractor");
  const z = await registerCompany(zUser, { name: "ЗаборСтрой Тест", legal_type: "self_employed", role: "contractor", doc: PDF, docType: "application/pdf", categories: ["fence", "landscaping"] });
  await run("N11", "Новый подрядчик", "Забор — happy; unhappy: заявка в Астане → needs_dispatcher → диспетчер назначает → КП", "happy+unhappy/new", async (st) => {
    assert(z.company, z.flash); await topUp(zUser, 10000); const r = await createRequest(nb, nbHouse.id, "fence"); const h = await happyCycle(nb, zUser, r.id, photo, { sellerCompanyId: z.company!.id }); st.push(...h.steps);
    const ast = await createProject(nb, { name: "Дом Астана", object_type: "house", construction_type: "new", region: "astana", city: "Астана", address: "QA", area: "100", floors: "1" }); const r2 = await createRequest(nb, ast.id, "fence"); assert.equal((await prisma.request.findUniqueOrThrow({ where: { id: r2.id } })).status, "needs_dispatcher");
    const rp = await page(`/requests/${r2.id}`, nb); assert(rp.text.includes("передана диспетчеру"), "заказчику объяснено"); const as = await adminAssign(adm, r2.id, z.company!.id); assert(!as.error, as.flash); const o = await sendOffer(zUser, r2.id); assert(!o.error, o.flash); return "happy + диспетчер";
  });
  await run("N12", "Новая компания", "Онбординг документов: exe/16 МБ/13 МБ отклоняются понятно; PDF, JPG, PNG принимаются; регистрация без файла невозможна", "unhappy+happy/new", async (st) => {
    const u = await registerUser("Диана (документы)", "supplier");
    const noFile = await submit("/settings", u, (f) => f.inputs.includes("bin"), { name: `${QA} Без файла`, legal_type: "ip", bin: D.newBin(), role: "supplier", consent: "on" }, { noDefaults: true }); assert(noFile.error && /Приложите/.test(noFile.flash), "без файла: " + noFile.flash); st.push("без файла → " + noFile.flash);
    const sp = await page("/settings", u); assert(/data-max-mb="\d+"/.test(sp.html), "клиентская проверка размера на форме регистрации"); st.push("форма: лимит " + sp.html.match(/data-max-mb="(\d+)"/)?.[1] + " МБ показан до отправки");
    for (const [f, type, why] of [[EXE, "application/octet-stream", "формат"], [BIG, "image/jpeg", "2 МБ"]] as const) { const r = await registerCompany(u, { name: "Плохой файл", legal_type: "ip", role: "supplier", doc: f, docType: type, categories: [] }); assert(!r.company && r.flash, `${why}: должна быть ошибка`); assert(/формат|МБ/i.test(r.flash), `понятная ошибка (${why}): ${r.flash}`); st.push(`${path.basename(f)} → ${r.flash.slice(0, 70)}`); }
    const ok = await registerCompany(u, { name: "Документы ОК", legal_type: "too", role: "supplier", doc: PNG, docType: "image/png", categories: ["walls"] }); assert(ok.company, ok.flash); st.push("PNG → " + ok.flash);
    for (const [f, type] of [[PDF, "application/pdf"], [JPG, "image/jpeg"]] as const) { const r = await uploadVerification(u, "registration", "", f, "2028-12-31", type); assert(!r.error, `${path.basename(f)}: ${r.flash}`); st.push(`${path.basename(f)} → принят`); }
    const ss = await page("/supplier/settings", u); assert((ss.html.match(/href="\/f\//g) ?? []).length >= 2 || /src="data:image/.test(ss.html), "документы отображаются"); const ap = await page("/admin", adm); assert(ap.text.includes("Документы ОК"), "админ видит новую компанию в очереди"); return "валидация форматов и размеров работает";
  });
  const nbUser2 = await registerUser("Марат (Новая стройкомпания)", "buyer");
  const nbc = await registerCompany(nbUser2, { name: "СтройХолдинг Тест", legal_type: "too", role: "buyer", doc: PNG, docType: "image/png", categories: [] });
  await run("N13", "Новая компания-заказчик", "Крыша — массовая рассылка от новой стройкомпании → happy", "happy/new", async (st) => {
    assert(nbc.company, nbc.flash); const p1 = await createProject(nbUser2, { name: "Ангар холдинга", object_type: "hangar", construction_type: "new", region: "almaty", city: "Алматы", address: "QA ангар", area: "900", floors: "1", company_id: nbc.company!.id });
    const cat = await catByCode("roof"); const r = await submit(`/broadcast?category=${cat.id}`, nbUser2, (x) => x.inputs.includes("project_ids"), { project_ids: [p1.id], ...(await D.requestValues(cat.id)) }, { noDefaults: true }); assert(!r.error && /1 заявок/.test(r.flash), r.flash); st.push(r.flash);
    const req = await prisma.request.findFirstOrThrow({ where: { project_id: p1.id, category_id: cat.id } }); const h = await happyCycle(nbUser2, roof, req.id, photo, { sellerCompanyId: roofC }); st.push(...h.steps);
  });

  // ══════════ ИТОГ ══════════
  const bad = rows.filter((r) => r.finding);
  console.log(`\n══════ ${rows.length - bad.length}/${rows.length} кейсов без находок ══════`);
  for (const r of bad) console.log(`  ❌ ${r.id} ${r.title}\n     → ${r.finding}`);
  const fs = await import("fs"); fs.writeFileSync("qa-live-result.json", JSON.stringify(rows, null, 2));
  await prisma.$disconnect(); process.exitCode = bad.length ? 1 : 0;
})();
