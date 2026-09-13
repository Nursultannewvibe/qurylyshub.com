import Link from "next/link";
import { ru } from "@/lib/i18n";
import { fmtKZT } from "@/lib/money";

const COLORS: Record<string, string> = { published: "bg-blue-100 text-blue-800", sent: "bg-blue-100 text-blue-800", accepted: "bg-green-100 text-green-800", completed: "bg-green-100 text-green-800", signed: "bg-green-100 text-green-800", released: "bg-green-100 text-green-800", verified: "bg-green-100 text-green-800", purchased: "bg-green-100 text-green-800", not_selected: "bg-slate-100 text-slate-600", declined: "bg-slate-100 text-slate-600", expired: "bg-slate-100 text-slate-600", cancelled: "bg-slate-100 text-slate-600", needs_dispatcher: "bg-amber-100 text-amber-800", pending: "bg-amber-100 text-amber-800", awaiting_payment: "bg-amber-100 text-amber-800", retry_pending: "bg-amber-100 text-amber-800", disputed: "bg-red-100 text-red-800", open: "bg-red-100 text-red-800", in_review: "bg-red-100 text-red-800", rejected: "bg-red-100 text-red-800", failed: "bg-red-100 text-red-800", in_progress: "bg-indigo-100 text-indigo-800", funded: "bg-indigo-100 text-indigo-800", submitted: "bg-indigo-100 text-indigo-800", held: "bg-indigo-100 text-indigo-800", partially_accepted: "bg-teal-100 text-teal-800" };
export function Badge({ s, children }: { s?: string; children?: React.ReactNode }) {
  return <span className={`badge ${(s && COLORS[s]) || "bg-slate-100 text-slate-700"}`}>{children ?? (s ? ru(s) : "")}</span>;
}
export function Flash({ sp }: { sp: { error?: string; ok?: string } }) {
  if (!sp.error && !sp.ok) return null;
  return <div className={`mb-4 rounded-md px-3 py-2 text-sm ${sp.error ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"}`}>{sp.error ?? sp.ok}</div>;
}
export function Money({ v }: { v: unknown }) { return <span className="tabular-nums">{fmtKZT(v as number)}</span>; }
export function Dt({ d }: { d: Date | string | null | undefined }) { return <span>{d ? new Date(d).toLocaleDateString("ru-RU") : "—"}</span>; }
export function Empty({ text = "Пока пусто" }: { text?: string }) { return <p className="muted py-6 text-center">{text}</p>; }
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string | null }) {
  return <div><label className="label">{label}</label>{children}{hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}</div>;
}
export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="h1">{title}</h1>{sub ? <div className="muted mt-1">{sub}</div> : null}</div><div className="flex gap-2">{actions}</div></div>;
}
export function A({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) { return <Link href={href} className={`text-brand-600 hover:underline ${className}`}>{children}</Link>; }
export function ConfirmButton({ label, className = "btn-secondary", name, value }: { label: string; className?: string; name?: string; value?: string }) {
  return <button className={className} name={name} value={value} type="submit">{label}</button>;
}
