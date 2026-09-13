import Link from "next/link";
import { requireSession } from "@/server/auth";
import { listProjectsForUser } from "@/server/services/projects";
import { Badge, Flash } from "@/components/ui";
import { prisma } from "@/server/db";

export default async function Projects({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const [projects, types] = await Promise.all([listProjectsForUser(s.user.id), prisma.objectType.findMany()]);
  const tn = (c: string) => types.find((t) => t.code === c)?.name ?? c;
  const roots = projects.filter((p) => !p.parent_project_id);
  return <div><div className="mb-4 flex items-center justify-between"><h1 className="h1">Объекты</h1><Link href="/projects/new" className="btn-primary">+ Новый объект</Link></div><Flash sp={sp} />
    <div className="grid gap-3 md:grid-cols-2">{roots.map((p) => <div key={p.id} className="card"><div className="flex justify-between"><Link href={`/projects/${p.id}`} className="font-semibold text-brand-700">{p.name}</Link><Badge s={p.status} /></div><div className="muted">{tn(p.object_type)} · {p.city}{p.district ? ", " + p.district : ""} · {p.area ?? "?"} м²</div><div className="mt-1 text-xs text-slate-500">Заявок: {p.requests.length} · открытых: {p.requests.filter((r) => r.status === "published").length}{p.open_to_pitches ? " · виден на карте" : ""}</div>
      {p.children.length > 0 && <ul className="mt-2 border-l-2 border-slate-200 pl-3 text-sm">{p.children.map((c) => <li key={c.id}><Link href={`/projects/${c.id}`} className="text-brand-600">↳ {c.name}</Link></li>)}</ul>}</div>)}{!roots.length && <p className="muted">Объектов нет — создайте первый.</p>}</div></div>;
}
