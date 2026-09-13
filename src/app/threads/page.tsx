import Link from "next/link";
import { requireSession } from "@/server/auth";
import { threadsForUser } from "@/server/services/chat";
import { Dt } from "@/components/ui";
export default async function Threads() {
  const s = await requireSession(); const list = await threadsForUser(s.user.id);
  return <div><h1 className="h1 mb-4">Чаты</h1><div className="card">{list.map((t) => <Link key={t.id} href={`/threads/${t.id}`} className="block border-b border-slate-100 py-2 text-sm hover:bg-slate-50"><b>{t.request.category.name}</b> · {t.request.project.name}<div className="muted">{t.messages[0]?.body.slice(0, 80) ?? "—"} · <Dt d={t.messages[0]?.created_at ?? t.created_at} /></div></Link>)}{!list.length && <p className="muted">Чатов нет</p>}</div></div>;
}
