import Link from "next/link";
import { listPosts } from "@/server/services/board";
import { getSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Dt, Field, Flash } from "@/components/ui";
import { createPostAction } from "@/server/actions/board";
import { config } from "@/server/config";
import { notFound } from "next/navigation";

export async function BoardList({ category, region, sp }: { category: string; region: string | null; sp: { error?: string; ok?: string } }) {
  const data = await listPosts(category, region).catch(() => null);
  if (!data) notFound();
  const { category: cat, region: reg, posts } = data;
  const [session, regions] = await Promise.all([getSession(), prisma.region.findMany({ orderBy: { name: "asc" } })]);
  const base = `/board/${cat.code}${reg ? "/" + reg.code : ""}`;
  return <div><Link href="/board" className="muted">← все категории</Link><h1 className="h1 mb-1">{cat.name}{reg ? ` · ${reg.name}` : ""}</h1><Flash sp={sp} />
    <div className="mb-3 flex flex-wrap gap-1 text-xs"><Link href={`/board/${cat.code}`} className={`badge ${!reg ? "bg-brand-600 text-white" : "bg-slate-100"}`}>все регионы</Link>{regions.filter((r) => !r.parent_id || ["almaty_obl"].includes(r.parent_id)).map((r) => <Link key={r.id} href={`/board/${cat.code}/${r.code}`} className={`badge ${reg?.id === r.id ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{r.name}</Link>)}</div>
    <div className="grid gap-4 lg:grid-cols-3"><div className="lg:col-span-2 space-y-2">{posts.map((p) => <div key={p.id} className="card"><Link href={`/board/post/${p.id}`} className="font-semibold text-brand-700">{p.title}</Link><p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.body}</p><div className="muted mt-1 text-xs">{p.company ? <>{p.company.name}{p.company.verifications.length ? " ✓" : ""}{p.company.legal_type === "individual_contractor" ? " · физлицо-исполнитель" : ""}</> : p.author.name ?? "Пользователь"}{p.region ? " · " + p.region.name : ""} · ответов {p._count.replies} · <Dt d={p.created_at} /></div></div>)}{!posts.length && <p className="muted">Веток пока нет. {session ? "Задайте первый вопрос справа." : "Войдите, чтобы начать ветку."}</p>}</div>
      <div className="card">{session ? <form action={createPostAction} className="space-y-2"><h2 className="h2">Новая ветка</h2><input type="hidden" name="category_id" value={cat.id} /><input type="hidden" name="back" value={base} />
        <Field label="Регион (необязательно)"><select className="input" name="region_id" defaultValue={reg?.id ?? ""}><option value="">—</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
        {session.user.companies.length > 0 && <Field label="От лица"><select className="input" name="company_id"><option value="">лично</option>{session.user.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        <Field label="Заголовок"><input className="input" name="title" required maxLength={200} placeholder="Сколько реально стоит фундамент под дом 120 м²?" /></Field>
        <Field label="Текст"><textarea className="input" name="body" rows={5} required maxLength={5000} /></Field>
        <button className="btn-primary">Опубликовать</button><p className="text-xs text-slate-400">Публично, без личных сообщений. Лимит {config.boardPostDailyLimit} веток в день.</p></form>
        : <><h2 className="h2">Хотите спросить?</h2><p className="muted mb-2">Читать можно без входа. Чтобы написать — войдите.</p><Link href={`/login?next=${encodeURIComponent(base)}`} className="btn-primary">Войти</Link></>}</div></div></div>;
}
