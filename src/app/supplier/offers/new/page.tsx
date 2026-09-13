import Link from "next/link";
import { requireSession, companyOf } from "@/server/auth";
import { prisma } from "@/server/db";
import { hasValidLicense } from "@/server/services/matching";
import { Field, Flash, Money } from "@/components/ui";
import { offerAction } from "@/server/actions/supplier";
import { L } from "@/lib/i18n";

export default async function NewOffer({ searchParams }: { searchParams: Promise<{ request?: string; template?: string; error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams; const c = companyOf(s);
  const req = await prisma.request.findUnique({ where: { id: sp.request ?? "" }, include: { category: true, project: true, template: { include: { parameters: { orderBy: { order_index: "asc" } } } }, leads: { where: { company_id: c.id } }, offers: { where: { company_id: c.id } } } });
  if (!req) return <p>Заявка не найдена</p>;
  const lead = req.leads[0];
  const licensed = req.category.required_license ? await hasValidLicense(c.id, req.category_id) : true;
  const templates = await prisma.offerTemplate.findMany({ where: { company_id: c.id, category_id: req.category_id } });
  const tpl = sp.template ? templates.find((t) => t.id === sp.template) : null;
  const tv = (tpl?.template_values_json ?? {}) as { offer_scope?: string; material_json?: { name: string; qty: number; unit: string; price: number }[]; work_cost?: number; delivery_cost?: number; delivery_days?: number; execution_days?: number; warranty?: string };
  const values = req.values_json as Record<string, unknown>;
  const prev = req.offers[0];
  const ref = await prisma.priceReference.findFirst({ where: { category_id: req.category_id } });
  return <div className="mx-auto max-w-4xl"><h1 className="h1 mb-1">КП: {req.category.name}{prev ? ` (версия ${prev.version + 1})` : ""}</h1><p className="muted mb-3">{req.project.city} · {L(req.project.object_type)} · <Link className="text-brand-600" href={`/requests/${req.id}`}>заявка</Link>{ref ? <> · ориентир рынка: <Money v={ref.price_min} />–<Money v={ref.price_max} /> за {ref.unit}</> : null}</p><Flash sp={sp} />
    {!lead || lead.status !== "purchased" ? <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">Чтобы ответить на эту заявку, сначала купите лид на странице <Link className="underline" href="/supplier/leads">«Лиды»</Link>.</p> : !licensed ? <p className="rounded bg-red-50 p-3 text-sm text-red-800">Категория «{req.category.name}» требует верифицированную лицензию. Кнопка отправки недоступна — и бэкенд отклонит запрос независимо от UI. Загрузите лицензию в <Link className="underline" href="/supplier/settings">настройках</Link>.</p> : null}
    <div className="grid gap-4 lg:grid-cols-3"><form action={offerAction} className="card space-y-3 lg:col-span-2"><input type="hidden" name="request_id" value={req.id} />{tpl && <input type="hidden" name="template_id" value={tpl.id} />}
      {templates.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm">Шаблоны КП: {templates.map((t) => <a key={t.id} href={`/supplier/offers/new?request=${req.id}&template=${t.id}`} className={`badge ${t.id === tpl?.id ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{t.name}</a>)}</div>}
      <Field label="Объём КП (частичное КП)"><select className="input" name="offer_scope" defaultValue={tv.offer_scope ?? "material_and_work"}><option value="material_and_work">материал и работа</option><option value="material_only">только материал</option><option value="install_only">только монтаж/работа</option></select></Field>
      <div><label className="label">Позиции материалов</label>{[0, 1, 2, 3, 4, 5].map((i) => { const m = tv.material_json?.[i]; return <div key={i} className="mb-1 grid grid-cols-6 gap-1"><input className="input col-span-3" name={`m_name_${i}`} placeholder="Наименование" defaultValue={m?.name} /><input className="input" name={`m_qty_${i}`} type="number" step="any" placeholder="кол-во" defaultValue={m?.qty} /><input className="input" name={`m_unit_${i}`} placeholder="ед." defaultValue={m?.unit} /><input className="input" name={`m_price_${i}`} type="number" placeholder="цена" defaultValue={m?.price} /></div>; })}</div>
      <div className="grid gap-2 sm:grid-cols-4"><Field label="Работа/монтаж, ₸"><input className="input" name="work_cost" type="number" defaultValue={tv.work_cost} /></Field><Field label="Доставка, ₸"><input className="input" name="delivery_cost" type="number" defaultValue={tv.delivery_cost} /></Field><Field label="Доставка, дн."><input className="input" name="delivery_days" type="number" defaultValue={tv.delivery_days} /></Field><Field label="Выполнение, дн."><input className="input" name="execution_days" type="number" defaultValue={tv.execution_days} /></Field></div>
      <div className="grid gap-2 sm:grid-cols-3"><Field label="Гарантия"><input className="input" name="warranty" defaultValue={tv.warranty} /></Field><Field label="Действует, дн."><input className="input" name="valid_days" type="number" defaultValue={14} /></Field><Field label="Вложение (URL)"><input className="input" name="attachment" placeholder="/uploads/..." /></Field></div>
      <label className="block text-sm"><input type="checkbox" name="mismatch" /> Есть отклонения от параметров заявки</label><input className="input" name="mismatch_notes" placeholder="Какие отклонения" />
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-sm"><label><input type="checkbox" name="save_template" /> сохранить как шаблон</label><input className="input w-60" name="template_name" placeholder="Название шаблона" /></div>
      <div className="flex gap-2"><button className="btn-primary" disabled={!lead || lead.status !== "purchased" || !licensed}>Отправить КП</button><button className="btn-secondary" name="action" value="decline">Отказаться от участия</button></div></form>
      <div className="card text-sm"><h2 className="h2 mb-2">Параметры заявки</h2><dl>{req.template.parameters.map((p) => <div key={p.id} className="flex justify-between gap-2 border-b border-slate-50 py-0.5"><dt className="muted">{p.label}</dt><dd className="text-right">{Array.isArray(values[p.key]) ? (values[p.key] as string[]).join(", ") : typeof values[p.key] === "boolean" ? (values[p.key] ? "да" : "нет") : String(values[p.key] ?? "—")}</dd></div>)}</dl></div></div></div>;
}
