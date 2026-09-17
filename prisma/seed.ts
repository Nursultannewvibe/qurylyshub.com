/* eslint-disable no-console */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../src/server/db";
import { regions, objectTypes, categories, stageTypicalDurations, commissionTiers, checklists, regulatoryRules, priceReference } from "./seed-data/reference";
import { templates } from "./seed-data/templates";
import { createProject } from "../src/server/services/projects";

const owner = new PrismaClient({ datasourceUrl: process.env.DATABASE_MIGRATE_URL });
const D = (v: number) => new Prisma.Decimal(v);
const year = (n = 1) => new Date(Date.now() + n * 365 * 86400000);

async function truncateAll() {
  const tables = await owner.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await owner.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export const TEST_ACCOUNTS = {
  buyer: { phone: "+77010000001", name: "Айдар (частный заказчик)" },
  bigBuyer: { phone: "+77010000002", name: "Данияр (BI Construct, крупный заказчик)" },
  windows: { phone: "+77010000003", name: "Окна Алматы (поставщик)" },
  concrete: { phone: "+77010000004", name: "БетонСервис (поставщик)" },
  roofer: { phone: "+77010000005", name: "КровляМастер (подрядчик)" },
  supervisor: { phone: "+77010000006", name: "Марат (технадзор)" },
  admin: { phone: "+77010000007", name: "Админ / диспетчер" },
  renoContractor: { phone: "+77010000008", name: "РемСтрой (подрядчик по ремонту)" },
  unlicensed: { phone: "+77010000009", name: "ЭлектроМонтаж (без лицензии)" },
  tiler: { phone: "+77010000010", name: "МастерПлитка (подрядчик)" },
  buyer2: { phone: "+77010000011", name: "Асель (частный заказчик, Талгар)" },
};

async function user(phone: string, name: string, roles: ("buyer" | "supplier" | "contractor" | "supervisor" | "admin")[], referral: string) {
  const u = await prisma.user.create({ data: { phone, name, referral_code: referral, roles: { create: roles.map((role) => ({ role })) }, consents: { create: { consent_type: "personal_data" } }, notification_prefs: { create: [{ channel: "in_app" }, { channel: "push" }] } } });
  return u;
}

async function company(ownerId: string, data: Omit<Prisma.CompanyUncheckedCreateInput, "public_slug"> & { public_slug: string }, categoryIds: string[]) {
  const c = await prisma.company.create({ data: { ...data, categories_json: categoryIds } });
  await prisma.companyMember.create({ data: { user_id: ownerId, company_id: c.id, permission: "owner" } });
  await prisma.companyReputation.create({ data: { company_id: c.id } });
  if (c.role !== "buyer") {
    await prisma.wallet.create({ data: { company_id: c.id, balance: D(50000) } });
    await prisma.verification.create({ data: { company_id: c.id, doc_type: "registration", doc_url: "/uploads/seed/registration.pdf", status: "verified" } });
  }
  return c;
}

async function main() {
  console.log("→ truncate");
  await truncateAll();

  console.log("→ справочники");
  for (const r of regions) await prisma.region.create({ data: { code: r.code, name: r.name, name_kk: r.name_kk, parent_id: r.parent ?? null, lat: r.lat ?? null, lng: r.lng ?? null } });
  for (const o of objectTypes) await prisma.objectType.create({ data: o });
  const cat: Record<string, string> = {};
  for (const c of categories) {
    const row = await prisma.category.create({ data: { code: c.code, name: c.name, name_kk: c.name_kk, object_types_json: c.object_types, required_license: !!c.required_license, required_attestation: !!c.required_attestation, seasonal_restrictions_json: (c.seasonal ?? Prisma.JsonNull) as never, order_index: c.order } });
    cat[c.code] = row.id;
  }
  for (const [code, t] of Object.entries(templates)) {
    await prisma.requestTemplate.create({
      data: {
        category_id: cat[code], name: t.name, version: 1, is_current: true,
        parameters: { create: t.params.map((p, i) => ({ key: p.key, label: p.label, label_kk: p.label_kk ?? null, field_type: p.type, required: !!p.required, options_json: p.options ? p.options : Prisma.JsonNull, unit: p.unit ?? null, hint: p.hint ?? null, order_index: i })) },
      },
    });
  }
  for (const s of stageTypicalDurations) await prisma.stageTypicalDuration.create({ data: { object_type: s.object_type, construction_type: s.construction_type ?? null, stage_name: s.stage_name, order_index: s.order_index, typical_days: s.typical_days, category_code: s.category_code ?? null } });
  for (const t of commissionTiers) await prisma.commissionTier.create({ data: { min_amount: D(t.min_amount), max_amount: t.max_amount == null ? null : D(t.max_amount), percent: D(t.percent) } });
  for (const [code, items] of Object.entries(checklists)) for (const [i, it] of items.entries()) await prisma.acceptanceChecklist.create({ data: { category_id: cat[code], item_text: it.text, item_text_kk: it.text_kk ?? null, order_index: i, photo_required: it.photo } });
  for (const r of regulatoryRules) await prisma.regulatoryRule.create({ data: { ...r, responsibility_level: r.responsibility_level as "I" | "II" | "III" } });
  for (const p of priceReference) await prisma.priceReference.create({ data: { category_id: cat[p.category], region: p.region, unit: p.unit, price_min: D(p.min), price_avg: D(p.avg), price_max: D(p.max) } });

  console.log("→ пользователи и компании");
  const A = TEST_ACCOUNTS;
  const uBuyer = await user(A.buyer.phone, "Айдар Сейтқали", ["buyer"], "AIDAR01");
  const uBuyer2 = await user(A.buyer2.phone, "Асель Нұрлан", ["buyer"], "ASEL001");
  const uBig = await user(A.bigBuyer.phone, "Данияр Ахметов", ["buyer"], "BIGCO01");
  const uWin = await user(A.windows.phone, "Ерлан (Окна Алматы)", ["supplier"], "WIN0001");
  const uCon = await user(A.concrete.phone, "Бауыржан (БетонСервис)", ["supplier"], "CONC001");
  const uRoof = await user(A.roofer.phone, "Серик (КровляМастер)", ["contractor", "supplier"], "ROOF001");
  const uSup = await user(A.supervisor.phone, "Марат Жумабеков", ["supervisor"], "SUPV001");
  const uAdmin = await user(A.admin.phone, "Диспетчер платформы", ["admin"], "ADMIN01");
  const uReno = await user(A.renoContractor.phone, "Руслан (РемСтрой)", ["contractor"], "RENO001");
  const uUnl = await user(A.unlicensed.phone, "Тимур (ЭлектроМонтаж)", ["contractor"], "UNLC001");
  const uTiler = await user(A.tiler.phone, "Азамат (МастерПлитка)", ["contractor"], "TILE001");
  await prisma.user.update({ where: { id: uBuyer2.id }, data: { referred_by: uBuyer.id } });
  await prisma.notificationPreference.update({ where: { user_id_channel: { user_id: uBuyer.id, channel: "push" } }, data: { quiet_hours_start: 22, quiet_hours_end: 8 } });

  const almaty = { service_center_lat: 43.238, service_center_lng: 76.945 };
  const cBig = await company(uBig.id, { legal_type: "too", name: "BI Construct", bin: "100140000001", role: "buyer", scale: "large", public_slug: "bi-construct", region: "almaty", city: "Алматы", registration_doc_url: "/uploads/seed/charter.pdf", tax_status: "vat_payer", bank_account: "KZ86601A000000000001" }, []);
  const cWin = await company(uWin.id, { legal_type: "too", name: "Окна Алматы", bin: "200140000002", role: "supplier", scale: "medium", public_slug: "okna-almaty", region: "almaty", city: "Алматы", description: "Производство и монтаж окон ПВХ/алюминий. Собственный цех, замер бесплатно. Также благоустройство и рулонный газон.", ...almaty, service_radius_km: 60, service_area_polygon: [[43.45, 76.3], [43.45, 77.4], [43.0, 77.4], [43.0, 76.3]], tax_status: "vat_payer", daily_lead_limit: 5, pitch_daily_limit: 3, pitch_cooldown_days: 7, bank_account: "KZ86601A000000000002", portfolio_json: [{ title: "Дом в Каскелене, 14 окон", photo: "/uploads/seed/win1.jpg" }] }, [cat.windows, cat.landscaping]);
  const cCon = await company(uCon.id, { legal_type: "too", name: "БетонСервис", bin: "200140000003", role: "supplier", scale: "medium", public_slug: "betonservice", region: "boraldai", city: "Боралдай", description: "Товарный бетон М200–М400, доставка миксерами, бетононасосы до 36 м.", service_center_lat: 43.36, service_center_lng: 76.85, service_radius_km: 45, tax_status: "vat_payer", daily_lead_limit: 8, bank_account: "KZ86601A000000000003" }, [cat.concrete, cat.walls]);
  const cRoof = await company(uRoof.id, { legal_type: "ip", name: "КровляМастер", bin: "900140000004", role: "contractor", scale: "small", public_slug: "krovlya-master", region: "almaty", city: "Алматы", description: "Кровельные работы любой сложности, электромонтаж (лицензия).", registration_doc_url: "/uploads/seed/ip-talon.pdf", ...almaty, service_radius_km: 50, daily_lead_limit: 3, bank_account: "KZ86601A000000000004" }, [cat.roof, cat.eng_electrical, cat.windows]);
  const cReno = await company(uReno.id, { legal_type: "ip", name: "РемСтрой", bin: "900140000005", role: "contractor", scale: "small", public_slug: "remstroy", region: "almaty", city: "Алматы", description: "Ремонт квартир под ключ: электрика (лицензия), сантехника, плитка.", registration_doc_url: "/uploads/seed/ip-talon.pdf", ...almaty, service_radius_km: 40, bank_account: "KZ86601A000000000005" }, [cat.reno_electrical, cat.reno_plumbing, cat.reno_tile, cat.reno_plaster, cat.reno_screed]);
  const cUnl = await company(uUnl.id, { legal_type: "self_employed", name: "ЭлектроМонтаж", bin: "900140000006", role: "contractor", scale: "individual", public_slug: "elektromontazh", region: "almaty", city: "Алматы", description: "Электромонтаж (лицензия на проверке).", ...almaty, service_radius_km: 40 }, [cat.reno_electrical, cat.eng_electrical]);
  const cTiler = await company(uTiler.id, { legal_type: "ip", name: "МастерПлитка", bin: "900140000007", role: "contractor", scale: "small", public_slug: "master-plitka", region: "almaty", city: "Алматы", description: "Плитка, керамогранит, штукатурка.", registration_doc_url: "/uploads/seed/ip-talon.pdf", ...almaty, service_radius_km: 40, bank_account: "KZ86601A000000000007" }, [cat.reno_tile, cat.reno_plaster, cat.reno_paint]);
  const cSup = await company(uSup.id, { legal_type: "self_employed", name: "Технадзор Марат Жумабеков", bin: "900140000008", role: "contractor", scale: "individual", public_slug: "technadzor-marat", region: "almaty", city: "Алматы", description: "Аттестованный технический надзор, 12 лет опыта.", ...almaty, service_radius_km: 80 }, []);

  // Лицензии/аттестаты
  await prisma.verification.create({ data: { company_id: cRoof.id, category_id: cat.eng_electrical, doc_type: "license", doc_url: "/uploads/seed/lic.pdf", status: "verified", valid_until: year(1) } });
  await prisma.verification.create({ data: { company_id: cReno.id, category_id: cat.reno_electrical, doc_type: "license", doc_url: "/uploads/seed/lic.pdf", status: "verified", valid_until: year(1) } });
  await prisma.verification.create({ data: { company_id: cUnl.id, category_id: cat.reno_electrical, doc_type: "license", doc_url: "/uploads/seed/lic.pdf", status: "pending" } });
  await prisma.verification.create({ data: { company_id: cSup.id, doc_type: "attestation", doc_url: "/uploads/seed/attest.pdf", status: "verified", valid_until: year(2) } });
  await prisma.verification.create({ data: { company_id: cWin.id, doc_type: "bin", status: "verified" } });
  await prisma.externalProfile.createMany({ data: [{ company_id: cWin.id, platform: "twogis", url: "https://2gis.kz/almaty/firm/okna-almaty" }, { company_id: cWin.id, platform: "instagram", url: "https://instagram.com/okna.almaty" }] });

  // Подписки
  await prisma.subscription.createMany({ data: [
    { company_id: cWin.id, plan: "pro", price: D(45000), status: "active", next_billing_at: new Date(Date.now() + 20 * 86400000) },
    { company_id: cCon.id, plan: "basic", price: D(15000), status: "active", next_billing_at: new Date(Date.now() + 10 * 86400000) },
    { company_id: cRoof.id, plan: "basic", price: D(10000), status: "active", next_billing_at: new Date(Date.now() + 5 * 86400000) },
    { company_id: cBig.id, plan: "pro", price: D(90000), status: "active", next_billing_at: new Date(Date.now() + 25 * 86400000) },
  ] });

  // Шаблон КП поставщика и пример заявки на вывод
  await prisma.offerTemplate.create({ data: { company_id: cWin.id, category_id: cat.windows, name: "Rehau 5-кам, 2-кам стеклопакет, монтаж", template_values_json: { offer_scope: "material_and_work", material_json: [{ name: "Окно ПВХ Rehau Blitz 5-кам, стеклопакет 2-кам", qty: 1, unit: "шт", price: 85000 }], work_cost: 12000, delivery_cost: 8000, delivery_days: 10, execution_days: 2, warranty: "5 лет на профиль, 2 года на монтаж" } } });
  await prisma.payoutRequest.create({ data: { company_id: cWin.id, amount: D(120000), bank_account: "KZ86601A000000000002", status: "completed", requested_at: new Date(Date.now() - 20 * 86400000), processed_at: new Date(Date.now() - 18 * 86400000) } });

  console.log("→ объекты");
  const house = await createProject(uBuyer.id, { name: "Дом в Каскелене", object_type: "house", construction_type: "new", region: "kaskelen", city: "Каскелен", district: "мкр. Жаңа Қала", address: "ул. Абылай хана, 15", geo_lat: 43.205, geo_lng: 76.63, area: 180, floors: 2, budget_min: 25_000_000, budget_max: 35_000_000, open_to_pitches: true, land_purpose: "ИЖС", tu_electric: true, tu_water: true, deadline: new Date(Date.now() + 300 * 86400000) });
  await prisma.projectFile.create({ data: { project_id: house.project.id, type: "plan", url: "/uploads/seed/house-plan.pdf", name: "house-plan.pdf", size_bytes: 240000, validated: true } });
  const house2 = await createProject(uBuyer2.id, { name: "Дом в Талгаре", object_type: "house", construction_type: "new", region: "talgar", city: "Талгар", district: "Бесагаш", address: "ул. Жамбыла, 4", geo_lat: 43.31, geo_lng: 77.2, area: 140, floors: 1, budget_min: 18_000_000, budget_max: 24_000_000, open_to_pitches: true, land_purpose: "ИЖС" });
  // Крупный заказчик: ЖК из 2 корпусов (parent_project_id) + склад + кафе
  const zhk = await createProject(uBig.id, { name: "ЖК «Алатау Сити»", object_type: "premium_residential", construction_type: "new", region: "almaty", city: "Алматы", district: "Наурызбайский", address: "ул. Жандосова, 200", geo_lat: 43.21, geo_lng: 76.85, area: 24000, floors: 9, company_id: cBig.id, budget_min: 4_000_000_000, budget_max: 5_500_000_000, open_to_pitches: true });
  const korpusA = await createProject(uBig.id, { name: "ЖК «Алатау Сити» — Корпус А", object_type: "premium_residential", construction_type: "new", region: "almaty", city: "Алматы", district: "Наурызбайский", address: "ул. Жандосова, 200, корпус А", geo_lat: 43.21, geo_lng: 76.85, area: 12000, floors: 9, company_id: cBig.id, parent_project_id: zhk.project.id, open_to_pitches: true });
  const korpusB = await createProject(uBig.id, { name: "ЖК «Алатау Сити» — Корпус Б", object_type: "premium_residential", construction_type: "new", region: "almaty", city: "Алматы", district: "Наурызбайский", address: "ул. Жандосова, 200, корпус Б", geo_lat: 43.211, geo_lng: 76.851, area: 12000, floors: 9, company_id: cBig.id, parent_project_id: zhk.project.id, open_to_pitches: true });
  const warehouse = await createProject(uBig.id, { name: "Склад в Боралдае", object_type: "warehouse", construction_type: "new", region: "boraldai", city: "Боралдай", address: "Промзона, уч. 12", geo_lat: 43.355, geo_lng: 76.86, area: 3000, floors: 1, company_id: cBig.id, open_to_pitches: false });
  const cafe = await createProject(uBig.id, { name: "Кафе в Талгаре", object_type: "cafe", construction_type: "new", region: "talgar", city: "Талгар", address: "пр. Абая, 88", geo_lat: 43.3, geo_lng: 77.23, area: 250, floors: 1, company_id: cBig.id, open_to_pitches: true });
  await prisma.projectMember.createMany({ data: [korpusA, korpusB, warehouse, cafe, zhk].map((p) => ({ project_id: p.project.id, user_id: uBig.id, permission: "owner" as const })), skipDuplicates: true });

  // Доска обсуждений — пример публичной ветки (Бетон / Каскелен) с ответом верифицированной компании
  const kaskelen = await prisma.region.findUniqueOrThrow({ where: { code: "kaskelen" } });
  const bp = await prisma.boardPost.create({ data: { category_id: cat.concrete, region_id: kaskelen.id, author_id: uBuyer.id, title: "Сколько реально стоит фундамент под дом 120 м²?", body: "Строю одноэтажный дом, площадь 120 м², грунт обычный. Сколько в среднем берут за заливку ленты под ключ?" } });
  await prisma.boardReply.create({ data: { post_id: bp.id, author_id: uCon.id, body: "Зависит от глубины и марки бетона, но в среднем 25–30 тыс тг за м² ленты с работой. Могу прикинуть точнее, если пришлёте план." } });

  console.log("✓ seed готов");
  console.table(Object.values(A).map((a) => ({ телефон: a.phone, кто: a.name, otp: process.env.DEV_OTP_CODE ?? "(см. лог сервера)" })));
  void [house2, uAdmin, uTiler, cTiler, cCon];
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); await owner.$disconnect(); });
