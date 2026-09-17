/* Продолжение сценариев раздела 6: доска, товары, логистика, связка. */
import assert from "assert";
import { prisma } from "../../src/server/db";
import type * as D from "./driver";
import { B, page, submit, forms, registerUser, registerCompany, catByCode } from "./driver";
export type Ctx = { run: (id: string, title: string, fn: (st: string[]) => Promise<string | void>) => Promise<void>; aidar: D.Session; adm: D.Session; house: { id: string }; flat: { id: string }; photo: string; cid: (s: D.Session) => Promise<string> };

export async function run({ run, aidar, adm, photo, cid }: Ctx) {
  // ══════════ 2. ДОСКА ОБСУЖДЕНИЙ ══════════
  await run("F2", "Доска: чтение без входа, пост только после входа, лимит постов, жалоба → админ → удалено/оставлено", async (st) => {
    const anon = await page("/board/concrete"); assert.equal(anon.status, 200, "чтение без входа"); assert(!forms(anon.html).some((f) => f.inputs.includes("title")), "формы поста без входа нет"); assert(anon.text.includes("Войти"), "предложение войти"); st.push("без входа: читается, формы нет");
    const idx = await page("/board"); assert.equal(idx.status, 200); assert(idx.text.includes("Категории"));
    // пост от пользователя
    const p1 = await submit("/board/concrete/kaskelen", aidar, (f) => f.inputs.includes("title"), { title: "[QA] Сколько стоит лента под баню?", body: "QA: баня 6×4, грунт обычный, Каскелен." }, { noDefaults: true }); assert(!p1.error && /Ветка создана/.test(p1.flash), p1.flash);
    const pid = p1.finalUrl.match(/post\/([a-z0-9]+)/)?.[1]!; st.push("ветка создана " + pid.slice(-6));
    const pub = await page(`/board/post/${pid}`); assert.equal(pub.status, 200); assert(pub.text.includes("[QA] Сколько стоит лента"), "ветка публично читается");
    // ответ от компании (БетонСервис)
    const con = await (await import("./driver")).loginSeed("+77010000004");
    const r1 = await submit(`/board/post/${pid}`, con, (f) => f.inputs.includes("body") && !f.inputs.includes("title") && !f.inputs.includes("reason"), { body: "QA ответ: около 28 тыс за м.п. с работой." }); assert(!r1.error, r1.flash);
    const withReply = await page(`/board/post/${pid}`); assert(withReply.text.includes("БетонСервис") && withReply.text.includes("QA ответ"), "ответ компании виден с именем компании"); st.push("ответ БетонСервис виден");
    // лимит постов пользователя (5/день): aidar уже создал 1 → ещё 4 ок, 6-й — отказ
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); const already = await prisma.boardPost.count({ where: { author_id: aidar.userId, created_at: { gte: dayStart } } });
    for (let i = already + 1; i <= 5; i++) { const r = await submit("/board/concrete", aidar, (f) => f.inputs.includes("title"), { title: `[QA] пост ${i}`, body: "QA" }, { noDefaults: true }); assert(!r.error, `пост ${i}: ${r.flash}`); }
    const over = await submit("/board/concrete", aidar, (f) => f.inputs.includes("title"), { title: "[QA] пост 6", body: "QA" }, { noDefaults: true }); assert(over.error && /лимит/i.test(over.flash), "6-й пост отклонён понятно: " + over.flash); st.push("лимит: " + over.flash.slice(0, 60));
    // лимит компании: фикстура board_post_daily_limit=1 у БетонСервис
    const conC = await cid(con); const todayCo = await prisma.boardPost.count({ where: { company_id: conC, created_at: { gte: dayStart } } });
    await prisma.company.update({ where: { id: conC }, data: { board_post_daily_limit: todayCo + 1 } }); // фикстура: лимит = уже_сегодня + 1
    try {
      const c1 = await submit("/board/concrete", con, (f) => f.inputs.includes("title"), { title: "[QA] от компании 1", body: "QA", company_id: conC }, { noDefaults: true }); assert(!c1.error, c1.flash);
      const c2 = await submit("/board/concrete", con, (f) => f.inputs.includes("title"), { title: "[QA] от компании 2", body: "QA", company_id: conC }, { noDefaults: true }); assert(c2.error && /компании/.test(c2.flash), "лимит компании: " + c2.flash); st.push("лимит компании: " + c2.flash.slice(0, 60));
    } finally { await prisma.company.update({ where: { id: conC }, data: { board_post_daily_limit: 5 } }); }
    // жалобы: на пост → удалить; на ответ → оставить
    const rep = await submit(`/board/post/${pid}`, con, (f) => f.hidden.target_type === "post", { reason: "QA: спам" }); assert(!rep.error, rep.flash);
    const reply = await prisma.boardReply.findFirstOrThrow({ where: { post_id: pid } });
    const rep2 = await submit(`/board/post/${pid}`, aidar, (f) => f.hidden.target_id === reply.id, { reason: "QA: не по теме" }); assert(!rep2.error, rep2.flash);
    const ap = await page("/admin", adm); assert(ap.text.includes("QA: спам") && ap.text.includes("QA: не по теме"), "обе жалобы у админа");
    const reports = await prisma.boardReport.findMany({ where: { target_id: { in: [pid, reply.id] }, status: "open" } });
    const rj = await submit("/admin", adm, (f) => f.hidden.report_id === reports.find((r) => r.target_id === reply.id)!.id, {}, { button: { name: "outcome", value: "rejected" } }); assert(!rj.error, rj.flash);
    const rs = await submit("/admin", adm, (f) => f.hidden.report_id === reports.find((r) => r.target_id === pid)!.id, { resolution: "QA удалено" }, { button: { name: "outcome", value: "resolved" } }); assert(!rs.error, rs.flash);
    const gone = await page(`/board/post/${pid}`); assert.equal(gone.status, 404, "удалённая ветка → 404"); assert.equal(await prisma.boardReply.count({ where: { id: reply.id } }), 0, "ответ удалён вместе с веткой");
    const n = await prisma.notification.findFirst({ where: { user_id: adm.userId, type: "board.report" } }); assert(n, "админ уведомлён о жалобе");
    return "чтение публично; пост/ответ после входа; лимиты пользователя и компании; жалобы решены (удалено/оставлено)";
  });
  // ══════════ 3. КАТАЛОГ ТОВАРОВ ══════════
  await run("F3", "Товар: покупка со stock_qty → сделка product_purchase → оплата → получено → завершено → отзыв; параллельная покупка последней единицы; товар под заказ", async (st) => {
    const con = await (await import("./driver")).loginSeed("+77010000004"); const conC = await cid(con);
    const concrete = await catByCode("concrete");
    const add = await submit("/supplier/products", con, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: concrete.id, name: "[QA] Бетон М300 (последний куб)", description: "QA", unit: "м³", price: "34000", min_order_qty: "1", stock_qty: "1" }, { noDefaults: true }); assert(!add.error, add.flash); st.push(add.flash);
    const prod = await prisma.product.findFirstOrThrow({ where: { company_id: conC, name: { startsWith: "[QA] Бетон М300" } } });
    const card = await page("/catalog/betonservice", aidar); assert(card.text.includes("[QA] Бетон М300") && card.text.includes("Купить"), "товар с кнопкой «Купить» в карточке");
    // две параллельные покупки последней единицы — проходит одна
    const buyer2 = await registerUser("Покупатель 2", "buyer");
    const [r1, r2] = await Promise.all([aidar, buyer2].map((u) => submit("/catalog/betonservice", u, (f) => f.hidden.product_id === prod.id, { qty: "1" }, { noDefaults: true })));
    const okOnes = [r1, r2].filter((r) => !r.error); const failed = [r1, r2].filter((r) => r.error);
    assert.equal(okOnes.length, 1, `должна пройти ровно одна покупка: ${r1.flash} | ${r2.flash}`); assert(/закончился|только/.test(failed[0].flash), "вторая — понятный отказ: " + failed[0].flash); st.push("параллельно: 1 успех, отказ «" + failed[0].flash.slice(0, 40) + "»");
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: prod.id } })).stock_qty, 0, "остаток 0");
    const winner = okOnes[0] === r1 ? aidar : buyer2; const did = okOnes[0].finalUrl.match(/deals\/([a-z0-9]+)/)?.[1]!;
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: did }, include: { milestones: true, escrow_holds: true, acts: true } }); assert.equal(deal.deal_type, "product_purchase"); assert.equal(Number(deal.amount), 34000); assert.equal(deal.commission_percent.toString(), "5"); assert.equal(deal.milestones.length + deal.escrow_holds.length + deal.acts.length, 0, "без milestones/escrow/acts");
    const pay = await submit(`/deals/${did}`, winner, (f) => f.buttons.some((b) => /Оплатить/.test(b.label)), {}); assert(!pay.error && /succeeded/.test(pay.flash), pay.flash);
    const pay2 = await page(`/deals/${did}`, winner); assert(!pay2.text.includes("Оплатить"), "повторной кнопки оплаты нет"); assert(pay2.text.includes("Товар получен"), "кнопка «Товар получен»");
    const sv = await page(`/deals/${did}`, con); assert(sv.text.includes("Оплачено. Отгрузите"), "продавец видит «оплачено, отгружайте»");
    const before = Number((await prisma.wallet.findUniqueOrThrow({ where: { company_id: conC } })).balance);
    const rc = await submit(`/deals/${did}`, winner, (f) => f.buttons.some((b) => b.label === "Товар получен"), {}); assert(!rc.error, rc.flash); st.push(rc.flash.slice(0, 60));
    assert.equal((await prisma.deal.findUniqueOrThrow({ where: { id: did } })).status, "completed"); assert.equal(Number((await prisma.wallet.findUniqueOrThrow({ where: { company_id: conC } })).balance), before + 32300, "продавцу 34000 − 5%");
    const rv = await submit(`/deals/${did}`, winner, (f) => f.inputs.includes("rating"), { rating: "5", text: "QA товар отличный" }); assert(!rv.error && /верифицированный/.test(rv.flash), rv.flash); st.push("отзыв verified");
    // товар под заказ: stock_qty=null — любое количество
    const add2 = await submit("/supplier/products", con, (f) => f.inputs.includes("name") && f.inputs.includes("price"), { category_id: concrete.id, name: "[QA] Бетон под заказ", unit: "м³", price: "30000", min_order_qty: "5", stock_qty: "" }, { noDefaults: true }); assert(!add2.error, add2.flash);
    const p2 = await prisma.product.findFirstOrThrow({ where: { name: "[QA] Бетон под заказ" } }); assert.equal(p2.stock_qty, null);
    const low = await submit("/catalog/betonservice", aidar, (f) => f.hidden.product_id === p2.id, { qty: "2" }, { noDefaults: true }); assert(low.error && /Минимальный заказ/.test(low.flash), "мин. заказ: " + low.flash);
    const big = await submit("/catalog/betonservice", aidar, (f) => f.hidden.product_id === p2.id, { qty: "500" }, { noDefaults: true }); assert(!big.error, big.flash); const d2 = await prisma.deal.findUniqueOrThrow({ where: { id: big.finalUrl.match(/deals\/([a-z0-9]+)/)![1] } }); assert.equal(Number(d2.amount), 15_000_000); assert.equal(d2.commission_percent.toString(), "1", "шкала комиссии: 15 млн → 1%");
    return "stock 1: атомарно 1 из 2; цикл created→paid→received→completed без эскроу; отзыв; под заказ: 500 м³, комиссия 1%";
  });
  void B; void registerCompany; void photo;
}
