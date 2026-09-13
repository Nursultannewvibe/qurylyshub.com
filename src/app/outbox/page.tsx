import Link from "next/link";
import { requireSession } from "@/server/auth";
import { buyerOutbox } from "@/server/services/requests";
import { Badge, Dt, Flash } from "@/components/ui";
import { L } from "@/lib/i18n";

export default async function Outbox({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const reqs = await buyerOutbox(s.user.id);
  return <div><h1 className="h1 mb-4">Исходящие заявки</h1><Flash sp={sp} />
    <div className="card"><table className="table"><thead><tr><th>Заявка</th><th>Объект</th><th>Режим</th><th>Статус</th><th>Кому ушла</th><th>Ответили КП</th><th>Создана</th></tr></thead><tbody>{reqs.map((r) => <tr key={r.id}><td><Link className="text-brand-600" href={`/requests/${r.id}`}>{r.category.name}</Link></td><td>{r.project.name}</td><td>{L(r.mode)}</td><td><Badge s={r.status} /></td><td className="text-xs">{r.leads.map((l) => <div key={l.id}>{l.company.name} <Badge s={l.status} /></div>)}{!r.leads.length && "—"}</td><td>{r.offers.filter((o) => o.status !== "declined").length}</td><td><Dt d={r.created_at} /></td></tr>)}</tbody></table>{!reqs.length && <p className="muted">Вы ещё не отправляли заявок. Откройте объект и выберите категорию работ.</p>}</div></div>;
}
