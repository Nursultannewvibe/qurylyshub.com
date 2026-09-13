import { requireSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Dt, Flash } from "@/components/ui";
import { markReadAction } from "@/server/actions/misc";
import Link from "next/link";
export default async function Notifications({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const list = await prisma.notification.findMany({ where: { user_id: s.user.id }, orderBy: { created_at: "desc" }, take: 100 });
  return <div><div className="mb-4 flex items-center justify-between"><h1 className="h1">Уведомления</h1><div className="flex gap-2"><Link href="/settings/notifications" className="btn-secondary">Настройки каналов</Link><form action={markReadAction}><button className="btn-secondary">Прочитать все</button></form></div></div><Flash sp={sp} />
    <div className="card"><table className="table"><thead><tr><th>Когда</th><th>Канал</th><th>Тип</th><th>Данные</th><th>Доставка</th></tr></thead><tbody>{list.map((n) => <tr key={n.id} className={n.read ? "text-slate-400" : ""}><td><Dt d={n.created_at} /></td><td>{n.channel}</td><td><code className="text-xs">{n.type}</code></td><td className="text-xs">{JSON.stringify(n.payload_json).slice(0, 120)}</td><td className="text-xs">{n.sent_at ? `отправлено${n.digest_batch_id ? " (digest)" : ""}` : n.deferred_until ? `отложено до ${n.deferred_until.toLocaleString("ru-RU")}` : "—"}</td></tr>)}</tbody></table>{!list.length && <p className="muted">Пусто</p>}</div></div>;
}
