import Link from "next/link";
import { requireSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { Flash } from "@/components/ui";
import { sendMessageAction } from "@/server/actions/buyer";

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { id } = await params; const sp = await searchParams; const s = await requireSession();
  const t = await prisma.thread.findUnique({ where: { id }, include: { request: { include: { category: true, project: true, deals: true } }, messages: { orderBy: { created_at: "asc" }, include: { sender: true } } } });
  if (!t) return <p>Не найдено</p>;
  const cids = s.user.companies.map((c) => c.id);
  if (t.buyer_id !== s.user.id && !cids.includes(t.seller_id) && !s.user.roles.includes("admin")) return <p className="text-red-700">Нет доступа</p>;
  const seller = await prisma.company.findUniqueOrThrow({ where: { id: t.seller_id } });
  const dealExists = t.request.deals.some((d) => d.seller_id === t.seller_id);
  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: t.buyer_id } });
  return <div className="mx-auto max-w-3xl"><h1 className="h1 mb-1">Чат: {t.request.category.name}</h1><p className="muted mb-3"><Link className="text-brand-600" href={`/requests/${t.request_id}`}>{t.request.project.name}</Link> · {seller.name} ↔ {buyer.name ?? "заказчик"}</p><Flash sp={sp} />
    {dealExists ? <p className="mb-2 rounded bg-green-50 p-2 text-sm text-green-800">Сделка заключена — контакты открыты: заказчик {buyer.phone}, компания {seller.name}, счёт {seller.bank_account ?? "—"}</p> : <p className="mb-2 rounded bg-amber-50 p-2 text-sm text-amber-800">До заключения сделки телефоны и мессенджеры скрыты. Попытка обмена контактами маскируется и фиксируется.</p>}
    <div className="card mb-3 space-y-2">{t.messages.map((m) => <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${m.sender_id === s.user.id ? "ml-auto bg-brand-100" : "bg-slate-100"}`}><div className="text-xs text-slate-500">{m.sender.name ?? m.sender.phone} · {m.created_at.toLocaleString("ru-RU")}{m.flagged_contact_leak ? " · ⚠ контакты скрыты" : ""}</div>{m.body}</div>)}{!t.messages.length && <p className="muted">Напишите первое сообщение</p>}</div>
    <form action={sendMessageAction} className="flex gap-2"><input type="hidden" name="thread_id" value={id} /><input className="input" name="body" placeholder="Сообщение" required /><button className="btn-primary">Отправить</button></form></div>;
}
