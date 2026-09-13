import Link from "next/link";
import { requireSession } from "@/server/auth";
import { buyerInbox } from "@/server/services/requests";
import { Badge, Dt, Flash, Money } from "@/components/ui";
import { respondPitchAction } from "@/server/actions/buyer";

export default async function Inbox({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const { offers, pitches } = await buyerInbox(s.user.id);
  return <div><h1 className="h1 mb-4">Входящие</h1><Flash sp={sp} />
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card"><h2 className="h2 mb-2">Коммерческие предложения ({offers.length})</h2>{offers.length ? <table className="table"><thead><tr><th>Заявка</th><th>Компания</th><th>ИТОГО</th><th>Статус</th></tr></thead><tbody>{offers.map((o) => <tr key={o.id}><td><Link className="text-brand-600" href={`/requests/${o.request_id}`}>{o.request.category.name}</Link><div className="muted">{o.request.project.name}</div></td><td>{o.company.name} <span className="muted">★{o.company.reputation?.avg_rating?.toFixed(1)}</span></td><td><Money v={o.total} /></td><td><Badge s={o.status} /><div className="text-xs text-slate-400"><Dt d={o.created_at} /></div></td></tr>)}</tbody></table> : <p className="muted">КП пока нет</p>}</div>
      <div className="card"><h2 className="h2 mb-2">Встречные предложения поставщиков ({pitches.length})</h2>{pitches.map((p) => <div key={p.id} className="border-t border-slate-100 py-2 text-sm"><div className="flex justify-between"><b>{p.company.name}</b> <Badge s={p.status} /></div><div className="muted">{p.category.name} · объект «{p.project.name}» · до <Dt d={p.expires_at} /></div><p>{p.message}{p.price_estimate ? <> · ориентир <Money v={p.price_estimate} /></> : null}</p>{["sent", "viewed"].includes(p.status) && <form action={respondPitchAction} className="mt-1 flex gap-2"><input type="hidden" name="pitch_id" value={p.id} /><button className="btn-primary" name="action" value="accept">Принять → создать заявку</button><button className="btn-secondary" name="action" value="decline">Отклонить</button></form>}</div>)}{!pitches.length && <p className="muted">Предложений нет. Включите «виден на карте» в настройках объекта.</p>}</div>
    </div></div>;
}
