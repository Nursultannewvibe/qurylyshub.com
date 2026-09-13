import Link from "next/link";
import { catalog } from "@/server/services/catalog";
import { prisma } from "@/server/db";

export default async function Catalog({ searchParams }: { searchParams: Promise<{ category?: string; region?: string; q?: string }> }) {
  const sp = await searchParams;
  const [list, cats, regions] = await Promise.all([catalog(sp), prisma.category.findMany({ orderBy: { order_index: "asc" } }), prisma.region.findMany({ orderBy: { name: "asc" } })]);
  return <div>
    <h1 className="h1 mb-4">Каталог поставщиков и подрядчиков</h1>
    <form className="card mb-4 grid gap-2 sm:grid-cols-4"><input className="input" name="q" placeholder="Поиск по названию" defaultValue={sp.q} />
      <select className="input" name="category" defaultValue={sp.category ?? ""}><option value="">Все категории</option>{cats.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}</select>
      <select className="input" name="region" defaultValue={sp.region ?? ""}><option value="">Все регионы</option>{regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</select>
      <button className="btn-primary">Найти</button></form>
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{list.map((c) => <Link key={c.id} href={`/catalog/${c.public_slug}`} className="card hover:border-brand-500">
      <div className="flex items-start justify-between"><div className="font-semibold">{c.name}</div><div className="text-sm">★ {c.reputation?.avg_rating?.toFixed(1) ?? "0.0"}</div></div>
      <div className="muted">{c.city ?? c.region} · {c.legal_type.toUpperCase()} · {c.role === "supplier" ? "поставщик" : "подрядчик"}</div>
      <div className="mt-2 flex flex-wrap gap-1">{c.category_names.map((n) => <span key={n} className="badge bg-slate-100 text-slate-700">{n}</span>)}</div>
      <div className="mt-2 text-xs text-slate-500">Сделок: {c.reputation?.deals_count ?? 0} · В срок: {c.reputation?.on_time_pct ?? 100}% · Верификаций: {c.verifications.length}{c.soft_banned_until && c.soft_banned_until > new Date() ? " · ⚠ soft-ban" : ""}</div>
    </Link>)}{!list.length && <p className="muted">Ничего не найдено</p>}</div>
  </div>;
}
