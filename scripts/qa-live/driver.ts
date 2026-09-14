/* Драйвер живого QA: ходит по задеплоенному сайту как пользователь без JS — отправляет те же формы (server actions через $ACTION_ID). */
import assert from "assert";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "../../src/server/db";

export const B = process.env.QA_BASE ?? "http://localhost:3000";
export const OTP = process.env.DEV_OTP_CODE ?? "000000";
export const DOCS = process.env.QA_DOCS ?? path.resolve(process.cwd(), "qa-docs");
export const QA = "[QA]";
let phoneSeq = Date.now() % 100000;
export const newPhone = () => `+77099${String(phoneSeq++).padStart(6, "0")}`;
export const newBin = () => String(Date.now() % 1e12).padStart(12, "0").slice(-12).replace(/^0/, "9");

export type Session = { cookie: string; phone: string; userId: string; name: string };

export function text(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/(p|div|tr|li|h1|h2|h3|form|table|section|details|summary|label|option)>/g, "\n").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

async function postJson(url: string, body: unknown) {
  const r = await fetch(`${B}${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, j: (await r.json().catch(() => ({}))) as Record<string, unknown>, cookie: (r.headers.get("set-cookie") ?? "").match(/qh_session=([^;]+)/)?.[1] };
}

/** Вход под сидовым аккаунтом через демо-переключатель (как кнопка «Войти» на /login). */
export async function loginSeed(phone: string): Promise<Session> {
  let r = await postJson("/api/auth/demo-switch", { phone });
  if (!r.cookie) r = await postJson("/api/auth/otp/verify", { phone, code: OTP }); // аккаунт вне демо-списка → обычный вход по коду
  assert(r.cookie, `login ${phone}: ${r.status} ${JSON.stringify(r.j)}`);
  const u = await prisma.user.findUniqueOrThrow({ where: { phone } });
  return { cookie: `qh_session=${r.cookie}`, phone, userId: u.id, name: u.name ?? phone };
}

/** РЕАЛЬНАЯ регистрация нового пользователя: «Получить код» → «Войти» с именем и ролью (то же, что делает форма /login). */
export async function registerUser(name: string, role: "buyer" | "supplier" | "contractor" | "supervisor"): Promise<Session> {
  const phone = newPhone();
  const rq = await postJson("/api/auth/otp/request", { phone }); assert.equal(rq.status, 200, `otp/request: ${JSON.stringify(rq.j)}`);
  const r = await postJson("/api/auth/otp/verify", { phone, code: OTP, name: `${QA} ${name}`, role });
  assert(r.cookie, `register ${phone}: ${r.status} ${JSON.stringify(r.j)}`);
  const u = await prisma.user.findUniqueOrThrow({ where: { phone } });
  return { cookie: `qh_session=${r.cookie}`, phone, userId: u.id, name: u.name ?? phone };
}

export async function page(p: string, s?: Session | null) {
  const r = await fetch(`${B}${p}`, { headers: s ? { cookie: s.cookie } : {}, redirect: "manual" });
  const html = await r.text();
  return { status: r.status, location: r.headers.get("location"), html, text: text(html) };
}

export type Form = { index: number; action: string; hidden: Record<string, string>; inputs: string[]; buttons: { name?: string; value?: string; label: string }[]; html: string };
export function forms(html: string): Form[] {
  const out: Form[] = []; const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/g; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1]; const body = m[2];
    const action = (attrs.match(/action="([^"]*)"/) ?? [])[1] ?? "";
    const hidden: Record<string, string> = {};
    for (const h of body.matchAll(/<input\b([^>]*)>/g)) { const a = h[1]; const name = (a.match(/name="([^"]*)"/) ?? [])[1]; const type = (a.match(/type="([^"]*)"/) ?? [])[1]; const value = (a.match(/value="([^"]*)"/) ?? [])[1]; if (name && type === "hidden") hidden[name] = value ?? ""; }
    const inputs = [...body.matchAll(/<(input|select|textarea)\b([^>]*)>/g)].map((x) => (x[2].match(/name="([^"]*)"/) ?? [])[1]).filter(Boolean) as string[];
    const buttons = [...body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((x) => ({ name: (x[1].match(/name="([^"]*)"/) ?? [])[1], value: (x[1].match(/value="([^"]*)"/) ?? [])[1], label: text(x[2]) }));
    out.push({ index: i++, action, hidden, inputs, buttons, html: body });
  }
  return out;
}
/** Значения по умолчанию, которые браузер отправил бы сам: отмеченные чекбоксы, первые option у select, defaultValue у input. */
export function defaults(f: Form) {
  const d: Record<string, string | string[]> = {};
  for (const inp of f.html.matchAll(/<input\b([^>]*)>/g)) {
    const a = inp[1]; const name = (a.match(/name="([^"]*)"/) ?? [])[1]; const type = (a.match(/type="([^"]*)"/) ?? [""])[1]; const value = (a.match(/value="([^"]*)"/) ?? [])[1];
    if (!name || type === "hidden" || type === "file" || type === "submit") continue;
    if (type === "checkbox" || type === "radio") { if (/\bchecked\b/.test(a)) { const v = value ?? "on"; d[name] = Array.isArray(d[name]) ? [...(d[name] as string[]), v] : d[name] ? [d[name] as string, v] : v; } continue; }
    if (value != null) d[name] = value;
  }
  for (const sel of f.html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const name = (sel[1].match(/name="([^"]*)"/) ?? [])[1]; if (!name) continue;
    const opts = [...sel[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)];
    const chosen = opts.find((o) => /\bselected\b/.test(o[1])) ?? opts[0];
    if (chosen) d[name] = (chosen[1].match(/value="([^"]*)"/) ?? [])[1] ?? text(chosen[2]);
  }
  for (const ta of f.html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) { const name = (ta[1].match(/name="([^"]*)"/) ?? [])[1]; if (name) d[name] = text(ta[2]); }
  return d;
}

export type FileField = { field: string; path: string; type?: string };
export type SubmitResult = { status: number; finalUrl: string; text: string; html: string; flash: string; error: boolean };
/** Отправить форму как браузер: hidden + значения по умолчанию + переданные поля (+файлы). Возвращает страницу после редиректов и flash. */
export async function submit(p: string, s: Session, pick: (f: Form) => boolean, fields: Record<string, string | string[]> = {}, opts: { button?: { name: string; value: string }; files?: FileField[]; noDefaults?: boolean } = {}): Promise<SubmitResult> {
  const pg = await page(p, s);
  const f = forms(pg.html).find(pick);
  if (!f) throw new Error(`форма не найдена на ${p} (статус ${pg.status}); формы: ${forms(pg.html).map((x) => x.buttons.map((b) => b.label).join("|")).join(" ; ")}`);
  const fd = new FormData();
  for (const [k, v] of Object.entries(f.hidden)) fd.append(k, v);
  const all = { ...(opts.noDefaults ? {} : defaults(f)), ...fields };
  for (const [k, v] of Object.entries(all)) for (const vv of Array.isArray(v) ? v : [v]) fd.append(k, vv);
  for (const file of opts.files ?? []) fd.append(file.field, new Blob([readFileSync(file.path)], { type: file.type ?? "application/octet-stream" }), path.basename(file.path));
  if (opts.button) fd.append(opts.button.name, opts.button.value);
  const url = f.action && !f.action.startsWith("?") ? `${B}${f.action}` : `${B}${p}`;
  let r = await fetch(url, { method: "POST", headers: { cookie: s.cookie }, body: fd, redirect: "manual" });
  let loc = r.headers.get("location"); let hops = 0; let last = loc;
  while (loc && hops++ < 6) { r = await fetch(loc.startsWith("http") ? loc : `${B}${loc}`, { headers: { cookie: s.cookie }, redirect: "manual" }); const nl = r.headers.get("location"); if (!nl) break; last = nl; loc = nl; }
  const html = await r.text();
  const q = (last ?? "").match(/[?&](ok|error)=([^&]*)/);
  const flash = q ? decodeURIComponent(q[2].replace(/\+/g, " ")) : "";
  return { status: r.status, finalUrl: (last ?? url).replace(B, ""), text: text(html), html, flash, error: q?.[1] === "error" || r.status >= 500 };
}

// ───────── доменные шаги (все — через формы UI) ─────────
export const catByCode = async (code: string) => prisma.category.findUniqueOrThrow({ where: { code } });

/** Автозаполнение формы заявки по параметрам шаблона (обязательные поля). */
export async function requestValues(categoryId: string, override: Record<string, string | string[]> = {}) {
  const tpl = await prisma.requestTemplate.findFirstOrThrow({ where: { category_id: categoryId, is_current: true }, include: { parameters: true } });
  const v: Record<string, string | string[]> = {};
  for (const p of tpl.parameters) {
    const n = `v_${p.key}`;
    if (p.field_type === "number") v[n] = p.key.includes("area") || p.key.includes("length") ? "40" : "10";
    else if (p.field_type === "select") v[n] = (p.options_json as string[])[0];
    else if (p.field_type === "multiselect") v[n] = [(p.options_json as string[])[0]];
    else if (p.field_type === "boolean") v[n] = "on";
    else if (p.field_type === "text") v[n] = p.key === "sizes" ? "1200×1400 ×4" : "тест QA";
  }
  return { ...v, ...override };
}

export async function createProject(s: Session, input: Record<string, string>) {
  const r = await submit("/projects/new", s, (f) => f.inputs.includes("object_type"), { name: `${QA} ${input.name}`, ...input });
  assert(!r.error, `создание объекта: ${r.flash}`);
  const id = r.finalUrl.match(/projects\/([a-z0-9]+)/)?.[1]; assert(id, `нет id объекта: ${r.finalUrl}`);
  return { id, flash: r.flash };
}

export async function createRequest(s: Session, projectId: string, categoryCode: string, opts: { target?: string; override?: Record<string, string | string[]> } = {}) {
  const cat = await catByCode(categoryCode);
  const p = `/projects/${projectId}/requests/new?category=${cat.id}${opts.target ? "&target=" + opts.target : ""}`;
  const pg = await page(p, s); assert.equal(pg.status, 200, `форма заявки ${categoryCode}: ${pg.status}`);
  assert(pg.text.includes(`Заявка: ${cat.name}`), `форма открылась не для «${cat.name}»: ${pg.text.match(/Заявка: [^\n]*/)?.[0]}`);
  const r = await submit(p, s, (f) => f.inputs.some((i) => i.startsWith("v_")) && f.buttons.some((b) => /Опубликовать|Отправить запрос/.test(b.label)), await requestValues(cat.id, opts.override));
  assert(!r.error, `публикация заявки ${categoryCode}: ${r.flash}`);
  const id = r.finalUrl.match(/requests\/([a-z0-9]+)/)?.[1]; assert(id, `нет id заявки: ${r.finalUrl} ${r.flash}`);
  return { id, flash: r.flash, cat };
}

export async function buyLead(s: Session, requestId: string) {
  const lead = await prisma.lead.findFirstOrThrow({ where: { request_id: requestId, company: { members: { some: { user_id: s.userId } } } } });
  if (lead.status === "purchased") return { flash: "уже куплен (бесплатный)" };
  const r = await submit("/supplier/leads", s, (f) => f.hidden.lead_id === lead.id && f.buttons.some((b) => b.label === "Купить"), {}, { button: { name: "action", value: "purchase" } });
  assert(!r.error, `покупка лида: ${r.flash}`);
  return { flash: r.flash };
}
export async function declineLead(s: Session, requestId: string) {
  const lead = await prisma.lead.findFirstOrThrow({ where: { request_id: requestId, company: { members: { some: { user_id: s.userId } } } } });
  return submit("/supplier/leads", s, (f) => f.hidden.lead_id === lead.id, {}, { button: { name: "action", value: "decline" } });
}
export type OfferInput = { scope?: "material_and_work" | "material_only" | "install_only"; material?: number; work?: number; delivery?: number; days?: number; warranty?: string; template?: boolean };
export async function sendOffer(s: Session, requestId: string, o: OfferInput = {}) {
  const scope = o.scope ?? "material_and_work";
  const fields: Record<string, string> = { offer_scope: scope, work_cost: String(o.work ?? 150000), delivery_cost: String(o.delivery ?? (scope === "install_only" ? 0 : 10000)), delivery_days: "5", execution_days: String(o.days ?? 7), warranty: o.warranty ?? "1 год", valid_days: "14", mismatch_notes: "" };
  if (scope !== "install_only") { fields.m_name_0 = "Материал QA"; fields.m_qty_0 = "10"; fields.m_unit_0 = "шт"; fields.m_price_0 = String(o.material ?? 30000); }
  if (o.template) { fields.save_template = "on"; fields.template_name = "QA шаблон"; }
  const r = await submit(`/supplier/offers/new?request=${requestId}`, s, (f) => f.inputs.includes("offer_scope"), fields, { noDefaults: true });
  return r;
}
export async function declineOffer(s: Session, requestId: string) {
  return submit(`/supplier/offers/new?request=${requestId}`, s, (f) => f.inputs.includes("offer_scope"), { offer_scope: "install_only", work_cost: "1" }, { button: { name: "action", value: "decline" }, noDefaults: true });
}
export async function createDeal(s: Session, requestId: string, companyId?: string) {
  const pg = await page(`/requests/${requestId}`, s);
  const f = forms(pg.html).find((x) => x.buttons.some((b) => b.label.includes("Создать сделку"))); assert(f, "нет формы создания сделки (нет КП со статусом «отправлено»?)");
  let sel = [...f.html.matchAll(/name="select" value="([^"]+)"/g)].map((m) => m[1]);
  if (companyId) { const offers = await prisma.offer.findMany({ where: { request_id: requestId, company_id: companyId, status: "sent" } }); sel = sel.filter((v) => offers.some((o) => v.startsWith(o.id))); }
  else { const first = sel[0].split(":")[0]; sel = sel.filter((v) => v.startsWith(first)); }
  const r = await submit(`/requests/${requestId}`, s, (x) => x.buttons.some((b) => b.label.includes("Создать сделку")), { select: sel }, { noDefaults: true });
  assert(!r.error, `создание сделки: ${r.flash}`);
  const id = r.finalUrl.match(/deals\/([a-z0-9]+)/)?.[1]; assert(id, `нет id сделки: ${r.finalUrl}`);
  return { id, flash: r.flash };
}
const P = (id: string) => `/deals/${id}`;
export const payMilestone = (s: Session, dealId: string) => submit(P(dealId), s, (f) => f.buttons.some((b) => b.label.startsWith("Оплатить")), {});
export const startWork = (s: Session, dealId: string) => submit(P(dealId), s, (f) => f.buttons.some((b) => b.label === "Начать работы"), {});
export const submitMilestone = (s: Session, dealId: string) => submit(P(dealId), s, (f) => f.buttons.some((b) => b.label === "Сдать этап"), {});
export async function fillChecklist(s: Session, dealId: string, photoPath: string) {
  const pg = await page(P(dealId), s); const fs = forms(pg.html).filter((f) => f.inputs.includes("item_id"));
  let n = 0;
  for (const f of fs) { const r = await submit(P(dealId), s, (x) => x.inputs.includes("item_id") && x.hidden.item_id === f.hidden.item_id && x.hidden.milestone_id === f.hidden.milestone_id, { checked: "on" }, { files: [{ field: "photo", path: photoPath, type: "image/png" }] }); assert(!r.error, `чек-лист: ${r.flash}`); n++; }
  return n;
}
export const acceptMilestone = (s: Session, dealId: string, amount?: number) => submit(P(dealId), s, (f) => f.buttons.some((b) => b.label.startsWith("Принять")), amount ? { accepted_amount: String(amount) } : {}, { noDefaults: true });
export async function signAct(s: Session, dealId: string) { return submit(P(dealId), s, (f) => f.inputs.includes("act_id") && !f.inputs.includes("conclusion") && f.buttons.some((b) => /Подписать/.test(b.label)), {}); }
export const review = (s: Session, dealId: string, rating = 5, txt = "QA: всё хорошо", photo?: string) => submit(P(dealId), s, (f) => f.inputs.includes("rating") && f.buttons.some((b) => b.label.includes("отзыв")), { rating: String(rating), text: `${txt} #${dealId.slice(-6)}` }, photo ? { files: [{ field: "photo", path: photo, type: "image/png" }] } : {});
export const rateBuyer = (s: Session, dealId: string) => submit(P(dealId), s, (f) => f.inputs.includes("rating") && f.buttons.some((b) => b.label === "Оценить"), { rating: "5", text: "QA" });
export const openDispute = (s: Session, dealId: string, reason = "QA: спор по качеству", category = "quality") => submit(P(dealId), s, (f) => f.inputs.includes("reason") && f.buttons.some((b) => b.label === "Открыть спор"), { reason, category }, { noDefaults: true });
export const cancelDeal = (s: Session, dealId: string) => submit(P(dealId), s, (f) => f.buttons.some((b) => b.label.startsWith("Отменить сделку")), {});
export const warranty = (s: Session, dealId: string) => submit(P(dealId), s, (f) => f.inputs.includes("description") && f.buttons.some((b) => b.label === "Претензия"), { description: "QA: гарантийный дефект" });
export const warrantyStatus = (s: Session, dealId: string, status: string) => submit(P(dealId), s, (f) => f.inputs.includes("claim_id"), {}, { button: { name: "status", value: status } });
export const supervisorConclusion = (s: Session, dealId: string) => submit(P(dealId), s, (f) => f.inputs.includes("conclusion"), { conclusion: "QA: замечаний нет" });

// админ
export const adminResolveDispute = (adm: Session, disputeId: string, outcome: "resolved" | "rejected", release = false, share = "1") => submit("/admin", adm, (f) => f.hidden.dispute_id === disputeId && f.inputs.includes("resolution"), { resolution: "QA решение", ...(release ? { release: "on" } : {}), share }, { button: { name: "outcome", value: outcome }, noDefaults: true });
export const adminVerify = (adm: Session, verificationId: string, status: "verified" | "rejected", validUntil?: string) => submit("/admin", adm, (f) => f.hidden.verification_id === verificationId, validUntil ? { valid_until: validUntil } : {}, { button: { name: "status", value: status } });
export const adminJob = (adm: Session, job: string) => submit("/admin", adm, (f) => f.hidden.job === job, {});
export const adminAssign = (adm: Session, requestId: string, companyId: string) => submit("/admin", adm, (f) => f.hidden.action === "assign_lead" && f.hidden.request_id === requestId, { company_id: companyId, price: "0" });
export const adminSoftBan = (adm: Session, companyId: string, until: string | null) => until ? submit("/admin", adm, (f) => f.hidden.action === "soft_ban" && f.inputs.includes("until") && !f.hidden.company_id, { company_id: companyId, until, reason: "QA бан" }) : submit("/admin", adm, (f) => f.hidden.action === "soft_ban" && f.hidden.company_id === companyId, {});
export const adminPayout = (adm: Session, payoutId: string, op: "approve" | "complete" | "reject") => submit("/admin", adm, (f) => f.hidden.payout_id === payoutId, {}, { button: { name: "op", value: op } });

// онбординг компании
export type CompanyInput = { name: string; legal_type: "ip" | "too" | "self_employed"; role: "supplier" | "contractor" | "buyer"; doc: string; docType?: string; categories: string[]; radius?: string; lat?: string; lng?: string };
export async function registerCompany(s: Session, c: CompanyInput) {
  const r = await submit("/settings", s, (f) => f.inputs.includes("bin"), { name: `${QA} ${c.name}`, legal_type: c.legal_type, bin: newBin(), role: c.role, scale: "small", tax_status: "non_vat", bank_account: "KZ00QA0000000000001", region: "almaty", city: "Алматы", lat: c.lat ?? "43.238", lng: c.lng ?? "76.945", radius: c.radius ?? "60", consent: "on" }, { files: [{ field: "registration_doc", path: c.doc, type: c.docType }], noDefaults: true });
  if (r.error) return { company: null, flash: r.flash, r };
  const company = await prisma.company.findFirstOrThrow({ where: { members: { some: { user_id: s.userId } } }, orderBy: { created_at: "desc" } });
  if (c.role !== "buyer") {
    const cats = await prisma.category.findMany({ where: { code: { in: c.categories } } });
    const set = await submit("/supplier/settings", s, (f) => f.inputs.includes("daily_lead_limit"), { description: "QA компания", bank_account: "KZ00QA0000000000001", daily_lead_limit: "10", pitch_daily_limit: "5", pitch_cooldown_days: "7", service_center_lat: c.lat ?? "43.238", service_center_lng: c.lng ?? "76.945", service_radius_km: c.radius ?? "60", service_area_polygon: "", categories: cats.map((k) => k.id), is_public: "on" }, { noDefaults: true });
    assert(!set.error, `настройки компании: ${set.flash}`);
  }
  return { company, flash: r.flash, r };
}
export const uploadVerification = (s: Session, docType: string, categoryId: string | "", file: string, validUntil = "2028-12-31", type?: string) => submit("/supplier/settings", s, (f) => f.inputs.includes("doc_type"), { doc_type: docType, category_id: categoryId, valid_until: validUntil }, { files: [{ field: "doc", path: file, type }], noDefaults: true });
export const topUp = (s: Session, amount: number) => submit("/supplier/wallet", s, (f) => f.inputs.includes("idempotency_key") && f.inputs.includes("amount"), { amount: String(amount) });
export const requestPayout = (s: Session, amount: number) => submit("/supplier/wallet", s, (f) => f.inputs.includes("bank_account") && f.inputs.includes("amount"), { amount: String(amount) }, { noDefaults: true });

/** Счастливый цикл: заявка уже есть → поставщик покупает лид → КП → сделка → по КАЖДОМУ этапу: оплата → работы → чек-лист → приёмка → акт (2 подписи) → отзыв. */
export async function happyCycle(buyer: Session, seller: Session, requestId: string, photo: string, opts: { offer?: OfferInput; sellerCompanyId?: string; rating?: number } = {}) {
  const steps: string[] = [];
  const b = await buyLead(seller, requestId); steps.push(`лид: ${b.flash}`);
  const o = await sendOffer(seller, requestId, opts.offer); assert(!o.error, `КП: ${o.flash}`); steps.push(`КП: ${o.flash}`);
  const d = await createDeal(buyer, requestId, opts.sellerCompanyId); steps.push(`сделка: ${d.flash}`);
  const ms = await prisma.milestone.findMany({ where: { deal_id: d.id }, orderBy: { order_index: "asc" } });
  for (const [i, m] of ms.entries()) {
    const pay = await payMilestone(buyer, d.id); assert(!pay.error && /succeeded/.test(pay.flash), `оплата этапа ${i + 1}: ${pay.flash}`);
    if (i === 0) { const st = await startWork(seller, d.id); assert(!st.error, `начать: ${st.flash}`); }
    const sb = await submitMilestone(seller, d.id); assert(!sb.error, `сдать этап ${i + 1}: ${sb.flash}`);
    const n = await fillChecklist(buyer, d.id, photo);
    const ac = await acceptMilestone(buyer, d.id); assert(!ac.error && /принят/.test(ac.flash), `приёмка этапа ${i + 1}: ${ac.flash}`);
    steps.push(`этап ${i + 1} «${m.name}»: оплачен → сдан → чек-лист (${n}) → ${ac.flash.slice(0, 60)}`);
  }
  const acts = await prisma.act.findMany({ where: { deal_id: d.id, act_type: "acceptance" } });
  for (const _ of acts) { const s1 = await signAct(buyer, d.id); assert(!s1.error, `подпись заказчика: ${s1.flash}`); }
  for (const _ of acts) { const s2 = await signAct(seller, d.id); assert(!s2.error && /обеими/.test(s2.flash), `подпись исполнителя: ${s2.flash}`); }
  steps.push(`актов подписано обеими сторонами: ${acts.length}`);
  for (const act of acts) { const doc = await page(act.file_url!, buyer); assert.equal(doc.status, 200, `документ акта ${act.file_url}: ${doc.status}`); assert(doc.html.includes("АКТ"), "акт без содержимого"); }
  const rv = await review(buyer, d.id, opts.rating ?? 5, "QA: отличная работа", photo); assert(!rv.error && /верифицированный/.test(rv.flash), `отзыв: ${rv.flash}`); steps.push("отзыв verified");
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: d.id } }); assert.equal(deal.status, "completed");
  const rep = await prisma.companyReputation.findUniqueOrThrow({ where: { company_id: deal.seller_id } }); assert(rep.avg_rating > 0, "рейтинг не пересчитан");
  return { dealId: d.id, steps, sellerId: deal.seller_id };
}
