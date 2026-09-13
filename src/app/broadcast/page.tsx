import { requireSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { currentTemplate } from "@/server/services/requests";
import { Field, Flash } from "@/components/ui";
import { broadcastAction } from "@/server/actions/buyer";

export default async function Broadcast({ searchParams }: { searchParams: Promise<{ category?: string; error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const companies = s.user.companies.filter((c) => c.role === "buyer");
  if (!companies.length) return <p className="muted">Массовая рассылка доступна компаниям-заказчикам (зарегистрируйте компанию в настройках).</p>;
  const company = companies[0];
  const [projects, cats] = await Promise.all([prisma.project.findMany({ where: { company_id: company.id, status: "active" }, include: { requests: { select: { category_id: true, status: true } } } }), prisma.category.findMany({ orderBy: { order_index: "asc" } })]);
  const category = cats.find((c) => c.id === sp.category) ?? cats.find((c) => c.code === "windows")!;
  const tpl = await currentTemplate(category.id);
  const need = projects.filter((p) => (category.object_types_json as string[]).includes(p.object_type));
  const suppliers = (await prisma.company.findMany({ where: { role: { in: ["supplier", "contractor"] } } })).filter((c) => (c.categories_json as string[]).includes(category.id));
  return <div className="mx-auto max-w-4xl"><h1 className="h1 mb-1">Массовая рассылка — {company.name}</h1><p className="muted mb-4">Фильтр объектов по категории → один запрос всем поставщикам категории одной кнопкой.</p><Flash sp={sp} />
    <div className="mb-3 flex flex-wrap gap-1">{cats.map((c) => <a key={c.id} href={`/broadcast?category=${c.id}`} className={`badge ${c.id === category.id ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{c.name}</a>)}</div>
    <form action={broadcastAction} className="card space-y-3"><input type="hidden" name="company_id" value={company.id} /><input type="hidden" name="category_id" value={category.id} />
      <div><label className="label">Объекты, где нужна категория «{category.name}» ({need.length} из {projects.length})</label>{need.map((p) => <label key={p.id} className="block text-sm"><input type="checkbox" name="project_ids" value={p.id} defaultChecked={!p.requests.some((r) => r.category_id === category.id && r.status === "published")} /> {p.name} <span className="muted">{p.city}{p.requests.some((r) => r.category_id === category.id && r.status === "published") ? " · уже есть открытая заявка" : ""}</span></label>)}</div>
      <div className="grid gap-2 sm:grid-cols-2">{tpl.parameters.map((f) => { const n = `v_${f.key}`; const label = `${f.label}${f.unit ? ", " + f.unit : ""}${f.required ? " *" : ""}`;
        if (f.field_type === "boolean") return <label key={f.id} className="text-sm"><input type="checkbox" name={n} /> {f.label}</label>;
        if (f.field_type === "select") return <Field key={f.id} label={label}><select className="input" name={n} required={f.required}><option value="">—</option>{(f.options_json as string[]).map((o) => <option key={o}>{o}</option>)}</select></Field>;
        if (f.field_type === "multiselect") return <Field key={f.id} label={label}><div className="flex flex-wrap gap-2 text-sm">{(f.options_json as string[]).map((o) => <label key={o}><input type="checkbox" name={n} value={o} /> {o}</label>)}</div></Field>;
        return <Field key={f.id} label={label} hint={f.hint}><input className="input" name={n} type={f.field_type === "number" ? "number" : "text"} step="any" required={f.required} /></Field>; })}</div>
      <div className="flex items-center gap-3"><button className="btn-primary">Разослать всем поставщикам категории ({suppliers.length})</button><span className="text-xs text-slate-400">Получатели: {suppliers.map((c) => c.name).join(", ")} (с проверкой лицензии/soft-ban на бэкенде)</span></div></form></div>;
}
