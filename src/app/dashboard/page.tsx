import Link from "next/link";
import { requireSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Badge, Dt, Money } from "@/components/ui";
import { L, describeNotification } from "@/lib/i18n";

export default async function Dashboard() {
  const s = await requireSession();
  const roles = s.user.roles;
  const cids = s.user.companies.map((c) => c.id);
  const [projects, deals, offers, leads, notifications, disputes] = await Promise.all([
    prisma.project.count({ where: { OR: [{ owner_id: s.user.id }, { company_id: { in: cids } }] } }),
    prisma.deal.findMany({ where: { OR: [{ buyer_id: s.user.id }, { seller_id: { in: cids } }] }, include: { request: { include: { category: true, project: true } }, seller: true }, orderBy: { created_at: "desc" }, take: 5 }),
    prisma.offer.count({ where: { request: { project: { OR: [{ owner_id: s.user.id }, { company_id: { in: cids } }] } }, status: "sent" } }),
    prisma.lead.count({ where: { company_id: { in: cids }, status: "offered" } }),
    prisma.notification.findMany({ where: { user_id: s.user.id, channel: "in_app" }, orderBy: { created_at: "desc" }, take: 6 }),
    prisma.dispute.count({ where: { status: { in: ["open", "in_review"] }, deal: { OR: [{ buyer_id: s.user.id }, { seller_id: { in: cids } }] } } }),
  ]);
  const isBuyerRole = roles.includes("buyer"); const isSupplierRole = roles.includes("supplier") || roles.includes("contractor");
  const [myRequests, myLeadsOffered, myLeadsPurchased, pendingActs] = await Promise.all([
    prisma.request.count({ where: { project: { OR: [{ owner_id: s.user.id }, { company_id: { in: cids } }] }, status: { in: ["published", "needs_dispatcher"] } } }),
    prisma.lead.count({ where: { company_id: { in: cids }, status: "offered" } }),
    prisma.lead.count({ where: { company_id: { in: cids }, status: "purchased", request: { status: "published", offers: { none: { company_id: { in: cids } } } } } }),
    prisma.act.count({ where: { status: "draft", deal: { OR: [{ buyer_id: s.user.id }, { seller_id: { in: cids } }] } } }),
  ]);
  // «Что дальше» — один понятный следующий шаг по состоянию аккаунта
  let next: { text: string; href: string; cta: string } | null = null;
  if (isBuyerRole && projects === 0) next = { text: "Начните с объекта: опишите, что строите или ремонтируете.", href: "/projects/new", cta: "Создать объект" };
  else if (isBuyerRole && myRequests === 0 && offers === 0 && deals.length === 0) next = { text: "Объект есть — теперь создайте заявку: выберите категорию работ на странице объекта, и подходящие поставщики получат её сразу.", href: "/projects", cta: "К объектам" };
  else if (isBuyerRole && offers > 0) next = { text: `Вам пришло ${offers} коммерческих предложений (КП). Сравните их в таблице и выберите исполнителя — так создаётся сделка.`, href: "/inbox", cta: "Сравнить предложения" };
  else if (isSupplierRole && myLeadsOffered > 0) next = { text: `Есть ${myLeadsOffered} новых заявок по вашим категориям. Купите лид, чтобы увидеть адрес, открыть чат и отправить своё предложение.`, href: "/supplier/leads", cta: "Смотреть заявки" };
  else if (isSupplierRole && myLeadsPurchased > 0) next = { text: `По ${myLeadsPurchased} заявкам вы ещё не отправили коммерческое предложение.`, href: "/supplier/leads", cta: "Отправить КП" };
  else if (pendingActs > 0) next = { text: `Есть ${pendingActs} актов, ожидающих подписи.`, href: "/deals", cta: "К сделкам" };
  else if (deals.some((d) => d.status === "awaiting_payment") && isBuyerRole) next = { text: "Сделка создана — оплатите первый этап: деньги удерживаются платформой (эскроу) и уходят исполнителю только после вашей приёмки.", href: `/deals/${deals.find((d) => d.status === "awaiting_payment")!.id}`, cta: "Оплатить этап" };
  const tiles: [string, string | number, string][] = [];
  if (roles.includes("buyer")) tiles.push(["Объектов", projects, "/projects"], ["Новых КП", offers, "/inbox"]);
  if (roles.includes("supplier") || roles.includes("contractor")) tiles.push(["Новых лидов", leads, "/supplier/leads"]);
  tiles.push(["Сделок", deals.length, "/deals"], ["Открытых споров", disputes, "/deals"]);
  return <div>
    <div className="mb-5 flex items-center justify-between"><div><h1 className="h1">Кабинет</h1><p className="muted">{s.user.name ?? s.user.phone} · {roles.map(L).join(", ")} {s.user.companies.length ? `· ${s.user.companies.map((c) => c.name).join(", ")}` : ""}</p></div>
      <div className="flex gap-2">{roles.includes("buyer") && <Link href="/projects/new" className="btn-primary">+ Объект</Link>}{s.user.companies.some((c) => c.role === "buyer") && <Link href="/broadcast" className="btn-secondary">Массовая рассылка</Link>}</div></div>
    {next && <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-brand-500 bg-brand-50"><div><div className="text-xs font-semibold uppercase text-brand-700">Следующий шаг</div><div>{next.text}</div></div><Link href={next.href} className="btn-primary">{next.cta}</Link></div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([l, v, h]) => <Link key={l} href={h} className="card hover:border-brand-500"><div className="text-2xl font-bold">{v}</div><div className="muted">{l}</div></Link>)}</div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="card"><h2 className="h2 mb-2">Последние сделки</h2>{deals.length ? <table className="table"><tbody>{deals.map((d) => <tr key={d.id}><td><Link href={`/deals/${d.id}`} className="text-brand-600">{d.request.category.name}</Link><div className="muted">{d.request.project.name} · {d.seller.name}</div></td><td><Money v={d.amount} /></td><td><Badge s={d.status} /></td></tr>)}</tbody></table> : <p className="muted">{isBuyerRole ? "Сделка появится, когда вы выберете одно из предложений поставщиков по заявке." : "Сделка появится, когда заказчик выберет ваше предложение."}</p>}</div>
      <div className="card"><h2 className="h2 mb-2">Уведомления</h2>{notifications.length ? <ul className="space-y-1 text-sm">{notifications.map((n) => { const d = describeNotification(n.type, (n.payload_json ?? {}) as Record<string, unknown>); return <li key={n.id} className={n.read ? "text-slate-500" : ""}><span className="mr-2 text-xs text-slate-400"><Dt d={n.created_at} /></span>{d.href ? <Link href={d.href} className="hover:underline">{d.title}</Link> : d.title}</li>; })}</ul> : <p className="muted">Уведомлений пока нет — здесь появятся новые заявки, предложения и события по сделкам.</p>}<Link href="/notifications" className="muted mt-2 inline-block">Все →</Link></div>
    </div>
  </div>;
}
