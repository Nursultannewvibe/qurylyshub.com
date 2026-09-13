import Link from "next/link";
import { requireSession, requireRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { Badge, Money } from "@/components/ui";
export default async function Supervisor() {
  const s = await requireSession(); requireRole(s, "supervisor");
  const deals = await prisma.deal.findMany({ where: { status: { in: ["in_progress", "awaiting_payment", "completed"] } }, include: { request: { include: { category: true, project: true } }, seller: true, milestones: true, acts: { where: { act_type: "supervisor_conclusion" } } }, orderBy: { created_at: "desc" } });
  const att = await prisma.verification.findFirst({ where: { doc_type: "attestation", status: "verified", company: { members: { some: { user_id: s.user.id } } } } });
  return <div><h1 className="h1 mb-1">Технадзор</h1><p className="muted mb-4">Аттестат: {att ? <Badge s="verified">verified до {att.valid_until?.toLocaleDateString("ru-RU")}</Badge> : <span className="text-red-700">не верифицирован</span>}. Технадзор — живой аттестованный специалист; платформа заключений не выносит. Откройте сделку: там можно отметить пункты чек-листа с фото, сформировать и подписать заключение, оставить отзыв от имени технадзора.</p>
    <div className="card"><table className="table"><thead><tr><th>Сделка</th><th>Объект</th><th>Исполнитель</th><th>Сумма</th><th>Этапы</th><th>Заключение</th></tr></thead><tbody>{deals.map((d) => <tr key={d.id}><td><Link className="text-brand-600" href={`/deals/${d.id}`}>{d.request.category.name}</Link> <Badge s={d.status} /></td><td>{d.request.project.name}{d.request.project.needs_tech_supervision ? " · технадзор обязателен" : ""}</td><td>{d.seller.name}</td><td><Money v={d.amount} /></td><td>{d.milestones.map((m) => <Badge key={m.id} s={m.status} />)}</td><td>{d.acts.length ? <Badge s={d.acts[0].status} /> : "—"}</td></tr>)}</tbody></table></div></div>;
}
