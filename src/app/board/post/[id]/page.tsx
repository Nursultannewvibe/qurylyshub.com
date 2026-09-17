import Link from "next/link";
import { getPost } from "@/server/services/board";
import { getSession } from "@/server/auth";
import { Dt, Flash } from "@/components/ui";
import { createReplyAction, reportAction } from "@/server/actions/board";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const [post, session] = await Promise.all([getPost(id).catch(() => null), getSession()]);
  if (!post) notFound();
  const Report = ({ type, target }: { type: "post" | "reply"; target: string }) => session ? <form action={reportAction} className="inline-flex gap-1"><input type="hidden" name="post_id" value={id} /><input type="hidden" name="target_type" value={type} /><input type="hidden" name="target_id" value={target} /><input className="input w-40 text-xs" name="reason" placeholder="Причина жалобы" /><button className="btn-secondary text-xs">Пожаловаться</button></form> : null;
  return <div className="mx-auto max-w-3xl"><Link href={`/board/${post.category.code}${post.region ? "/" + post.region.code : ""}`} className="muted">← {post.category.name}{post.region ? " · " + post.region.name : ""}</Link><Flash sp={sp} />
    <div className="card mt-2"><h1 className="h1">{post.title}</h1><div className="muted text-xs">{post.company ? <Link href={`/catalog/${post.company.public_slug}`} className="text-brand-600">{post.company.name}{post.company.verifications.length ? " ✓ верифицирована" : ""}{post.company.legal_type === "individual_contractor" ? " · физлицо-исполнитель" : ""}</Link> : post.author.name ?? "Пользователь"} · <Dt d={post.created_at} /></div><p className="mt-3 whitespace-pre-wrap text-sm">{post.body}</p><div className="mt-2"><Report type="post" target={post.id} /></div></div>
    <h2 className="h2 mt-4 mb-2">Ответы ({post.replies.length})</h2>
    {post.replies.map((r) => { const co = r.author.company_members[0]?.company; return <div key={r.id} className="card mb-2 text-sm"><div className="muted text-xs">{co ? <Link href={`/catalog/${co.public_slug}`} className="text-brand-600">{co.name}{co.verifications.length ? " ✓ верифицирована" : ""}</Link> : r.author.name ?? "Пользователь"} · <Dt d={r.created_at} /></div><p className="mt-1 whitespace-pre-wrap">{r.body}</p><div className="mt-1"><Report type="reply" target={r.id} /></div></div>; })}
    {session ? <form action={createReplyAction} className="card space-y-2"><input type="hidden" name="post_id" value={id} /><textarea className="input" name="body" rows={3} required placeholder="Ваш ответ (публично)" /><button className="btn-primary">Ответить</button></form> : <p className="card muted">Чтобы ответить — <Link className="text-brand-600" href={`/login?next=/board/post/${id}`}>войдите</Link>.</p>}</div>;
}
