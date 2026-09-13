import Link from "next/link";
import { requireSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Badge, Dt, Money } from "@/components/ui";

export default async function Dashboard() {
  const s = await requireSession();
  const roles = s.user.roles;
  const cids = s.user.companies.map((c) => c.id);
  const [projects, deals, offers, leads, notifications, disputes] = await Promise.all([
    prisma.project.count({ where: { OR: [{ owner_id: s.user.id }, { company_id: { in: cids } }] } }),
    prisma.deal.findMany({ where: { OR: [{ buyer_id: s.user.id }, { seller_id: { in: cids } }] }, include: { request: { include: { category: true, project: true } }, seller: true }, orderBy: { created_at: "desc" }, take: 5 }),
    prisma.offer.count({ where: { request: { project: { OR: [{ owner_id: s.user.id }, { company_id: { in: cids } }] } }, status: "sent" } }),
    prisma.lead.count({ where: { company_id: { in: cids }, status: "offered" } }),
    prisma.notification.findMany({ where: { user_id: s.user.id, channel: "in_app" }, orderBy: { created_at: "desc" }, take: 6 }),
    prisma.dispute.count({ where: { status: { in: ["open", "in_review"] }, deal: { OR: [{ buyer_id: s.user.id }, { seller_id: { in: cids } }] } } }),
  ]);
  const tiles: [string, string | number, string][] = [];
  if (roles.includes("buyer")) tiles.push(["Объектов", projects, "/projects"], ["Новых КП", offers, "/inbox"]);
  if (roles.includes("supplier") || roles.includes("contractor")) tiles.push(["Новых лидов", leads, "/supplier/leads"]);
  tiles.push(["Сделок", deals.length, "/deals"], ["Открытых споров", disputes, "/deals"]);
  return <div>
    <div className="mb-5 flex items-center justify-between"><div><h1 className="h1">Кабинет</h1><p className="muted">{s.user.name ?? s.user.phone} · роли: {roles.join(", ")} {s.user.companies.length ? `· ${s.user.companies.map((c) => c.name).join(", ")}` : ""}</p></div>
      <div className="flex gap-2">{roles.includes("buyer") && <Link href="/projects/new" className="btn-primary">+ Объект</Link>}{s.user.companies.some((c) => c.role === "buyer") && <Link href="/broadcast" className="btn-secondary">Массовая рассылка</Link>}</div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([l, v, h]) => <Link key={l} href={h} className="card hover:border-brand-500"><div className="text-2xl font-bold">{v}</div><div className="muted">{l}</div></Link>)}</div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="card"><h2 className="h2 mb-2">Последние сделки</h2>{deals.length ? <table className="table"><tbody>{deals.map((d) => <tr key={d.id}><td><Link href={`/deals/${d.id}`} className="text-brand-600">{d.request.category.name}</Link><div className="muted">{d.request.project.name} · {d.seller.name}</div></td><td><Money v={d.amount} /></td><td><Badge s={d.status} /></td></tr>)}</tbody></table> : <p className="muted">Сделок пока нет</p>}</div>
      <div className="card"><h2 className="h2 mb-2">Уведомления</h2>{notifications.length ? <ul className="space-y-1 text-sm">{notifications.map((n) => <li key={n.id} className={n.read ? "text-slate-500" : ""}><span className="mr-2 text-xs text-slate-400"><Dt d={n.created_at} /></span><code className="text-xs">{n.type}</code> {JSON.stringify(n.payload_json).slice(0, 80)}</li>)}</ul> : <p className="muted">Пусто</p>}<Link href="/notifications" className="muted mt-2 inline-block">Все →</Link></div>
    </div>
  </div>;
}
