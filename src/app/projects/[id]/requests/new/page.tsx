import { requireSession } from "@/server/auth";
import { assertProjectAccess } from "@/server/services/projects";
import { currentTemplate } from "@/server/services/requests";
import { prisma } from "@/server/db";
import { Field, Flash } from "@/components/ui";
import { createRequestAction, aiParseAction } from "@/server/actions/buyer";
import { Calculators } from "./calculators";

export default async function NewRequest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string; target?: string; ai?: string; error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const s = await requireSession();
  const p = await assertProjectAccess(id, s.user.id);
  const cats = (await prisma.category.findMany({ orderBy: { order_index: "asc" } })).filter((c) => (c.object_types_json as string[]).includes(p.object_type));
  const target = sp.target ? await prisma.company.findUnique({ where: { id: sp.target } }) : null;
  const targetCats = target ? (target.categories_json as string[]) : null;
  const available = targetCats ? cats.filter((c) => targetCats.includes(c.id)) : cats;
  const category = available.find((c) => c.id === sp.category) ?? available[0];
  if (!category) return <p className="muted">Нет применимых категорий.</p>;
  const tpl = await currentTemplate(category.id);
  const ai = sp.ai ? await prisma.aiParse.findUnique({ where: { id: sp.ai } }) : null;
  const pre = ((ai?.result_json as { values?: Record<string, unknown> } | null)?.values ?? {}) as Record<string, unknown>;
  const stages = await prisma.constructionStage.findMany({ where: { project_id: id }, orderBy: { order_index: "asc" } });
  const sr = category.seasonal_restrictions_json as { months?: number[]; message?: string } | null;
  const seasonal = sr?.months?.includes(new Date().getMonth() + 1) ? sr.message : null;
  const base = `/projects/${id}/requests/new`;
  return <div className="mx-auto max-w-4xl"><h1 className="h1 mb-1">Заявка: {category.name} <span className="muted">шаблон v{tpl.version}</span></h1><p className="muted mb-4">Объект «{p.name}»{target ? <> · точечный запрос → <b>{target.name}</b></> : " · матчинг по всем подходящим поставщикам"}</p><Flash sp={sp} />
    {!target && <div className="mb-3 flex flex-wrap gap-1">{available.map((c) => <a key={c.id} href={`${base}?category=${c.id}`} className={`badge ${c.id === category.id ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{c.name}</a>)}</div>}
    {seasonal && <p className="mb-3 rounded bg-amber-50 p-2 text-sm text-amber-800">⚠ {seasonal}</p>}
    <details className="card mb-4" open={!!sp.ai}><summary className="cursor-pointer font-semibold">🤖 AI-разбор: опишите задачу текстом / расшифровкой голосового / описанием плана</summary>
      <form action={aiParseAction} className="mt-2 space-y-2"><input type="hidden" name="project_id" value={id} /><input type="hidden" name="category_id" value={category.id} />{target && <input type="hidden" name="target_company_id" value={target.id} />}
        <textarea className="input" name="text" rows={3} placeholder="Например: нужен ленточный фундамент 12×8, высота 1.2, ширина 0.5, бетон М300, с насосом" required /><div className="flex items-center gap-2"><select className="input w-40" name="input_kind"><option value="text">текст</option><option value="voice">голос (расшифровка)</option><option value="plan">план</option><option value="photo">фото (описание)</option></select><button className="btn-secondary">Разобрать</button><span className="text-xs text-slate-400">Адрес, ФИО и телефон в LLM не передаются; лимит {process.env.AI_PARSE_DAILY_LIMIT ?? 10}/день.</span></div></form>
      {ai && <p className="mt-2 text-xs text-slate-500">Предзаполнено из разбора ({ai.provider}); проверьте и подтвердите. Уверенность: {String((ai.result_json as { confidence?: number })?.confidence ?? "—")}</p>}</details>
    <Calculators category={category.code} />
    <form action={createRequestAction} className="card grid gap-3 sm:grid-cols-2"><input type="hidden" name="project_id" value={id} /><input type="hidden" name="category_id" value={category.id} />{target && <><input type="hidden" name="target_company_id" value={target.id} /><input type="hidden" name="mode" value="direct" /></>}{ai && <input type="hidden" name="ai_parse_id" value={ai.id} />}
      <Field label="Этап объекта (для проверки зависимостей)"><select className="input" name="stage_id"><option value="">—</option>{stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select></Field>
      {tpl.parameters.map((f) => { const v = pre[f.key]; const n = `v_${f.key}`; const label = `${f.label}${f.unit ? ", " + f.unit : ""}${f.required ? " *" : ""}`;
        if (f.field_type === "boolean") return <label key={f.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name={n} defaultChecked={!!v} /> {f.label}</label>;
        if (f.field_type === "select") return <Field key={f.id} label={label} hint={f.hint}><select className="input" name={n} defaultValue={v ? String(v) : ""} required={f.required}><option value="">—</option>{(f.options_json as string[]).map((o) => <option key={o}>{o}</option>)}</select></Field>;
        if (f.field_type === "multiselect") return <Field key={f.id} label={label} hint={f.hint}><div className="flex flex-wrap gap-2 text-sm">{(f.options_json as string[]).map((o) => <label key={o}><input type="checkbox" name={n} value={o} defaultChecked={Array.isArray(v) && v.includes(o)} /> {o}</label>)}</div></Field>;
        if (f.field_type === "file") return <Field key={f.id} label={label} hint="Ссылка на загруженный файл объекта"><input className="input" name={n} defaultValue={v ? String(v) : ""} placeholder="/uploads/..." /></Field>;
        return <Field key={f.id} label={label} hint={f.hint}><input className="input" name={n} id={`f_${f.key}`} type={f.field_type === "number" ? "number" : "text"} step="any" defaultValue={v == null ? "" : String(v)} required={f.required} /></Field>; })}
      <div className="sm:col-span-2 flex items-center gap-3"><button className="btn-primary">{target ? "Отправить запрос поставщику" : "Опубликовать и подобрать поставщиков"}</button><span className="text-xs text-slate-400">Заявка привязывается к версии шаблона v{tpl.version}.</span></div>
    </form></div>;
}
