import { requireSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Field, Flash } from "@/components/ui";
import { createProjectAction } from "@/server/actions/buyer";

export default async function NewProject({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const [types, regions, parents] = await Promise.all([prisma.objectType.findMany(), prisma.region.findMany({ orderBy: { name: "asc" } }), prisma.project.findMany({ where: { owner_id: s.user.id, parent_project_id: null } })]);
  const buyerCompanies = s.user.companies.filter((c) => c.role === "buyer");
  return <div className="mx-auto max-w-3xl"><h1 className="h1 mb-4">Новый объект (паспорт)</h1><Flash sp={sp} />
    <form action={createProjectAction} className="card grid gap-3 sm:grid-cols-2">
      <Field label="Название"><input className="input" name="name" required placeholder="Дом в Каскелене" /></Field>
      <Field label="Тип объекта"><select className="input" name="object_type">{types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}</select></Field>
      <Field label="Тип работ" hint="new — новое строительство; capital/cosmetic — для ремонта квартиры"><select className="input" name="construction_type"><option value="new">Новое строительство</option><option value="capital">Капитальный ремонт</option><option value="cosmetic">Косметический ремонт</option><option value="reconstruction">Реконструкция</option></select></Field>
      <Field label="Регион / город" hint="Координаты подставятся из справочника, если не указаны"><select className="input" name="region">{regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select></Field>
      <Field label="Город (текст)"><input className="input" name="city" required defaultValue="Каскелен" /></Field>
      <Field label="Район"><input className="input" name="district" /></Field>
      <Field label="Адрес" hint="Показывается поставщику только после отклика/выбора"><input className="input" name="address" /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Широта"><input className="input" name="geo_lat" placeholder="43.20" /></Field><Field label="Долгота"><input className="input" name="geo_lng" placeholder="76.62" /></Field></div>
      <div className="grid grid-cols-3 gap-2"><Field label="Площадь, м²"><input className="input" name="area" type="number" step="0.1" /></Field><Field label="Этажей"><input className="input" name="floors" type="number" /></Field><Field label="Комнат"><input className="input" name="rooms" type="number" /></Field></div>
      <div className="grid grid-cols-2 gap-2"><Field label="Бюджет от, ₸"><input className="input" name="budget_min" type="number" /></Field><Field label="Бюджет до, ₸"><input className="input" name="budget_max" type="number" /></Field></div>
      <Field label="Срок сдачи"><input className="input" name="deadline" type="date" /></Field>
      <Field label="Назначение земли"><input className="input" name="land_purpose" placeholder="ИЖС" /></Field>
      <Field label="Родительский объект (для корпуса ЖК / очереди)"><select className="input" name="parent_project_id"><option value="">—</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      {buyerCompanies.length > 0 && <Field label="От имени компании"><select className="input" name="company_id"><option value="">Лично</option>{buyerCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      <div className="sm:col-span-2"><label className="label">Технические условия (ТУ) получены</label><div className="flex flex-wrap gap-4 text-sm">{[["tu_electric", "Электричество"], ["tu_gas", "Газ"], ["tu_water", "Вода"], ["tu_sewer", "Канализация"], ["tu_heat", "Тепло"]].map(([n, l]) => <label key={n}><input type="checkbox" name={n} /> {l}</label>)}</div></div>
      <label className="text-sm sm:col-span-2"><input type="checkbox" name="open_to_pitches" /> Показывать объект на карте поставщикам (район и категории, без адреса) — принимать встречные предложения</label>
      <p className="text-xs text-slate-500 sm:col-span-2">Сейсмичность, уровень ответственности, необходимость разрешения/экспертизы/технадзора рассчитываются по конфигурируемой матрице правил после создания.</p>
      <div className="sm:col-span-2"><button className="btn-primary">Создать объект</button></div>
    </form></div>;
}
