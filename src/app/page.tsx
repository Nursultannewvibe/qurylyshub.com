import Link from "next/link";
import { getLocale } from "@/server/locale";
import { t } from "@/lib/i18n";
import { prisma } from "@/server/db";
import { getSession } from "@/server/auth";

export default async function Home() {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  const [suppliers, projects, deals] = await Promise.all([prisma.company.count({ where: { role: { in: ["supplier", "contractor"] } } }), prisma.project.count(), prisma.deal.count()]);
  return (
    <div>
      <section className="card mb-6 bg-gradient-to-br from-brand-50 to-white p-8">
        <h1 className="text-3xl font-bold text-slate-900">{t(locale, "hero_title")}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t(locale, "hero_text")}</p>
        <div className="mt-5 flex gap-3">
          <Link href={session ? "/dashboard" : "/login"} className="btn-primary">{session ? t(locale, "dashboard") : t(locale, "login")}</Link>
          <Link href="/catalog" className="btn-secondary">{t(locale, "catalog")}</Link>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Поставщиков и подрядчиков", suppliers], ["Объектов", projects], ["Сделок", deals]].map(([l, v]) => <div key={String(l)} className="card"><div className="text-3xl font-bold text-brand-700">{v}</div><div className="muted">{l}</div></div>)}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[["Заказчику", "Паспорт объекта с регуляторным блоком, этапы, заявки в 3 режима, сравнение КП по единому формату, эскроу и акты."], ["Поставщику / подрядчику", "Лиды по вашей зоне и категориям, лимит нагрузки, шаблоны КП, карта объектов и встречные предложения без спама."], ["Доверие", "Только верифицированные отзывы по сделкам, AI-саммари, споры с блокировкой эскроу, аттестованный технадзор."]].map(([h, p]) => <div key={h} className="card"><h3 className="h2">{h}</h3><p className="muted mt-1">{p}</p></div>)}
      </div>
    </div>
  );
}
