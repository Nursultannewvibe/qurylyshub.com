import { requireSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Flash } from "@/components/ui";
import { notificationPrefsAction } from "@/server/actions/misc";
export default async function NotifSettings({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const prefs = await prisma.notificationPreference.findMany({ where: { user_id: s.user.id } });
  const g = (ch: string) => prefs.find((p) => p.channel === ch);
  return <div className="mx-auto max-w-2xl"><h1 className="h1 mb-1">Уведомления — каналы и анти-спам</h1><p className="muted mb-4">Одно событие → in_app + не более одного внешнего канала (приоритет push → whatsapp → sms → email). Digest собирает уведомления к 09:00/18:00. В тихие часы уведомления откладываются (кроме критичных: сообщения по выбранной сделке, споры, оплата).</p><Flash sp={sp} />
    <form action={notificationPrefsAction} className="card"><table className="table"><thead><tr><th>Канал</th><th>Вкл</th><th>Digest</th><th>Тихие часы с</th><th>до</th></tr></thead><tbody>{["in_app", "push", "whatsapp", "sms", "email"].map((ch) => { const p = g(ch); return <tr key={ch}><td>{ch}</td><td><input type="checkbox" name={`${ch}_enabled`} defaultChecked={p?.enabled ?? ch === "in_app"} /></td><td>{ch !== "in_app" && <input type="checkbox" name={`${ch}_digest`} defaultChecked={p?.digest_mode} />}</td><td>{ch !== "in_app" && <input className="input w-20" name={`${ch}_qs`} type="number" min={0} max={23} defaultValue={p?.quiet_hours_start ?? ""} />}</td><td>{ch !== "in_app" && <input className="input w-20" name={`${ch}_qe`} type="number" min={0} max={23} defaultValue={p?.quiet_hours_end ?? ""} />}</td></tr>; })}</tbody></table><button className="btn-primary mt-3">Сохранить</button></form></div>;
}
