import Link from "next/link";
import { notFound } from "next/navigation";
import { companyCard } from "@/server/services/catalog";
import { getSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Badge, Dt, Flash, FileLink } from "@/components/ui";
import { reviewResponseAction, reviewDisputeAction } from "@/server/actions/deals";

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { slug: rawSlug } = await params; const sp = await searchParams;
  const slug = decodeURIComponent(rawSlug); // старые кириллические slug приходят percent-encoded
  const c = await companyCard(slug);
  if (!c) notFound();
  const s = await getSession();
  const isOwner = !!s?.user.companies.some((x) => x.id === c.id);
  const myProjects = s ? await prisma.project.findMany({ where: { owner_id: s.user.id, status: "active" } }) : [];
  const rep = c.reputation;
  return <div className="grid gap-4 lg:grid-cols-3">
    <div className="lg:col-span-2 space-y-4"><Flash sp={sp} />
      <div className="card"><div className="flex items-start justify-between"><div><h1 className="h1">{c.name}</h1><p className="muted">{c.legal_type === "individual_contractor" ? <span className="badge bg-amber-100 text-amber-900">физлицо-исполнитель · без юрлица, лицензируемые работы недоступны</span> : <>{c.legal_type.toUpperCase()} · БИН {c.bin}</>} · {c.city ?? c.region} · {c.role === "supplier" ? "поставщик" : "подрядчик"}</p></div><div className="text-right"><div className="text-3xl font-bold">★ {rep?.avg_rating?.toFixed(1) ?? "0.0"}</div><div className="muted">{rep?.deals_count ?? 0} сделок · в срок {rep?.on_time_pct ?? 100}%</div></div></div>
        <p className="mt-3 text-sm">{c.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">{c.categories.map((k) => <span key={k.id} className="badge bg-slate-100">{k.name}{k.required_license ? " 🪪" : ""}</span>)}</div>
        {c.soft_banned_until && c.soft_banned_until > new Date() && <p className="mt-2 text-sm text-red-700">⚠ Компания временно ограничена (soft-ban) до <Dt d={c.soft_banned_until} /></p>}
      </div>
      {(rep?.ai_summary_praise || rep?.ai_summary_complaints) && <div className="card"><h2 className="h2 mb-2">AI-саммари отзывов <span className="muted">(только по верифицированным сделкам)</span></h2><div className="grid gap-2 sm:grid-cols-3 text-sm"><div className="rounded bg-green-50 p-2"><b>Хвалят</b><p>{rep.ai_summary_praise}</p></div><div className="rounded bg-amber-50 p-2"><b>Ругают</b><p>{rep.ai_summary_complaints}</p></div><div className="rounded bg-slate-50 p-2"><b>Инциденты</b><p>{rep.ai_summary_incidents}</p></div></div></div>}
      <div className="card"><h2 className="h2 mb-2">Верифицированные отзывы ({c.reviews_received.length})</h2>{c.reviews_received.map((r) => <div key={r.id} className="border-t border-slate-100 py-2 text-sm"><div className="flex justify-between"><span>{"★".repeat(r.rating)} <b>{r.author.name ?? "Заказчик"}</b> <span className="muted">({r.author_role === "supervisor" ? "технадзор" : "заказчик"}, вес {r.weight.toFixed(2)})</span></span><span className="muted"><Dt d={r.created_at} /></span></div><p>{r.text}</p><div className="flex gap-1">{(r.photo_urls_json as string[]).map((u, i) => <FileLink key={i} url={u} label="фото" />)}</div>
        {r.responses.map((x) => <p key={x.id} className="ml-4 mt-1 border-l-2 border-brand-500 pl-2 text-slate-600"><b>Ответ компании:</b> {x.text}</p>)}
        {r.disputes.map((d) => <p key={d.id} className="ml-4 text-xs text-amber-700">Оспаривание: <Badge s={d.status} /> {d.reason}</p>)}
        {isOwner && <div className="mt-1 flex gap-2"><form action={reviewResponseAction} className="flex gap-1"><input type="hidden" name="review_id" value={r.id} /><input type="hidden" name="back" value={`/catalog/${slug}`} /><input className="input" name="text" placeholder="Ответить" required /><button className="btn-secondary">Ответ</button></form>{!r.disputes.length && <form action={reviewDisputeAction} className="flex gap-1"><input type="hidden" name="review_id" value={r.id} /><input type="hidden" name="back" value={`/catalog/${slug}`} /><input className="input" name="reason" placeholder="Причина оспаривания" required /><button className="btn-secondary">Оспорить</button></form>}</div>}
      </div>)}{!c.reviews_received.length && <p className="muted">Отзывов пока нет</p>}</div>
      {(c.portfolio_json as { title: string; photo: string }[]).length > 0 && <div className="card"><h2 className="h2 mb-2">Портфолио</h2><ul className="flex flex-wrap gap-3 text-sm">{(c.portfolio_json as { title: string; photo: string }[]).map((p, i) => <li key={i} className="flex items-center gap-2"><FileLink url={p.photo} label={p.title} /> <span>{p.title}</span></li>)}</ul></div>}
    </div>
    <div className="space-y-4">
      <div className="card"><h2 className="h2 mb-2">Отправить точечный запрос</h2>{s ? myProjects.length ? <ul className="space-y-1 text-sm">{myProjects.map((p) => <li key={p.id}><Link className="text-brand-600" href={`/projects/${p.id}/requests/new?target=${c.id}`}>→ по объекту «{p.name}»</Link></li>)}</ul> : <Link href="/projects/new" className="btn-primary">Создать объект</Link> : <Link href="/login" className="btn-primary">Войти, чтобы отправить запрос</Link>}</div>
      <div className="card"><h2 className="h2 mb-2">Документы и лицензии</h2><ul className="text-sm">{c.verifications.map((v) => <li key={v.id}>{v.doc_type} {v.category_id ? `(${c.categories.find((k) => k.id === v.category_id)?.name ?? ""})` : ""} <Badge s={v.status} /> {v.valid_until ? <span className="muted">до <Dt d={v.valid_until} /></span> : null}</li>)}</ul></div>
      {c.external_profiles.length > 0 && <div className="card"><h2 className="h2 mb-2">Внешние профили</h2><ul className="text-sm">{c.external_profiles.map((e) => <li key={e.id}><a className="text-brand-600" href={e.url} target="_blank" rel="noreferrer">{e.platform}: {e.url}</a></li>)}</ul><p className="mt-1 text-xs text-slate-400">Только ссылки, указанные компанией; не парсятся.</p></div>}
    </div>
  </div>;
}
