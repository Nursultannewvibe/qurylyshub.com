/* eslint-disable no-console */
/**
 * Раннер сценариев из раздела 16 спеки. Каждый сценарий РЕАЛЬНО выполняется против Postgres
 * через сервисный слой (тот же код, что и API-роуты). Результат — таблица ПРОШЁЛ / НЕ ПРОШЁЛ.
 * Запуск: npm run scenarios   (сначала пересидит БД)
 */
import "dotenv/config";
import { execSync } from "child_process";
import assert from "assert";
import { prisma } from "../src/server/db";
import { Prisma } from "@prisma/client";

const results: { name: string; status: "ПРОШЁЛ" | "НЕ ПРОШЁЛ"; detail: string }[] = [];
const only = process.argv[2];
async function scenario(name: string, fn: () => Promise<string | void>) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
  const t = Date.now();
  try {
    const d = await fn();
    results.push({ name, status: "ПРОШЁЛ", detail: `${d ?? ""} (${Date.now() - t} мс)` });
    console.log(`✅ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, status: "НЕ ПРОШЁЛ", detail: msg });
    console.log(`❌ ${name}: ${msg}`);
  }
}
async function expectError(fn: () => Promise<unknown>, code: string) {
  try { await fn(); } catch (e) { const c = (e as { code?: string }).code; if (c === code) return e; throw new Error(`ожидалась ошибка ${code}, получена ${c}: ${(e as Error).message}`); }
  throw new Error(`ожидалась ошибка ${code}, но вызов прошёл`);
}
const byPhone = async (phone: string) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { phone }, include: { company_members: { include: { company: true } } } });
  return { user: u, company: u.company_members[0]?.company ?? null, cid: u.company_members[0]?.company.id ?? "" };
};
const cat = async (code: string) => prisma.category.findUniqueOrThrow({ where: { code } });
const notifs = (user_id: string, type: string) => prisma.notification.findMany({ where: { user_id, type } });

async function main() {
  console.log("→ пересидка БД");
  execSync("npx tsx prisma/seed.ts", { stdio: "ignore" });
  const S = await import("../src/server/services/requests");
  const M = await import("../src/server/services/matching");
  const L = await import("../src/server/services/leads");
  const O = await import("../src/server/services/offers");
  const Dl = await import("../src/server/services/deals");
  const C = await import("../src/server/services/chat");
  const P = await import("../src/server/services/pitches");
  const Pr = await import("../src/server/services/projects");
  const A = await import("../src/server/services/admin");
  const Cat = await import("../src/server/services/catalog");
  const Auth = await import("../src/server/auth");
  const N = await import("../src/server/services/notifications");

  const aidar = await byPhone("+77010000001");
  const asel = await byPhone("+77010000011");
  const big = await byPhone("+77010000002");
  const win = await byPhone("+77010000003");
  const con = await byPhone("+77010000004");
  const roof = await byPhone("+77010000005");
  const reno = await byPhone("+77010000008");
  const unl = await byPhone("+77010000009");
  const tiler = await byPhone("+77010000010");
  const admin = await byPhone("+77010000007");
  const house = await prisma.project.findFirstOrThrow({ where: { owner_id: aidar.user.id, name: "Дом в Каскелене" } });

  const windowsValues = { count: 8, sizes: "1400×1500 ×6; 900×1500 ×2", profile_class: "Rehau", chambers: "5", glazing: "двухкамерный энергосберегающий", sashes: 10, opening: ["поворотно-откидное"], hardware: "Maco", extras: ["подоконник", "отлив"], measurement_needed: true, install_needed: true, building_type: "частный дом" };
  const concreteValues = { structure_type: "лента", length_m: 48, width_m: 0.5, height_m: 1.2, grade: "М300 (В22.5)", frost: "F150", water: "W6", rebar_needed: true, volume_m3: 31, delivery_address: "по объекту", pump_needed: true };

  let directRequestId = "";
  await scenario("СТРОЙКА: дом в Каскелене, регуляторный блок, точечный запрос окон из каталога, встречное предложение по газону", async () => {
    assert.equal(house.responsibility_level, "III"); assert.equal(house.seismicity, 9); assert.equal(house.needs_permit, false);
    const list = await Cat.catalog({ category: "windows" });
    assert(list.some((c) => c.public_slug === "okna-almaty"), "поставщик окон в каталоге");
    const r = await S.createRequest(aidar.user.id, { project_id: house.id, category_id: (await cat("windows")).id, values: windowsValues, mode: "direct", target_company_id: win.cid });
    directRequestId = r.request.id;
    const lead = await prisma.lead.findUniqueOrThrow({ where: { request_id_company_id: { request_id: r.request.id, company_id: win.cid } } });
    assert.equal(lead.origin, "direct"); assert.equal(lead.status, "purchased");
    // тот же поставщик видит на карте другой объект (Талгар) в рамках своих категорий и шлёт pitch по газону
    const map = await P.mapProjectsForCompany(win.cid);
    const talgar = map.find((p) => p.name === "Дом в Талгаре");
    assert(talgar, "объект в Талгаре виден на карте"); assert(!("address" in talgar!), "адрес скрыт");
    assert(talgar!.categories.some((c) => c.name.includes("газон")), "категория газон доступна");
    const pitch = await P.createPitch(win.cid, win.user.id, { project_id: talgar!.id, category_id: (await cat("landscaping")).id, message: "Рулонный газон 300 м², укладка за 2 дня", price_estimate: 450000 });
    assert.equal(pitch.status, "sent");
    const inbox = await S.buyerInbox(asel.user.id);
    assert(inbox.pitches.some((p) => p.id === pitch.id), "pitch во входящих Асель");
    return `lead.origin=direct, pitch=${pitch.id.slice(-6)}`;
  });

  await scenario("КРУПНЫЙ ЗАКАЗЧИК: 3 объекта → фильтр «нужны окна» → рассылка всем поставщикам окон одной кнопкой", async () => {
    const windows = await cat("windows");
    const projects = await prisma.project.findMany({ where: { company_id: big.cid, parent_project_id: { not: null } }, include: { requests: true } });
    const others = await prisma.project.findMany({ where: { company_id: big.cid, parent_project_id: null, object_type: { in: ["warehouse", "cafe"] } } });
    const all = [...projects, ...others];
    assert(all.length >= 3, `объектов: ${all.length}`);
    const need = all.filter((p) => (windows.object_types_json as string[]).includes(p.object_type));
    const res = await S.broadcastRequests(big.user.id, big.cid, { category_id: windows.id, project_ids: need.map((p) => p.id), values: { ...windowsValues, count: 120, building_type: "коммерческое" }, filter: { category: "windows" } });
    assert.equal(res.results.length, need.length);
    assert.equal(res.recipients, 2, `получателей окон должно быть 2 (Окна Алматы + КровляМастер), получено ${res.recipients}`);
    const leads = await prisma.lead.count({ where: { origin: "broadcast" } });
    assert.equal(leads, need.length * 2);
    return `${need.length} заявок × ${res.recipients} поставщиков = ${leads} лидов, batch=${res.batch.id.slice(-6)}`;
  });

  await scenario("МАТЧИНГ И FALLBACK: расширение радиуса → needs_dispatcher", async () => {
    const concrete = await cat("concrete");
    const konaev = await Pr.createProject(aidar.user.id, { name: "Гараж в Конаеве", object_type: "garage", region: "konaev", city: "Конаев", address: "ул. Сейфуллина 3", area: 40 });
    const r1 = await S.createRequest(aidar.user.id, { project_id: konaev.project.id, category_id: concrete.id, values: concreteValues });
    const req1 = await prisma.request.findUniqueOrThrow({ where: { id: r1.request.id } });
    assert.equal(req1.radius_expanded, true, "радиус должен быть расширен");
    assert.equal(r1.match!.leads.length, 1, "после расширения — 1 лид (БетонСервис)");
    assert.equal(req1.status, "published");
    const logs = await prisma.activityLog.findMany({ where: { entity_id: r1.request.id, action: { startsWith: "match" } } });
    assert(logs.some((l) => l.action === "match.fallback.expand_radius"));
    assert(logs.some((l) => l.action === "match.matched" && JSON.stringify(l.meta_json).includes("вне зоны")), "explainability: причина непопадания в activity_log");
    const astana = await Pr.createProject(aidar.user.id, { name: "Дом в Астане", object_type: "house", region: "astana", city: "Астана", area: 150 });
    const r2 = await S.createRequest(aidar.user.id, { project_id: astana.project.id, category_id: concrete.id, values: concreteValues });
    const req2 = await prisma.request.findUniqueOrThrow({ where: { id: r2.request.id } });
    assert.equal(req2.status, "needs_dispatcher");
    assert((await notifs(admin.user.id, "request.needs_dispatcher")).length >= 1, "диспетчер уведомлён");
    return `Конаев: radius_expanded → 1 лид; Астана: needs_dispatcher`;
  });

  let matchedWindowsRequestId = "";
  let winLeadId = "";
  await scenario("АТОМАРНОСТЬ ПОКУПКИ ЛИДА: две параллельные покупки → ровно одно списание", async () => {
    const r = await S.createRequest(aidar.user.id, { project_id: house.id, category_id: (await cat("windows")).id, values: windowsValues });
    matchedWindowsRequestId = r.request.id;
    assert.equal(r.match!.leads.length, 2, `окна: 2 кандидата (Окна Алматы, КровляМастер), получено ${r.match!.leads.length}`);
    const lead = r.match!.leads.find((l) => l.company_id === win.cid)!;
    winLeadId = lead.id;
    const before = (await prisma.wallet.findUniqueOrThrow({ where: { company_id: win.cid } })).balance;
    const res = await Promise.allSettled([L.purchaseLead(lead.id, win.cid, win.user.id), L.purchaseLead(lead.id, win.cid, win.user.id)]);
    const ok = res.filter((x) => x.status === "fulfilled").length;
    assert.equal(ok, 1, `успешных покупок ${ok}`);
    const after = (await prisma.wallet.findUniqueOrThrow({ where: { company_id: win.cid } })).balance;
    assert.equal(before.sub(after).toString(), "2000", "списано ровно одна цена лида");
    assert.equal(await prisma.transaction.count({ where: { idempotency_key: `lead:${lead.id}` } }), 1);
    return `баланс ${before} → ${after}, 1 транзакция`;
  });

  await scenario("ОТКАЗ ОТ ЛИДА (declined): заявка больше не показывается компании", async () => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { request_id_company_id: { request_id: matchedWindowsRequestId, company_id: roof.cid } } });
    await L.declineLead(lead.id, roof.cid, roof.user.id);
    const list = await L.supplierLeads(roof.cid);
    assert(!list.some((l) => l.id === lead.id), "отклонённый лид не в списке");
    const again = await M.matchRequest(matchedWindowsRequestId, { origin: "rematch" });
    assert(!again.leads.some((l) => l.company_id === roof.cid), "rematch не создаёт лид повторно");
    assert(again.reasons.find((r) => r.company_id === roof.cid)?.reason.includes("уже получал"));
    return "declined, повторно не матчится";
  });

  let plusCid = "";
  await scenario("REMATCH новой верифицированной компании (раз в час)", async () => {
    const windows = await cat("windows");
    const u = await prisma.user.create({ data: { phone: "+77010000020", name: "ОкнаПлюс", referral_code: "PLUS001", roles: { create: { role: "supplier" } }, notification_prefs: { create: [{ channel: "in_app" }] } } });
    const c = await prisma.company.create({ data: { legal_type: "too", name: "ОкнаПлюс", bin: "200140000020", role: "supplier", public_slug: "okna-plus", region: "almaty", city: "Алматы", service_center_lat: 43.238, service_center_lng: 76.945, service_radius_km: 60, categories_json: [windows.id], daily_lead_limit: 5, reputation: { create: {} }, wallet: { create: { balance: new Prisma.Decimal(20000) } }, members: { create: { user_id: u.id, permission: "owner" } } } });
    plusCid = c.id;
    await prisma.verification.create({ data: { company_id: c.id, doc_type: "registration", status: "verified" } });
    const res = await M.rematchAll();
    const lead = await prisma.lead.findUnique({ where: { request_id_company_id: { request_id: matchedWindowsRequestId, company_id: c.id } } });
    assert(lead && lead.origin === "rematch", "лид rematch создан");
    await L.purchaseLead(lead!.id, c.id, u.id);
    return `rematch: ${res.created} новых лидов по ${res.requests} заявкам`;
  });

  await scenario("ЗАЩИТА ЧАТА от номера телефона в сообщении", async () => {
    const thread = await C.getOrCreateThread(matchedWindowsRequestId, win.cid, win.user.id);
    const r = await C.sendMessage(thread.id, win.user.id, "Добрый день! Давайте в вотсап: +7 701 555 66 77, там быстрее");
    assert(r.warning, "предупреждение выдано");
    assert(r.message.flagged_contact_leak); assert(!r.message.body.includes("555"), "номер замаскирован"); assert(!/вотсап/i.test(r.message.body));
    const log = await prisma.activityLog.findFirst({ where: { entity_id: r.message.id, action: "contact_leak_attempt" } });
    assert(log, "фиксация в activity_log");
    const clean = await C.sendMessage(thread.id, aidar.user.id, "Здравствуйте, когда можете сделать замер?");
    assert(!clean.warning && !clean.message.flagged_contact_leak);
    return `body="${r.message.body.slice(0, 60)}…"`;
  });

  await scenario("БЛОКИРОВКА БЕЗ ЛИЦЕНЗИИ на бэкенде (reno_electrical без verified лицензии)", async () => {
    const el = await cat("reno_electrical");
    const flat = await Pr.createProject(aidar.user.id, { name: "Ремонт квартиры (капитальный)", object_type: "apartment_renovation", construction_type: "capital", region: "almaty", city: "Алматы", district: "Бостандыкский", address: "ул. Розыбакиева 100, кв. 12", area: 78, rooms: 3, floor: 5, floors: 9, budget_min: 6_000_000, budget_max: 9_000_000 });
    const r = await S.createRequest(aidar.user.id, { project_id: flat.project.id, category_id: el.id, values: { points: 42, groups: 8, panel: "новый", cable: "ВВГнг-LS", grounding: true } });
    assert(!r.match!.leads.some((l) => l.company_id === unl.cid), "нелицензированный не получил лид");
    assert(r.match!.reasons.find((x) => x.company_id === unl.cid)?.reason.includes("лицензию"), "причина в объяснимости");
    assert(r.match!.leads.some((l) => l.company_id === reno.cid), "лицензированный РемСтрой получил лид");
    // диспетчер вручную назначает лид нелицензированной компании — отправка КП всё равно заблокирована бэкендом
    await A.dispatcherAssignLead(admin.user.id, r.request.id, unl.cid, 0);
    const err = await expectError(() => O.createOffer(unl.cid, unl.user.id, r.request.id, { work_cost: 300000 }), "license_required");
    const blocked = await prisma.activityLog.findFirst({ where: { action: "blocked.no_license", entity_id: r.request.id } });
    assert(blocked);
    (globalThis as { flatId?: string; elReqId?: string }).flatId = flat.project.id;
    (globalThis as { elReqId?: string }).elReqId = r.request.id;
    return `403 ${(err as Error).message.slice(0, 50)}…`;
  });

  await scenario("РЕМОНТ: капремонт квартиры, заявки на электрику и плитку, сравнение КП", async () => {
    const g = globalThis as { flatId?: string; elReqId?: string };
    const tile = await cat("reno_tile");
    const rt = await S.createRequest(aidar.user.id, { project_id: g.flatId!, category_id: tile.id, values: { area_m2: 38, layout: "прямая", waterproofing: true, rooms: ["ванная", "кухня"], materials_included: false } });
    assert.equal(rt.match!.leads.length, 2, "плитка: РемСтрой + МастерПлитка");
    for (const l of rt.match!.leads) await L.purchaseLead(l.id, l.company_id, l.company_id === reno.cid ? reno.user.id : tiler.user.id);
    const o1 = await O.createOffer(reno.cid, reno.user.id, rt.request.id, { offer_scope: "install_only", work_cost: 420000, execution_days: 10, warranty: "1 год" });
    const o2 = await O.createOffer(tiler.cid, tiler.user.id, rt.request.id, { offer_scope: "install_only", work_cost: 380000, execution_days: 8, warranty: "2 года" });
    const cheap = await O.createOffer(tiler.cid, tiler.user.id, rt.request.id, { offer_scope: "install_only", work_cost: 60000, execution_days: 8 });
    assert.equal(cheap.suspicious_cheap, true, "подозрительно дёшево — флаг");
    assert.equal(cheap.offer.version, 2, "версия КП инкрементируется");
    await O.createOffer(tiler.cid, tiler.user.id, rt.request.id, { offer_scope: "install_only", work_cost: 380000, execution_days: 8, warranty: "2 года" });
    const elLead = await prisma.lead.findUniqueOrThrow({ where: { request_id_company_id: { request_id: g.elReqId!, company_id: reno.cid } } });
    await L.purchaseLead(elLead.id, reno.cid, reno.user.id);
    await O.createOffer(reno.cid, reno.user.id, g.elReqId!, { offer_scope: "material_and_work", material_json: [{ name: "Кабель ВВГнг-LS 3×2.5", qty: 400, unit: "м", price: 450 }, { name: "Щит 24 мод + автоматы", qty: 1, unit: "компл", price: 95000 }], work_cost: 380000, execution_days: 7, warranty: "2 года" });
    const cmp = await O.compareOffers(rt.request.id);
    assert.equal(cmp.rows.length, 2); assert(cmp.rows[0].total.lte(cmp.rows[1].total), "сортировка по ИТОГО");
    assert("licensed" in cmp.rows[0] && "rating" in cmp.rows[0] && "warranty" in cmp.rows[0]);
    void o1; void o2;
    return `плитка: ${cmp.rows.map((r) => `${r.company} ${r.total}₸`).join(" | ")}`;
  });

  await scenario("ВХОДЯЩИЕ/ИСХОДЯЩИЕ у заказчика", async () => {
    const inbox = await S.buyerInbox(aidar.user.id);
    const outbox = await S.buyerOutbox(aidar.user.id);
    assert(inbox.offers.length >= 3, `входящие КП: ${inbox.offers.length}`);
    const out = outbox.find((r) => r.id === matchedWindowsRequestId)!;
    assert(out.leads.length >= 3, "исходящая: видно кому ушла");
    assert(out.leads.every((l) => l.company.name));
    return `входящих КП=${inbox.offers.length}, pitches=${inbox.pitches.length}; исходящих заявок=${outbox.length}`;
  });

  await scenario("ЧАСТИЧНОЕ КП и РАЗДЕЛЁННЫЙ ВЫБОР (deal_items) + СТАТУС ПРОИГРАВШЕГО (not_selected) + комиссия", async () => {
    const plusUser = await prisma.companyMember.findFirstOrThrow({ where: { company_id: plusCid } });
    const oMat = await O.createOffer(win.cid, win.user.id, matchedWindowsRequestId, { offer_scope: "material_only", material_json: [{ name: "Окно Rehau 1400×1500", qty: 6, unit: "шт", price: 95000 }, { name: "Окно Rehau 900×1500", qty: 2, unit: "шт", price: 70000 }], delivery_cost: 15000, delivery_days: 12, warranty: "5 лет", template_id: (await prisma.offerTemplate.findFirstOrThrow({ where: { company_id: win.cid } })).id });
    // монтаж — от КровляМастер? он отказался от лида; назначим диспетчером бесплатный лид
    await A.dispatcherAssignLead(admin.user.id, matchedWindowsRequestId, roof.cid, 0);
    const oInst = await O.createOffer(roof.cid, roof.user.id, matchedWindowsRequestId, { offer_scope: "install_only", work_cost: 160000, execution_days: 3, warranty: "2 года на монтаж" });
    const oFull = await O.createOffer(plusCid, plusUser.user_id, matchedWindowsRequestId, { offer_scope: "material_and_work", material_json: [{ name: "Окно KBE", qty: 8, unit: "шт", price: 80000 }], work_cost: 120000, delivery_cost: 10000, delivery_days: 10, execution_days: 2 });
    const deals = await Dl.createDeals(aidar.user.id, matchedWindowsRequestId, [{ offer_id: oMat.offer.id, portions: ["material", "delivery"] }, { offer_id: oInst.offer.id, portions: ["install"] }]);
    assert.equal(deals.length, 2, "по сделке на продавца");
    const dMat = deals.find((d) => d.seller_id === win.cid)!;
    assert.equal(dMat.amount.toString(), "725000"); assert.equal(dMat.commission_percent.toString(), "5"); assert.equal(dMat.commission_amount.toString(), "36250");
    const items = await prisma.dealItem.findMany({ where: { deal_id: dMat.id } });
    assert.deepEqual(items.map((i) => i.portion).sort(), ["delivery", "material"]);
    const lost = await prisma.offer.findUniqueOrThrow({ where: { id: oFull.offer.id } });
    assert.equal(lost.status, "not_selected");
    const n = await notifs(plusUser.user_id, "offer.not_selected");
    assert.equal(n.length, 1); assert(!JSON.stringify(n[0].payload_json).includes("725000"), "цена победителя не раскрыта");
    assert.equal((await prisma.request.findUniqueOrThrow({ where: { id: matchedWindowsRequestId } })).status, "closed");
    assert.equal((await prisma.offer.findUniqueOrThrow({ where: { id: oMat.offer.id } })).status, "accepted");
    (globalThis as { dealMatId?: string; dealInstId?: string }).dealMatId = dMat.id;
    (globalThis as { dealInstId?: string }).dealInstId = deals.find((d) => d.seller_id === roof.cid)!.id;
    return `2 сделки; материал 725 000₸ комиссия 5% = 36 250₸; проигравший → not_selected + уведомление`;
  });

  await scenario("ШАБЛОН КП переиспользован (offer_templates)", async () => {
    const used = await prisma.activityLog.findFirst({ where: { entity_type: "offer_template", action: "used" } });
    assert(used, "шаблон использован при создании КП");
    const offer = await prisma.offer.findFirstOrThrow({ where: { request_id: matchedWindowsRequestId, company_id: win.cid } });
    assert.equal(offer.warranty, "5 лет"); // из шаблона + переопределения
    return `activity: offer_template.used`;
  });

  await scenario("PITCH-СПАМ: cooldown на объект и pitch_daily_limit", async () => {
    const talgar = await prisma.project.findFirstOrThrow({ where: { name: "Дом в Талгаре" } });
    const land = await cat("landscaping");
    await expectError(() => P.createPitch(win.cid, win.user.id, { project_id: talgar.id, category_id: land.id, message: "повтор" }), "pitch_cooldown");
    // лимит 3/день: 1 уже отправлен → ещё 2 на другие объекты ок, 4-й — ошибка
    const others = await prisma.project.findMany({ where: { open_to_pitches: true, id: { not: talgar.id }, object_type: { in: land.object_types_json as string[] } }, take: 3 });
    await P.createPitch(win.cid, win.user.id, { project_id: others[0].id, category_id: land.id, message: "газон" });
    await P.createPitch(win.cid, win.user.id, { project_id: others[1].id, category_id: land.id, message: "газон" });
    await expectError(() => P.createPitch(win.cid, win.user.id, { project_id: others[2].id, category_id: land.id, message: "газон" }), "pitch_daily_limit");
    // scope: бетон вне категорий Окна Алматы
    const concreteId = (await cat("concrete")).id;
    await expectError(() => P.createPitch(win.cid, win.user.id, { project_id: others[2].id, category_id: concreteId, message: "бетон" }), "forbidden");
    return "cooldown 409, daily_limit 409, scope 403";
  });

  await scenario("ГРУППОВОЙ ОБЪЕКТ (parent_project_id): ЖК из 2 корпусов", async () => {
    const zhk = await prisma.project.findFirstOrThrow({ where: { name: "ЖК «Алатау Сити»" }, include: { children: true } });
    assert.equal(zhk.children.length, 2);
    assert(zhk.children.every((c) => c.parent_project_id === zhk.id));
    await expectError(() => Pr.createProject(aidar.user.id, { name: "чужой корпус", object_type: "house", region: "almaty", city: "Алматы", parent_project_id: zhk.id }), "forbidden");
    return `корпуса: ${zhk.children.map((c) => c.name.split("— ")[1]).join(", ")}`;
  });

  await scenario("ВЕРСИЯ ШАБЛОНА: старая заявка не меняется задним числом", async () => {
    const windows = await cat("windows");
    const old = await prisma.request.findUniqueOrThrow({ where: { id: directRequestId }, include: { template: { include: { parameters: true } } } });
    assert.equal(old.template_version, 1);
    const curParams = (await S.currentTemplate(windows.id)).parameters;
    const v2 = await S.createTemplateVersion(windows.id, [...curParams.map((p) => ({ key: p.key, label: p.label, field_type: p.field_type, required: p.required, options: (p.options_json as string[]) ?? undefined, unit: p.unit ?? undefined })), { key: "color", label: "Цвет ламинации", field_type: "select", options: ["белый", "антрацит", "золотой дуб"], required: true }]);
    assert.equal(v2.version, 2);
    const after = await prisma.request.findUniqueOrThrow({ where: { id: directRequestId }, include: { template: { include: { parameters: true } } } });
    assert.equal(after.template_version, 1); assert.equal(after.template_id, old.template_id);
    assert(!after.template.parameters.some((p) => p.key === "color"), "старая версия без нового поля");
    const errs = S.validateValues((await S.currentTemplate(windows.id)).parameters, windowsValues);
    assert(errs.some((e) => e.includes("Цвет")), "новая заявка требует новое поле");
    return `v1 сохранена у заявки, текущая v2 (+color)`;
  });

  await scenario("OTP BRUTE-FORCE: блокировка после 5 попыток", async () => {
    const phone = "+77019990001";
    await Auth.requestOtp(phone);
    for (let i = 1; i <= 4; i++) await expectError(() => Auth.verifyOtp(phone, "111111"), "otp_invalid");
    await expectError(() => Auth.verifyOtp(phone, "111111"), "otp_locked");
    await expectError(() => Auth.verifyOtp(phone, process.env.DEV_OTP_CODE ?? "000000"), "otp_locked"); // даже верный код — заблокирован
    const att = await prisma.otpAttempt.findUniqueOrThrow({ where: { phone } });
    assert(att.locked_until && att.locked_until > new Date());
    await expectError(() => Auth.requestOtp(phone), "otp_locked");
    // логин тестового аккаунта работает и «выйти со всех устройств» инвалидирует токен
    const ok = await Auth.verifyOtp("+77010000001", process.env.DEV_OTP_CODE ?? "000000");
    assert(await Auth.sessionFromToken(ok.token));
    await Auth.logoutAllDevices(ok.user.id);
    assert.equal(await Auth.sessionFromToken(ok.token), null);
    return `locked_until=${att.locked_until?.toISOString()}`;
  });

  await scenario("АНТИ-СПАМ УВЕДОМЛЕНИЙ: digest, дедупликация, quiet hours", async () => {
    const u = asel.user.id;
    await prisma.notificationPreference.update({ where: { user_id_channel: { user_id: u, channel: "push" } }, data: { digest_mode: true } });
    const a = await N.notify({ user_id: u, type: "test.digest", payload: { n: 1 }, dedup_key: "t1" });
    const b = await N.notify({ user_id: u, type: "test.digest", payload: { n: 1 }, dedup_key: "t1" });
    assert.equal(b.deduplicated, true, "дубль не создан");
    const push = a.created.find((n) => n.channel === "push")!;
    assert(push.deferred_until && !push.sent_at, "digest: отложено");
    assert.equal(a.created.length, 2, "in_app + ровно один внешний канал");
    // quiet hours: ставим окно, покрывающее текущий час
    const h = parseInt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Almaty" }).format(new Date()), 10) % 24;
    await prisma.notificationPreference.update({ where: { user_id_channel: { user_id: u, channel: "push" } }, data: { digest_mode: false, quiet_hours_start: (h + 23) % 24, quiet_hours_end: (h + 2) % 24 } });
    const q = await N.notify({ user_id: u, type: "test.quiet", dedup_key: "t2" });
    const qp = q.created.find((n) => n.channel === "push")!;
    assert(qp.deferred_until && qp.deferred_until > new Date(), "quiet hours: отложено до конца окна");
    const crit = await N.notify({ user_id: u, type: "message.new", dedup_key: "t3", critical: true });
    assert(crit.created.find((n) => n.channel === "push")!.sent_at, "критичное — сразу");
    const d = await N.deliverDeferred(new Date(Date.now() + 48 * 3600000));
    assert(d.delivered >= 2 && d.batches >= 1, "отложенные доставлены одним digest-батчем");
    return `dedup ok; digest deferred_until=${push.deferred_until?.toISOString().slice(11, 16)}; quiet ok; delivered=${d.delivered} в ${d.batches} батч(ах)`;
  });

  const extra = await import("./scenarios-money");
  await extra.run({ scenario, expectError, byPhone, cat, notifs });

  console.log("\n══════════ ИТОГ ══════════");
  console.table(results.map((r) => ({ сценарий: r.name.slice(0, 70), статус: r.status, детали: r.detail.slice(0, 90) })));
  const failed = results.filter((r) => r.status !== "ПРОШЁЛ").length;
  console.log(`${results.length - failed}/${results.length} прошли`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
