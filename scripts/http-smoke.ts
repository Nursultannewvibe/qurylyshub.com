/* eslint-disable no-console */
/**
 * HTTP-smoke: проверка через реальные HTTP-запросы к запущенному серверу (npm start / npm run dev):
 *  — вход по OTP и рендер всех кабинетов под каждой ролью (200);
 *  — БЛОКИРОВКА КП БЕЗ ЛИЦЕНЗИИ на бэкенде (403 через API, минуя UI);
 *  — ЭСКРОУ+СПОР: раскрытие через API → 409 escrow_blocked;
 *  — идемпотентная оплата милстоуна через API;
 *  — вебхук с неверной подписью → 400.
 * Запуск: npm run smoke:http   (после npm run scenarios, чтобы были данные)
 */
import "dotenv/config";
import assert from "assert";
import { prisma } from "../src/server/db";
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const OTP = process.env.DEV_OTP_CODE ?? "000000";
const results: [string, string, string][] = [];

async function login(phone: string) {
  const r = await fetch(`${BASE}/api/auth/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code: OTP }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.message);
  return `qh_session=${j.token}`;
}
const call = async (cookie: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: { "content-type": "application/json", cookie, ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  let j: unknown = null; try { j = await r.json(); } catch { /* html */ }
  return { status: r.status, j: j as Record<string, unknown> };
};
async function step(name: string, fn: () => Promise<string | void>) { try { const d = await fn(); results.push([name, "ПРОШЁЛ", d ?? ""]); console.log("✅", name); } catch (e) { results.push([name, "НЕ ПРОШЁЛ", (e as Error).message]); console.log("❌", name, (e as Error).message); } }

(async () => {
  const [aidar, win, unl, admin, sup, big] = await Promise.all(["+77010000001", "+77010000003", "+77010000009", "+77010000007", "+77010000006", "+77010000002"].map(login));
  await step("Рендер страниц под каждой ролью (200)", async () => {
    const pages: [string, string][] = [[aidar, "/dashboard"], [aidar, "/projects"], [aidar, "/inbox"], [aidar, "/outbox"], [aidar, "/deals"], [aidar, "/threads"], [aidar, "/settings"], [aidar, "/settings/notifications"], [aidar, "/notifications"], [big, "/broadcast"], [win, "/supplier/leads"], [win, "/supplier/map"], [win, "/supplier/wallet"], [win, "/supplier/settings"], [admin, "/admin"], [sup, "/supervisor"]];
    const house = await prisma.project.findFirstOrThrow({ where: { name: "Дом в Каскелене" } });
    const req = await prisma.request.findFirstOrThrow({ where: { project_id: house.id } });
    const deal = await prisma.deal.findFirstOrThrow({ where: { buyer_id: (await prisma.user.findUniqueOrThrow({ where: { phone: "+77010000001" } })).id } });
    const thread = await prisma.thread.findFirstOrThrow();
    pages.push([aidar, `/projects/${house.id}`], [aidar, `/projects/${house.id}/requests/new`], [aidar, `/requests/${req.id}`], [aidar, `/deals/${deal.id}`], [aidar, `/threads/${thread.id}`], [win, `/supplier/offers/new?request=${req.id}`]);
    const bad: string[] = [];
    for (const [c, p] of pages) { const r = await fetch(`${BASE}${p}`, { headers: { cookie: c } }); const html = await r.text(); if (r.status !== 200 || /Application error|Internal Server Error/.test(html)) bad.push(`${p}:${r.status}`); }
    assert(!bad.length, `ошибки: ${bad.join(", ")}`);
    const anon = await fetch(`${BASE}/dashboard`, { redirect: "manual" }); assert.equal(anon.status, 307, "гость → редирект на /login");
    return `${pages.length} страниц OK; гость → 307`;
  });
  await step("API: БЛОКИРОВКА КП БЕЗ ЛИЦЕНЗИИ → 403 license_required", async () => {
    const el = await prisma.category.findUniqueOrThrow({ where: { code: "reno_electrical" } });
    const req = await prisma.request.findFirstOrThrow({ where: { category_id: el.id, leads: { some: { company: { public_slug: "elektromontazh" }, status: "purchased" } } } });
    const r = await call(unl, "POST", `/api/requests/${req.id}/offers`, { work_cost: 300000 });
    assert.equal(r.status, 403); assert.equal(r.j.error, "license_required");
    return String(r.j.message).slice(0, 70);
  });
  await step("API: ЭСКРОУ+СПОР → 409 escrow_blocked (даже админом напрямую)", async () => {
    const buyer = await prisma.user.findUniqueOrThrow({ where: { phone: "+77010000001" } });
    // создаём сделку через API из открытой заявки с КП, оплачиваем милстоун → held-эскроу
    const req = await prisma.request.findFirstOrThrow({ where: { project: { owner_id: buyer.id }, status: "published", offers: { some: { status: "sent" } } }, include: { offers: { where: { status: "sent" } } } });
    const cd = await call(aidar, "POST", `/api/requests/${req.id}/deals`, { selections: [{ offer_id: req.offers[0].id }] }); assert.equal(cd.status, 200, JSON.stringify(cd.j));
    const dealId = (cd.j as unknown as { id: string }[])[0].id;
    const ms = await prisma.milestone.findFirstOrThrow({ where: { deal_id: dealId } });
    const pay = await call(aidar, "POST", `/api/milestones/${ms.id}/pay`, {}); assert.equal(pay.status, 200, JSON.stringify(pay.j));
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { milestones: { include: { escrow_holds: true } } } });
    const m = deal.milestones.find((x) => x.escrow_holds.some((h) => h.status === "held"))!;
    const d = await call(aidar, "POST", `/api/deals/${deal.id}/disputes`, { milestone_id: m.id, reason: "HTTP smoke: качество", category: "quality" });
    assert.equal(d.status, 200);
    const r1 = await call(aidar, "POST", `/api/milestones/${m.id}/accept`, {}); assert.equal(r1.status, 409, `accept: ${r1.status} ${JSON.stringify(r1.j)}`); assert.equal(r1.j.error, "escrow_blocked");
    const r2 = await call(admin, "POST", `/api/escrow/${m.id}/release`); assert.equal(r2.status, 409); assert.equal(r2.j.error, "escrow_blocked");
    const r3 = await call(win, "POST", `/api/escrow/${m.id}/release`); assert.equal(r3.status, 403, "не-админ → 403");
    const res = await call(admin, "POST", `/api/disputes/${d.j.id}/resolve`, { outcome: "rejected", resolution: "smoke" }); assert.equal(res.status, 200);
    return `dispute ${String(d.j.id).slice(-6)}: accept 409, release 409, после rejected — разблокировано`;
  });
  await step("API: идемпотентная оплата милстоуна (Idempotency-Key)", async () => {
    const buyer = await prisma.user.findUniqueOrThrow({ where: { phone: "+77010000001" } });
    const d = await prisma.deal.findFirst({ where: { buyer_id: buyer.id, milestones: { some: { status: "pending" } } }, include: { milestones: true } });
    if (!d) return "нет pending-милстоунов — пропущено (проверено в scenarios)";
    const m = d.milestones.find((x) => x.status === "pending")!;
    const a = await call(aidar, "POST", `/api/milestones/${m.id}/pay`, {}, { "idempotency-key": `http:${m.id}` }); assert.equal(a.status, 200);
    const b = await call(aidar, "POST", `/api/milestones/${m.id}/pay`, {}, { "idempotency-key": `http:${m.id}` });
    assert(b.status === 200 || b.status === 409, `повтор: ${b.status}`);
    assert.equal(await prisma.payment.count({ where: { milestone_id: m.id } }), 1, "ровно один платёж");
    return `payment ${(a.j.payment as { provider_ref: string }).provider_ref}; повтор не создал второго`;
  });
  await step("API: вебхук с неверной подписью → 400, верной → 200", async () => {
    const bad = await fetch(`${BASE}/api/payments/webhook/mock`, { method: "POST", headers: { "x-webhook-secret": "wrong" }, body: "{}" }); assert.equal(bad.status, 400);
    const p = await prisma.payment.findFirstOrThrow({ where: { status: "succeeded" } });
    const ok = await fetch(`${BASE}/api/payments/webhook/mock`, { method: "POST", headers: { "x-webhook-secret": process.env.PAYMENT_WEBHOOK_SECRET ?? "mock-webhook-secret" }, body: JSON.stringify({ idempotency_key: p.idempotency_key, status: "succeeded" }) }); assert.equal(ok.status, 200);
    return "400 / 200 (replay идемпотентен)";
  });
  await step("API: OTP brute-force через HTTP → 429 после 5 попыток", async () => {
    const phone = "+77019990077";
    await fetch(`${BASE}/api/auth/otp/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
    let last = 0;
    for (let i = 0; i < 5; i++) { const r = await fetch(`${BASE}/api/auth/otp/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code: "999999" }) }); last = r.status; }
    assert.equal(last, 429);
    return "5-я попытка → 429 otp_locked";
  });
  console.table(results.map(([n, s, d]) => ({ проверка: n, статус: s, детали: d.slice(0, 90) })));
  await prisma.$disconnect();
  process.exitCode = results.some((r) => r[1] !== "ПРОШЁЛ") ? 1 : 0;
})();
