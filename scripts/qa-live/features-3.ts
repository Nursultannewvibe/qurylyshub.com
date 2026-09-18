/* Раунд 4: фото товара (G1), сравнение (G2), стыки между фичами (G3–G9). */
import assert from "assert";
import path from "path";
import { prisma } from "../../src/server/db";
import type { Ctx } from "./features-2";
import { B, DOCS, page, submit, forms, loginSeed, registerUser, catByCode } from "./driver";

export async function run({ run, aidar, adm, photo, cid }: Ctx) {
  const con = await loginSeed("+77010000004"); const conC = await cid(con);
  const PNG = path.join(DOCS, "charter_too.png"), JPG = path.join(DOCS, "license_smr.jpg"), BIG = path.join(DOCS, "license_3mb.jpg");
  const concrete = await catByCode("concrete");
  const addProduct = (s: typeof con, fields: Record<string, string>, files: string[] = []) => submit("/supplier/products", s, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: concrete.id, unit: "шт", min_order_qty: "1", ...fields }, { noDefaults: true, files: files.map((p) => ({ field: "photos", path: p, type: p.endsWith(".png") ? "image/png" : "image/jpeg" })) });

  await run("G1", "Фото товара: несколько фото через общий saveUpload → миниатюра+галерея в карточке; плейсхолдер без фото; лимит 6 и размер", async (st) => {
    const r = await addProduct(con, { name: "[QA] Плита с фото", price: "5000", stock_qty: "10" }, [PNG, JPG, PNG]); assert(!r.error && /3 фото/.test(r.flash), r.flash); st.push(r.flash);
    const p = await prisma.product.findFirstOrThrow({ where: { name: "[QA] Плита с фото" } }); const photos = p.photos_json as string[]; assert.equal(photos.length, 3); assert(photos.every((u) => u.startsWith("/f/") || u.startsWith("/uploads/")), "фото через общий механизм хранения: " + photos[0]);
    const card = await page("/catalog/betonservice", aidar); const seg = card.html.split("[QA] Плита с фото")[0].slice(-1500); assert(seg.includes(`src="${photos[0]}"`), "миниатюра первого фото в карточке"); assert((card.html.match(new RegExp(photos[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length >= 1, "галерея содержит второе фото"); st.push("миниатюра + галерея");
    const f = await fetch(`${B}${photos[0]}`, { headers: { cookie: aidar.cookie } }); assert.equal(f.status, 200); assert(/^image\//.test(f.headers.get("content-type") ?? ""), "фото отдаётся как изображение");
    const r0 = await addProduct(con, { name: "[QA] Без фото", price: "100" }); assert(!r0.error, r0.flash); const card2 = await page("/catalog/betonservice", aidar); assert(card2.html.split("[QA] Без фото")[0].slice(-600).includes("нет фото"), "плейсхолдер у товара без фото"); st.push("плейсхолдер есть");
    const r7 = await addProduct(con, { name: "[QA] Семь фото", price: "100" }, [PNG, PNG, PNG, PNG, PNG, PNG, PNG]); assert(r7.error && /не больше 6/.test(r7.flash), "7 фото отклонены: " + r7.flash); st.push("7 фото → " + r7.flash.slice(0, 50));
    const rb = await addProduct(con, { name: "[QA] Большое фото", price: "100" }, [BIG]); assert(rb.error && /МБ/.test(rb.flash), "3 МБ отклонено: " + rb.flash);
    // редактирование: удалить одно, добавить одно
    const upd = await submit("/supplier/products", con, (f) => f.hidden.product_id === p.id, { price: "5000", stock_qty: "10", is_active: "on", remove_photo: photos[1] }, { noDefaults: true, files: [{ field: "photos", path: JPG, type: "image/jpeg" }] }); assert(!upd.error && /удалено фото: 1/.test(upd.flash) && /добавлено фото: 1/.test(upd.flash), upd.flash);
    const p2 = await prisma.product.findUniqueOrThrow({ where: { id: p.id } }); const ph2 = p2.photos_json as string[]; assert.equal(ph2.length, 3); assert(!ph2.includes(photos[1]) && ph2[0] === photos[0], "удалено именно выбранное, порядок сохранён"); st.push("редактирование: −1 +1");
    const sp = await page("/supplier/products", con); assert(/data-max-count="6"/.test(sp.html), "клиентский лимит на форме");
    return "3 фото через file_blobs; миниатюра/галерея; плейсхолдер; 7 фото и 3 МБ отклонены; редактирование";
  });
  await run("G2", "Сравнение: гость → предложение войти; одна категория; лимит 5; подсветка min/max; купить/убрать/очистить; любая роль", async (st) => {
    // гость нажимает «+ Сравнить»
    const guestCard = await page("/catalog/betonservice"); const cf = forms(guestCard.html).find((f) => f.hidden.product_id && f.hidden.back)!; assert(cf, "у гостя есть кнопка «Сравнить»");
    const fd = new FormData(); for (const [k, v] of Object.entries(cf.hidden)) fd.append(k, v);
    const g = await fetch(`${B}/catalog/betonservice`, { method: "POST", body: fd, redirect: "manual" }); const loc = g.headers.get("location") ?? ""; assert(/\/login/.test(loc) && /войдите/i.test(decodeURIComponent(loc)), "гость → /login с объяснением: " + decodeURIComponent(loc).slice(0, 120)); st.push("гость → " + decodeURIComponent(loc).split("error=")[1]?.slice(0, 60));
    const direct = await fetch(`${B}/compare`, { redirect: "manual" }); assert.equal(direct.status, 307, "гость на /compare → редирект на вход");
    // товары: 5 бетонных у БетонСервис (2 уже есть из G1) + 1 окно у Окна Алматы
    for (const n of ["[QA] Бетон А", "[QA] Бетон Б", "[QA] Бетон В", "[QA] Бетон Г"]) { const r = await addProduct(con, { name: n, price: String(1000 + n.charCodeAt(n.length - 1)), stock_qty: "5", delivery_days: String(n.charCodeAt(n.length - 1) % 7 + 1) }); assert(!r.error, r.flash); }
    const win = await loginSeed("+77010000003"); const windows = await catByCode("windows"); const wr = await submit("/supplier/products", win, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: windows.id, name: "[QA] Окно Rehau", price: "90000", unit: "шт", min_order_qty: "1" }, { noDefaults: true }); assert(!wr.error, wr.flash);
    const prods = await prisma.product.findMany({ where: { company_id: conC, name: { startsWith: "[QA]" }, is_active: true }, orderBy: { created_at: "asc" } }); const winP = await prisma.product.findFirstOrThrow({ where: { name: "[QA] Окно Rehau" } });
    const add = (s: typeof aidar, slug: string, pid: string) => submit(`/catalog/${slug}`, s, (f) => f.hidden.product_id === pid && f.hidden.back !== undefined, {}, { noDefaults: true });
    const a1 = await add(aidar, "betonservice", prods[0].id); assert(!a1.error && /Добавлено в сравнение \(1\)/.test(a1.flash), a1.flash); assert(a1.finalUrl.startsWith("/compare"), "после добавления — на страницу сравнения");
    const dup = await add(aidar, "betonservice", prods[0].id); assert(/уже в списке/.test(dup.flash), "повтор: " + dup.flash);
    const cross = await add(aidar, "okna-almaty", winP.id); assert(cross.error && /очистите список|одной категории/.test(cross.flash), "другая категория отклонена: " + cross.flash); st.push("категория: " + cross.flash.slice(0, 70));
    for (const p of prods.slice(1, 5)) { const r = await add(aidar, "betonservice", p.id); assert(!r.error, r.flash); }
    const sixth = await add(aidar, "betonservice", prods[5].id); assert(sixth.error && /не больше 5/.test(sixth.flash), "6-я позиция отклонена: " + sixth.flash); st.push("лимит: " + sixth.flash.slice(0, 50));
    const hdr = await page("/dashboard", aidar); assert(/⚖ 5/.test(hdr.text), "счётчик в шапке: 5");
    // таблица: подсветка
    const cp = await page("/compare", aidar); assert.equal(cp.status, 200); const five = prods.slice(0, 5); const prices = five.map((p) => Number(p.price)); const minP = Math.min(...prices), maxP = Math.max(...prices);
    const rowOf = (name: string) => cp.html.split(`<b>${name}</b>`)[1]?.split("</tr>")[0] ?? "";
    assert(/bg-green-50/.test(rowOf(five[prices.indexOf(minP)].name)), "минимальная цена подсвечена зелёным"); assert(/bg-red-50/.test(rowOf(five[prices.indexOf(maxP)].name)), "максимальная — красным"); st.push(`подсветка: min ${minP}, max ${maxP}`);
    for (const col of ["Продавец", "Цена", "Ед.", "Остаток", "Рейтинг продавца", "Срок поставки"]) assert(cp.text.includes(col), "колонка " + col); assert((cp.html.match(/>Купить</g) ?? []).length >= 4, "ссылки «Купить»"); const withStock = five.find((p) => p.stock_qty == null || p.stock_qty > 0)!; assert(cp.html.includes(`#product-${withStock.id}`), "ссылка ведёт на товар в карточке");
    const rm = await submit("/compare", aidar, (f) => f.hidden.product_id === five[0].id, {}); assert(!rm.error, rm.flash); assert.equal(await prisma.comparisonItem.count({ where: { user_id: aidar.userId } }), 4);
    // другая роль (поставщик) — свой список
    const sup = await loginSeed("+77010000003"); const sa = await add(sup, "betonservice", prods[0].id); assert(!sa.error && /\(1\)/.test(sa.flash), "поставщик тоже может сравнивать: " + sa.flash);
    const cl = await submit("/compare", aidar, (f) => f.buttons.some((b) => b.label === "Очистить список"), {}); assert(!cl.error, cl.flash); assert.equal(await prisma.comparisonItem.count({ where: { user_id: aidar.userId } }), 0); assert.equal(await prisma.comparisonItem.count({ where: { user_id: sup.userId } }), 1, "список поставщика не затронут");
    return "гость → вход; одна категория; лимит 5; min/max подсвечены; купить/убрать/очистить; списки по user_id";
  });
  // ══════════ АУДИТ СТЫКОВ ══════════
  const { createProject, adminSoftBan, happyCycle, buyLead, sendOffer } = await import("./driver");
  const fire = await catByCode("eng_fire"); const elec = await catByCode("eng_electrical");
  await run("G3", "Лицензия × товары: физлицо и неверифицированная компания не могут выставить товар в лицензируемой категории; лицензированная — может; истёкшая лицензия блокирует покупку", async (st) => {
    const fu = await registerUser("Асан (физлицо-товары)", "contractor"); const rg = await submit("/settings", fu, (f) => f.inputs.includes("bin"), { name: "[QA] Физлицо-товары", legal_type: "individual_contractor", role: "supplier", region: "almaty", city: "Алматы", lat: "43.238", lng: "76.945", radius: "60", consent: "on" }, { noDefaults: true }); assert(!rg.error, rg.flash);
    const setc = await submit("/supplier/settings", fu, (f) => f.inputs.includes("daily_lead_limit"), { description: "QA", bank_account: "", daily_lead_limit: "10", pitch_daily_limit: "5", pitch_cooldown_days: "7", service_center_lat: "43.238", service_center_lng: "76.945", service_radius_km: "60", service_area_polygon: "", service_routes: "", categories: [fire.id, concrete.id], is_public: "on" }, { noDefaults: true }); assert(!setc.error, setc.flash);
    const g1 = await submit("/supplier/products", fu, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: fire.id, name: "[QA] Газовый котёл", price: "300000", unit: "шт", min_order_qty: "1" }, { noDefaults: true }); assert(g1.error && /физлицо-исполнитель/.test(g1.flash), "физлицо: товар в пожарке отклонён: " + g1.flash); st.push("физлицо: " + g1.flash.slice(0, 70));
    const g2 = await submit("/supplier/products", fu, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: concrete.id, name: "[QA] Песок физлица", price: "3000", unit: "т", min_order_qty: "1" }, { noDefaults: true }); assert(!g2.error, "общая категория разрешена: " + g2.flash);
    const unl = await loginSeed("+77010000009"); const reno = await catByCode("reno_electrical"); const u1 = await submit("/supplier/products", unl, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: reno.id, name: "[QA] Щит без лицензии", price: "50000", unit: "шт", min_order_qty: "1" }, { noDefaults: true }); assert(u1.error && /лицензи/.test(u1.flash), "pending-лицензия: отклонено: " + u1.flash); st.push("pending: " + u1.flash.slice(0, 60));
    const roof = await loginSeed("+77010000005"); const roofC = await cid(roof); const ok = await submit("/supplier/products", roof, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: elec.id, name: "[QA] Щит ВРУ (лицензия)", price: "120000", unit: "шт", min_order_qty: "1", stock_qty: "3" }, { noDefaults: true }); assert(!ok.error, "verified: разрешено: " + ok.flash); st.push("verified: товар выставлен");
    // лицензия истекла после публикации → покупка блокируется
    const ver = await prisma.verification.findFirstOrThrow({ where: { company_id: roofC, category_id: elec.id, status: "verified" } }); const old = ver.valid_until; await prisma.verification.update({ where: { id: ver.id }, data: { valid_until: new Date(Date.now() - 1000) } });
    try { const prod = await prisma.product.findFirstOrThrow({ where: { name: "[QA] Щит ВРУ (лицензия)" } }); const buy = await submit("/catalog/krovlya-master", aidar, (f) => f.hidden.product_id === prod.id, { qty: "1" }, { noDefaults: true }); assert(buy.error && /лицензи/.test(buy.flash), "покупка при истёкшей лицензии отклонена: " + buy.flash); st.push("истёкшая лицензия → покупка: " + buy.flash.slice(0, 50)); }
    finally { await prisma.verification.update({ where: { id: ver.id }, data: { valid_until: old } }); }
    return "физлицо/pending → 403 license_required; verified → ок; истёкшая → покупка 403";
  });
  await run("G4", "Сравнение × остаток: параллельная распродажа последней единицы → в таблице «нет в наличии» без «Купить», покупка с устаревшей страницы → понятный отказ", async (st) => {
    const r = await addProduct(con, { name: "[QA] Последний мешок", price: "2500", stock_qty: "1" }); assert(!r.error, r.flash); const p = await prisma.product.findFirstOrThrow({ where: { name: "[QA] Последний мешок" } });
    await submit("/compare", aidar, (f) => f.buttons.some((b) => b.label === "Очистить список"), {}).catch(() => null);
    const a = await submit("/catalog/betonservice", aidar, (f) => f.hidden.product_id === p.id && f.hidden.back !== undefined, {}, { noDefaults: true }); assert(!a.error, a.flash);
    const stale = await page("/compare", aidar); assert(stale.html.split(`<b>${p.name}</b>`)[1]?.includes(">1<") && stale.html.includes(`#product-${p.id}`), "в таблице остаток 1 и «Купить»");
    const other = await registerUser("Быстрый покупатель", "buyer"); const ob = await submit("/catalog/betonservice", other, (f) => f.hidden.product_id === p.id && !f.hidden.back, { qty: "1" }, { noDefaults: true }); assert(!ob.error, ob.flash); st.push("другой пользователь купил последнюю единицу");
    const buy = await submit("/catalog/betonservice", aidar, (f) => f.hidden.product_id === p.id && !f.hidden.back, { qty: "1" }, { noDefaults: true }); assert(buy.error && /закончился/.test(buy.flash), "покупка с устаревшей страницы: " + buy.flash); st.push("устаревшая страница → " + buy.flash);
    const fresh = await page("/compare", aidar); const row = fresh.html.split(`<b>${p.name}</b>`)[1]?.split("</tr>")[0] ?? ""; assert(/нет в наличии/.test(row) && !row.includes("Купить"), "после обновления: «нет в наличии», без «Купить»");
    await prisma.product.update({ where: { id: p.id }, data: { is_active: false } }); const off = await page("/compare", aidar); assert(off.text.includes("снят с продажи"), "снятый с продажи товар помечен в сравнении");
    return "остаток проверяется в момент покупки (row lock), таблица показывает актуальный остаток при обновлении";
  });
  await run("G5", "Доска × каталог: у постов/ответов нет инструментов «Купить», есть пометка «не оферта»; ссылка ведёт в карточку компании", async (st) => {
    const post = await submit("/board/concrete", con, (f) => f.inputs.includes("title"), { title: "[QA] Продаём бетон М300 по 30 000", body: "QA: цена 30 000 за куб, звоните", company_id: conC }, { noDefaults: true }); assert(!post.error, post.flash);
    const pid = post.finalUrl.match(/post\/([a-z0-9]+)/)?.[1]!; const pg = await page(`/board/post/${pid}`, aidar);
    assert(!forms(pg.html).some((f) => f.inputs.includes("qty") || f.hidden.product_id), "на доске нет формы покупки"); assert(!/>Купить</.test(pg.html), "нет кнопки «Купить»"); assert(/не оферта/.test(pg.text), "пометка «не оферта»"); assert(pg.html.includes('href="/catalog/betonservice"'), "ссылка на карточку компании — единственный путь к покупке");
    const lst = await page("/board/concrete", aidar); assert(!/>Купить</.test(lst.html)); st.push("покупки нет, пометка есть, ссылка в каталог есть"); return "второго пути покупки через доску нет";
  });
  await run("G6", "Перевозки × товары: покупка товара → «Нужна доставка» → заявка с предзаполнением → request_links по сделке → перевозчик получает лид → сделка", async (st) => {
    const cargo = await loginSeed("+77010000012"); const cargoC = await cid(cargo);
    const pr = await addProduct(con, { name: "[QA] Бетон с доставкой", price: "34000", stock_qty: "50" }); assert(!pr.error, pr.flash); const p = await prisma.product.findFirstOrThrow({ where: { name: "[QA] Бетон с доставкой" } });
    const buy = await submit("/catalog/betonservice", aidar, (f) => f.hidden.product_id === p.id && !f.hidden.back, { qty: "10" }, { noDefaults: true }); assert(!buy.error, buy.flash); const did = buy.finalUrl.match(/deals\/([a-z0-9]+)/)?.[1]!;
    const proj = await createProject(aidar, { name: "Объект для доставки товара", object_type: "house", construction_type: "new", region: "almaty", city: "Алматы", address: "ул. QA-Т 9", area: "90", floors: "1" });
    const dp = await page(`/deals/${did}`, aidar); assert(dp.text.includes("Нужна доставка?"), "блок доставки на товарной сделке"); const href = dp.html.match(new RegExp(`href="(/projects/${proj.id}/requests/new[^"]*delivery_for=${did}[^"]*)"`))?.[1]?.replace(/&amp;/g, "&"); assert(href, "ссылка на объект прогона");
    const form = await page(href!, aidar); assert(form.text.includes("Доставка для покупки «[QA] Бетон с доставкой»"), "предзаполнение из покупки"); const load = form.html.match(/name="v_load_point"[^>]*value="([^"]*)"/)?.[1]; const unload = form.html.match(/name="v_unload_point"[^>]*value="([^"]*)"/)?.[1]; assert(load?.includes("БетонСервис") && unload?.includes("ул. QA-Т 9"), `точки: ${load} → ${unload}`); st.push(`${load} → ${unload}`);
    const sub = await submit(href!, aidar, (f) => f.inputs.includes("v_load_point"), { v_weight_t: "24", v_cargo_type: "бетон/раствор", v_transport_type: "миксер", v_urgency: "завтра" }); assert(!sub.error, sub.flash); const rid = sub.finalUrl.match(/requests\/([a-z0-9]+)/)?.[1]!;
    const link = await prisma.requestLink.findFirstOrThrow({ where: { linked_request_id: rid } }); assert.equal(link.primary_deal_id, did); assert.equal(link.primary_request_id, null); assert(await prisma.lead.findFirst({ where: { request_id: rid, company_id: cargoC } }), "ТрансКарго получил лид (Боралдай→Алматы)");
    const dp2 = await page(`/deals/${did}`, aidar); assert(dp2.text.includes("Заявки на доставку"), "сделка-покупка показывает связанную заявку"); const rq = await page(`/requests/${rid}`, aidar); assert(rq.text.includes("Доставка для покупки «[QA] Бетон с доставкой»"), "заявка показывает связь со сделкой-покупкой");
    const h = await happyCycle(aidar, cargo, rid, photo, { sellerCompanyId: cargoC, offer: { scope: "install_only", work: 50000 } }); st.push(...h.steps.slice(0, 2)); return "связка работает для product_purchase так же, как для КП-сделок";
  });
  await run("G7", "Физлицо × доска: лимиты постов пользователя и компании считаются корректно для аккаунта без БИН", async (st) => {
    const fu = await registerUser("Асан (физлицо-доска)", "contractor"); const rg = await submit("/settings", fu, (f) => f.inputs.includes("bin"), { name: "[QA] Физлицо-доска", legal_type: "individual_contractor", role: "contractor", region: "almaty", city: "Алматы", lat: "43.238", lng: "76.945", radius: "60", consent: "on" }, { noDefaults: true }); assert(!rg.error, rg.flash);
    const co = await prisma.company.findFirstOrThrow({ where: { members: { some: { user_id: fu.userId } } } }); assert.equal(co.bin, null); await prisma.company.update({ where: { id: co.id }, data: { board_post_daily_limit: 2 } });
    try {
      for (let i = 1; i <= 2; i++) { const r = await submit("/board/concrete", fu, (f) => f.inputs.includes("title"), { title: `[QA] физлицо пост ${i}`, body: "QA", company_id: co.id }, { noDefaults: true }); assert(!r.error, `пост ${i}: ${r.flash}`); }
      const over = await submit("/board/concrete", fu, (f) => f.inputs.includes("title"), { title: "[QA] физлицо пост 3", body: "QA", company_id: co.id }, { noDefaults: true }); assert(over.error && /компании/.test(over.flash), "лимит компании-физлица: " + over.flash); st.push(over.flash.slice(0, 60));
      const pg = await page("/board/concrete", aidar); assert(pg.text.includes("[QA] Физлицо-доска") && pg.text.includes("физлицо-исполнитель"), "в ветке видно, что автор — физлицо-исполнитель");
    } finally { await prisma.company.update({ where: { id: co.id }, data: { board_post_daily_limit: 5 } }); }
    return "лимиты работают без БИН; пометка автора в ветке";
  });
  await run("G8", "Soft-ban × товары: у забаненного продавца купить нельзя (понятное сообщение), после снятия — можно", async (st) => {
    const pr = await addProduct(con, { name: "[QA] Товар под баном", price: "1000", stock_qty: "5" }); assert(!pr.error, pr.flash); const p = await prisma.product.findFirstOrThrow({ where: { name: "[QA] Товар под баном" } });
    const ban = await adminSoftBan(adm, conC, new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)); assert(!ban.error, ban.flash);
    try { const buy = await submit("/catalog/betonservice", aidar, (f) => f.hidden.product_id === p.id && !f.hidden.back, { qty: "1" }, { noDefaults: true }); assert(buy.error && /soft-ban|ограничен/.test(buy.flash), "покупка у забаненного: " + buy.flash); st.push(buy.flash.slice(0, 60));
      const add = await addProduct(con, { name: "[QA] Новый под баном", price: "1" }); assert(add.error && /soft-ban/.test(add.flash), "новый товар под баном: " + add.flash); }
    finally { await adminSoftBan(adm, conC, null); }
    const ok = await submit("/catalog/betonservice", aidar, (f) => f.hidden.product_id === p.id && !f.hidden.back, { qty: "1" }, { noDefaults: true }); assert(!ok.error, ok.flash); return "бан блокирует продажу и публикацию; после снятия — покупка прошла";
  });
  await run("G9", "Гость × сравнение/доска/каталог: публичное чтение работает, действия ведут к понятному входу (не к ошибке)", async (st) => {
    for (const p of ["/catalog", "/catalog/betonservice", "/board", "/board/concrete"]) { const r = await page(p); assert.equal(r.status, 200, p); }
    const cmp = await fetch(`${B}/compare`, { redirect: "manual" }); assert.equal(cmp.status, 307); assert(/\/login\?next=%2Fcompare/.test(cmp.headers.get("location") ?? ""), "гость на /compare → /login с возвратом");
    const post = await page("/board/concrete"); assert(!forms(post.html).some((f) => f.inputs.includes("title")) && /Войти/.test(post.text), "доска без входа: формы нет, есть «Войти»");
    const card = await page("/catalog/betonservice"); assert(/войти, чтобы купить/.test(card.text), "у гостя «войти, чтобы купить»"); st.push("гость: чтение ок, действия → вход"); return "гость нигде не получает ошибку";
  });
  void buyLead; void sendOffer; void adm;
}
