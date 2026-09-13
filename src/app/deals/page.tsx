import Link from "next/link";
import { requireSession } from "@/server/auth";
import { listDealsForUser } from "@/server/services/deals";
import { Badge, Dt, Flash, Money } from "@/components/ui";
export default async function Deals({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams; const deals = await listDealsForUser(s.user.id);
  return <div><h1 className="h1 mb-4">Сделки</h1><Flash sp={sp} /><div className="card"><table className="table"><thead><tr><th>Сделка</th><th>Объект</th><th>Исполнитель</th><th>Сумма</th><th>Комиссия</th><th>Этапы</th><th>Статус</th><th>Создана</th></tr></thead><tbody>{deals.map((d) => <tr key={d.id}><td><Link className="text-brand-600" href={`/deals/${d.id}`}>{d.request.category.name}</Link></td><td>{d.request.project.name}</td><td>{d.seller.name}</td><td><Money v={d.amount} /></td><td>{d.commission_percent.toString()}%</td><td>{d.milestones.filter((m) => ["accepted", "partially_accepted"].includes(m.status)).length}/{d.milestones.length}</td><td><Badge s={d.status} /></td><td><Dt d={d.created_at} /></td></tr>)}</tbody></table>{!deals.length && <p className="muted">Сделок нет</p>}</div></div>;
}
