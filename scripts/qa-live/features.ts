/* Живые сценарии раздела 6 (новые фичи): физлицо-исполнитель, доска, товары, логистика, связка. Запуск как index.ts. */
import "dotenv/config";
import assert from "assert";
import path from "path";
import { prisma } from "../../src/server/db";
import * as D from "./driver";
import { B, DOCS, page, submit, forms, loginSeed, registerUser, registerCompany, createProject, createRequest, buyLead, sendOffer, happyCycle, catByCode, adminAssign, topUp } from "./driver";

type Row = { id: string; title: string; steps: string[]; result: string; finding: string | null };
const rows: Row[] = []; const only = process.argv[2];
async function run(id: string, title: string, fn: (st: string[]) => Promise<string | void>) {
  if (only && !id.startsWith(only)) return;
  const st: string[] = [];
  try { const r = await fn(st); rows.push({ id, title, steps: st, result: r ?? "ок", finding: null }); console.log(`✅ ${id} ${title}`); }
  catch (e) { const msg = ((e as Error).message.split("\n").find((l) => l.trim()) ?? "").slice(0, 300) || `(${(e as { code?: string }).code ?? "?"})`; rows.push({ id, title, steps: st, result: "", finding: msg }); console.log(`❌ ${id} ${title}: ${msg}`); }
}
const photo = path.join(DOCS, "charter_too.png");
const cid = async (s: D.Session) => (await prisma.company.findFirstOrThrow({ where: { members: { some: { user_id: s.userId } } }, orderBy: { created_at: "desc" } })).id;

(async () => {
  console.log(`→ ${B}`);
  const aidar = await loginSeed("+77010000001"), adm = await loginSeed("+77010000007");
  await prisma.company.updateMany({ where: { role: { in: ["supplier", "contractor"] } }, data: { daily_lead_limit: 1000, pitch_daily_limit: 1000 } }); // фикстура (см. index.ts)
  const house = await createProject(aidar, { name: "Дом (фичи)", object_type: "house", construction_type: "new", region: "almaty", city: "Алматы", address: "ул. QA-F 1", area: "120", floors: "1", open_to_pitches: "on" });
  const flat = await createProject(aidar, { name: "Квартира (фичи)", object_type: "apartment_renovation", construction_type: "cosmetic", region: "almaty", city: "Алматы", address: "пр. QA-F 2", area: "50", rooms: "2", floor: "2", floors: "5" });

  // ══════════ 1. ФИЗЛИЦО-ИСПОЛНИТЕЛЬ ══════════
  const fu = await registerUser("Асан (физлицо)", "contractor");
  await run("F1", "Физлицо: регистрация без БИН → КП по пожарной безопасности 403 → мелкий ремонт (малярка) — успешно", async (st) => {
    const r = await submit("/settings", fu, (f) => f.inputs.includes("bin"), { name: "[QA] Асан Физлицо", legal_type: "individual_contractor", role: "contractor", region: "almaty", city: "Алматы", lat: "43.238", lng: "76.945", radius: "60", consent: "on" }, { noDefaults: true });
    assert(!r.error && /физлицо-исполнитель/.test(r.flash), "регистрация без БИН/документа: " + r.flash); st.push(r.flash.slice(0, 90));
    const company = await prisma.company.findFirstOrThrow({ where: { members: { some: { user_id: fu.userId } } } }); assert.equal(company.legal_type, "individual_contractor"); assert.equal(company.bin, null);
    const cats = await prisma.category.findMany({ where: { code: { in: ["reno_paint", "eng_fire", "reno_demolition"] } } });
    const set = await submit("/supplier/settings", fu, (f) => f.inputs.includes("daily_lead_limit"), { description: "QA физлицо", bank_account: "", daily_lead_limit: "10", pitch_daily_limit: "5", pitch_cooldown_days: "7", service_center_lat: "43.238", service_center_lng: "76.945", service_radius_km: "60", service_area_polygon: "", categories: cats.map((k) => k.id), is_public: "on" }, { noDefaults: true }); assert(!set.error, set.flash);
    const cat = await page("/catalog"); assert(cat.text.includes("Асан Физлицо") && cat.text.includes("физлицо-исполнитель"), "пометка в каталоге"); const card = await page(`/catalog/${company.public_slug}`); assert(card.text.includes("физлицо-исполнитель"), "пометка на карточке"); st.push("каталог и карточка: пометка есть");
    // лицензируемая категория: лид не выдаётся, pitch отклоняется, КП (через назначение диспетчером) → 403
    const fire = await createRequest(aidar, house.id, "eng_fire"); assert(!(await prisma.lead.findFirst({ where: { request_id: fire.id, company_id: company.id } })), "физлицо не получило лид по пожарке");
    const sl = await page("/supplier/leads", fu); assert(/физлицо-исполнитель не допускается/i.test(sl.text), "объяснение на странице лидов");
    const fireCat = await catByCode("eng_fire"); const pitch = await submit("/supplier/map", fu, (f) => f.hidden.project_id === house.id && f.inputs.includes("message"), { category_id: fireCat.id, message: "QA pitch пожарка" }, { noDefaults: true }); assert(pitch.error && /физлицо/.test(pitch.flash), "pitch по лицензируемой категории отклонён: " + pitch.flash); st.push("pitch: " + pitch.flash.slice(0, 70));
    const as = await adminAssign(adm, fire.id, company.id); assert(!as.error, as.flash);
    const blocked = await sendOffer(fu, fire.id, { scope: "install_only", work: 100000 }); assert(blocked.error && /физлицо-исполнитель/.test(blocked.flash), "КП по пожарке отклонено бэкендом: " + blocked.flash); st.push("КП по пожарке: " + blocked.flash.slice(0, 80));
    const api = await fetch(`${B}/api/requests/${fire.id}/offers`, { method: "POST", headers: { "content-type": "application/json", cookie: fu.cookie }, body: JSON.stringify({ work_cost: 100000 }) }); assert.equal(api.status, 403, "прямой API тоже 403"); assert.equal(((await api.json()) as { error: string }).error, "license_required");
    // общая категория: наравне с ИП/ТОО
    const tu = await topUp(fu, 10000); assert(!tu.error, tu.flash);
    const paint = await createRequest(aidar, flat.id, "reno_paint"); const h = await happyCycle(aidar, fu, paint.id, photo, { sellerCompanyId: company.id, offer: { scope: "install_only", work: 70000 } }); st.push(...h.steps.slice(0, 3));
    return "без БИН; пожарка: лид/pitch/КП заблокированы (403 license_required); малярка — полный цикл";
  });

  if (!only || /^F/.test(only)) await (await import("./features-2")).run({ run, aidar, adm, house, flat, photo, cid });
  if (!only || /^G/.test(only)) await (await import("./features-3")).run({ run, aidar, adm, house, flat, photo, cid });

  const bad = rows.filter((r) => r.finding);
  console.log(`\n══════ ${rows.length - bad.length}/${rows.length} без находок ══════`); for (const r of bad) console.log(`  ❌ ${r.id} → ${r.finding}`);
  const fs = await import("fs"); fs.writeFileSync("qa-features-result.json", JSON.stringify(rows, null, 2));
  await prisma.$disconnect(); process.exitCode = bad.length ? 1 : 0;
})();
