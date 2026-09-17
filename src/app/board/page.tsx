import Link from "next/link";
import { boardOverview } from "@/server/services/board";
import { Dt } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function BoardIndex() {
  const { cats, latest } = await boardOverview();
  return <div><h1 className="h1 mb-1">Доска обсуждений</h1><p className="muted mb-4">Публичные ветки по категориям работ и регионам: вопросы о ценах, технологиях, опыте. Читать может любой, писать — после входа. Личных сообщений и закрытых групп здесь нет намеренно — для переписки по конкретной заявке есть чат в заявке.</p>
    <div className="grid gap-4 lg:grid-cols-3"><div className="card lg:col-span-2"><h2 className="h2 mb-2">Категории</h2><div className="grid gap-1 sm:grid-cols-2">{cats.map((c) => <Link key={c.id} href={`/board/${c.code}`} className="flex justify-between rounded px-2 py-1 hover:bg-slate-50"><span>{c.name}</span><span className="muted">{c._count.board_posts}</span></Link>)}</div></div>
      <div className="card"><h2 className="h2 mb-2">Последние ветки</h2>{latest.map((p) => <div key={p.id} className="border-t border-slate-100 py-1 text-sm"><Link href={`/board/post/${p.id}`} className="text-brand-600">{p.title}</Link><div className="muted text-xs">{p.category.name}{p.region ? " · " + p.region.name : ""} · ответов {p._count.replies} · <Dt d={p.created_at} /></div></div>)}{!latest.length && <p className="muted">Пока пусто — начните первую ветку в своей категории.</p>}</div></div></div>;
}
