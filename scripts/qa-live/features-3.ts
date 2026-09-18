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
    for (const col of ["Продавец", "Цена", "Ед.", "Остаток", "Рейтинг продавца", "Срок поставки"]) assert(cp.text.includes(col), "колонка " + col); assert((cp.html.match(/>Купить</g) ?? []).length >= 4, "ссылки «Купить»"); assert(cp.html.includes(`#product-${five[0].id}`), "ссылка ведёт на товар в карточке");
    const rm = await submit("/compare", aidar, (f) => f.hidden.product_id === five[0].id, {}); assert(!rm.error, rm.flash); assert.equal(await prisma.comparisonItem.count({ where: { user_id: aidar.userId } }), 4);
    // другая роль (поставщик) — свой список
    const sup = await loginSeed("+77010000003"); const sa = await add(sup, "betonservice", prods[0].id); assert(!sa.error && /\(1\)/.test(sa.flash), "поставщик тоже может сравнивать: " + sa.flash);
    const cl = await submit("/compare", aidar, (f) => f.buttons.some((b) => b.label === "Очистить список"), {}); assert(!cl.error, cl.flash); assert.equal(await prisma.comparisonItem.count({ where: { user_id: aidar.userId } }), 0); assert.equal(await prisma.comparisonItem.count({ where: { user_id: sup.userId } }), 1, "список поставщика не затронут");
    return "гость → вход; одна категория; лимит 5; min/max подсвечены; купить/убрать/очистить; списки по user_id";
  });
  void registerUser; void photo; void adm;
}
