import { requireSession, companyOf } from "@/server/auth";
import { mapProjectsForCompany } from "@/server/services/pitches";
import { prisma } from "@/server/db";
import { Badge, Flash } from "@/components/ui";
import { pitchAction } from "@/server/actions/supplier";

export default async function MapPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams; const c = companyOf(s);
  const [items, company] = await Promise.all([mapProjectsForCompany(c.id), prisma.company.findUniqueOrThrow({ where: { id: c.id } })]);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.supplierPitch.count({ where: { company_id: c.id, created_at: { gte: dayStart } } });
  const byDistrict = new Map<string, typeof items>();
  for (const p of items) { const k = `${p.city}${p.district ? " · " + p.district : ""}`; byDistrict.set(k, [...(byDistrict.get(k) ?? []), p]); }
  return <div><h1 className="h1 mb-1">Карта объектов</h1><p className="muted mb-4">Только объекты, открытые заказчиком для встречных предложений, в рамках ваших категорий. Метки по району и категории; адрес и контакты — после отклика заказчика. Лимит: {sentToday}/{company.pitch_daily_limit} в день, cooldown {company.pitch_cooldown_days} дн. на объект.</p><Flash sp={sp} />
    {[...byDistrict].map(([district, ps]) => <div key={district} className="mb-4"><h2 className="h2 mb-2">📍 {district}</h2><div className="grid gap-3 md:grid-cols-2">{ps.map((p) => <div key={p.id} className="card"><div className="font-semibold">{p.object_type} · {p.area ?? "?"} м² · {p.floors ?? "?"} эт.</div><div className="mt-1 flex flex-wrap gap-1">{p.categories.map((k) => <span key={k.id} className={`badge ${k.has_open_request ? "bg-green-100 text-green-800" : "bg-slate-100"}`}>{k.name}{k.has_open_request ? " · есть заявка" : ""}</span>)}</div>{p.last_pitch && <p className="mt-1 text-xs text-slate-500">Ваше последнее предложение: <Badge s={p.last_pitch.status} /> {p.last_pitch.created_at.toLocaleDateString("ru-RU")}</p>}
      <form action={pitchAction} className="mt-2 grid gap-1"><input type="hidden" name="project_id" value={p.id} /><select className="input" name="category_id">{p.categories.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select><input className="input" name="message" placeholder="Встречное предложение (кратко)" required /><div className="flex gap-1"><input className="input" name="price_estimate" type="number" placeholder="Ориентир цены, ₸" /><button className="btn-primary">Отправить</button></div></form></div>)}</div></div>)}
    {!items.length && <p className="muted">Открытых объектов в ваших категориях нет.</p>}</div>;
}
