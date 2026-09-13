import { requireSession, companyOf } from "@/server/auth";
import { prisma } from "@/server/db";
import { Badge, Dt, Flash, Money } from "@/components/ui";
import { topUpAction, payoutAction } from "@/server/actions/supplier";

export default async function Wallet({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams; const c = companyOf(s);
  const [wallet, payouts, subs, company] = await Promise.all([prisma.wallet.findUnique({ where: { company_id: c.id }, include: { transactions: { orderBy: { created_at: "desc" }, take: 30 } } }), prisma.payoutRequest.findMany({ where: { company_id: c.id }, orderBy: { requested_at: "desc" } }), prisma.subscription.findMany({ where: { company_id: c.id } }), prisma.company.findUniqueOrThrow({ where: { id: c.id } })]);
  const key = `topup:${c.id}:${Date.now()}`;
  return <div><h1 className="h1 mb-4">Кошелёк — {company.name}</h1><Flash sp={sp} />
    <div className="grid gap-4 lg:grid-cols-3"><div className="card"><div className="text-3xl font-bold"><Money v={wallet?.balance} /></div><div className="muted">баланс (лиды списываются отсюда; раскрытый эскроу зачисляется сюда)</div>
      <form action={topUpAction} className="mt-3 flex gap-1"><input type="hidden" name="idempotency_key" value={key} /><input className="input" name="amount" type="number" defaultValue={10000} /><button className="btn-primary">Пополнить (мок {process.env.PAYMENT_PROVIDER ?? "mock"})</button></form><p className="text-xs text-slate-400">Idempotency-key: {key.slice(-10)} — повтор формы не спишет дважды.</p>
      <form action={payoutAction} className="mt-3 flex gap-1"><input className="input" name="amount" type="number" placeholder="Сумма вывода" required /><input className="input" name="bank_account" placeholder={company.bank_account ?? "IBAN"} /><button className="btn-secondary">Вывести</button></form>
      <div className="mt-3 text-sm"><b>Подписка:</b> {subs.map((x) => <span key={x.id}>{x.plan} <Badge s={x.status} /> <Money v={x.price} />/мес, след. списание <Dt d={x.next_billing_at} /></span>)}{!subs.length && <span className="muted"> free</span>}</div></div>
      <div className="card lg:col-span-2"><h2 className="h2 mb-2">Транзакции</h2><table className="table"><tbody>{wallet?.transactions.map((t) => <tr key={t.id}><td><Dt d={t.created_at} /></td><td>{t.type}</td><td className={t.amount.lt(0) ? "text-red-700" : "text-green-700"}><Money v={t.amount} /></td><td><Badge s={t.status} /></td><td className="text-xs text-slate-400">{t.idempotency_key}{(t.meta_json as { fiscal_esf_required?: boolean } | null)?.fiscal_esf_required ? " · ЭСФ" : ""}</td></tr>)}</tbody></table>
        <h2 className="h2 mb-2 mt-4">Заявки на вывод</h2><table className="table"><tbody>{payouts.map((p) => <tr key={p.id}><td><Dt d={p.requested_at} /></td><td><Money v={p.amount} /></td><td>{p.bank_account}</td><td><Badge s={p.status} /></td><td><Dt d={p.processed_at} /></td></tr>)}</tbody></table></div></div></div>;
}
