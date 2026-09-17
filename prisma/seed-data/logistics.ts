/* Перевозки: категория, шаблон, ориентир цен, тип категорий, тестовый перевозчик. Идемпотентно (upsert) — применяется и сидом, и к уже работающей базе. */
import { Prisma, PrismaClient } from "@prisma/client";

const MATERIAL = ["concrete", "walls", "windows"];
export const CARRIER = { phone: "+77010000012", name: "Нурлан (ТрансКарго)", company: "ТрансКарго", bin: "200140000012", slug: "transcargo", routes: [["almaty", "kaskelen"], ["almaty", "talgar"], ["boraldai", "almaty"], ["almaty", "konaev"], ["almaty", "chemolgan"]] };

export async function upsertLogistics(prisma: PrismaClient) {
  await prisma.category.updateMany({ where: { code: { in: MATERIAL } }, data: { category_type: "material" } });
  await prisma.category.updateMany({ where: { code: { notIn: [...MATERIAL, "logistics"] } }, data: { category_type: "work" } });
  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  const objectTypes = (await prisma.objectType.findMany()).map((o) => o.code);
  const cat = await prisma.category.upsert({ where: { code: "logistics" }, create: { code: "logistics", name: "Перевозки / доставка", name_kk: "Тасымалдау / жеткізу", object_types_json: objectTypes, category_type: "logistics", order_index: 300 }, update: { object_types_json: objectTypes, category_type: "logistics" } });
  const params = [
    { key: "cargo_type", label: "Тип груза", field_type: "select", required: true, options: ["бетон/раствор", "сыпучие (песок, щебень)", "блоки/кирпич (паллеты)", "окна/двери (хрупкое)", "металл/арматура", "спецтехника", "другое"] },
    { key: "weight_t", label: "Вес", field_type: "number", required: true, unit: "т" },
    { key: "volume_m3", label: "Объём", field_type: "number", required: false, unit: "м³" },
    { key: "load_region", label: "Регион загрузки", field_type: "select", required: true, options: regions.map((r) => r.code) },
    { key: "load_point", label: "Точка загрузки (адрес)", field_type: "text", required: true },
    { key: "unload_region", label: "Регион выгрузки", field_type: "select", required: true, options: regions.map((r) => r.code) },
    { key: "unload_point", label: "Точка выгрузки (адрес)", field_type: "text", required: true },
    { key: "transport_type", label: "Тип транспорта", field_type: "select", required: true, options: ["миксер", "самосвал", "манипулятор", "фура/еврофура", "газель", "трал"] },
    { key: "urgency", label: "Срочность", field_type: "select", required: true, options: ["сегодня", "завтра", "в течение недели", "по графику"] },
  ] as const;
  let tpl = await prisma.requestTemplate.findFirst({ where: { category_id: cat.id, is_current: true } });
  if (!tpl) tpl = await prisma.requestTemplate.create({ data: { category_id: cat.id, name: "Перевозка груза", version: 1, is_current: true } });
  for (const [i, p] of params.entries()) await prisma.requestParameter.upsert({ where: { template_id_key: { template_id: tpl.id, key: p.key } }, create: { template_id: tpl.id, key: p.key, label: p.label, field_type: p.field_type, required: p.required, options_json: "options" in p ? (p.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull, unit: "unit" in p ? p.unit : null, order_index: i }, update: { label: p.label, options_json: "options" in p ? (p.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull, order_index: i } });
  for (const [unit, min, avg, max] of [["тг/км", 250, 320, 400], ["тг/рейс", 25000, 40000, 60000]] as const) {
    const exists = await prisma.priceReference.findFirst({ where: { category_id: cat.id, region: "almaty", unit } });
    if (!exists) await prisma.priceReference.create({ data: { category_id: cat.id, region: "almaty", unit, price_min: new Prisma.Decimal(min), price_avg: new Prisma.Decimal(avg), price_max: new Prisma.Decimal(max) } });
  }
  // тестовый перевозчик
  let user = await prisma.user.findUnique({ where: { phone: CARRIER.phone } });
  if (!user) user = await prisma.user.create({ data: { phone: CARRIER.phone, name: CARRIER.name, referral_code: "CARGO01", roles: { create: { role: "supplier" } }, consents: { create: { consent_type: "personal_data" } }, notification_prefs: { create: [{ channel: "in_app" }, { channel: "push" }] } } });
  let company = await prisma.company.findUnique({ where: { public_slug: CARRIER.slug } });
  if (!company) {
    company = await prisma.company.create({ data: { legal_type: "too", name: CARRIER.company, bin: CARRIER.bin, role: "supplier", scale: "small", public_slug: CARRIER.slug, region: "almaty", city: "Алматы", description: "Грузоперевозки по Алматы и пригородам: миксеры, самосвалы, манипуляторы, фуры.", categories_json: [cat.id], service_route_json: CARRIER.routes, daily_lead_limit: 10, bank_account: "KZ86601A000000000012", members: { create: { user_id: user.id, permission: "owner" } }, reputation: { create: {} }, wallet: { create: { balance: new Prisma.Decimal(50000) } }, verifications: { create: { doc_type: "registration", status: "verified" } } } });
  }
  return { category: cat, carrier: company };
}
