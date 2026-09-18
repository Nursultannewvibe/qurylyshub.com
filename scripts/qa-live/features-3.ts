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
  void registerUser; void forms; void photo; void adm;
}
