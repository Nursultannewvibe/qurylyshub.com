import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/server/auth";
import { getLocale } from "@/server/locale";
import { t } from "@/lib/i18n";
import { prisma } from "@/server/db";
import { DemoSwitcher } from "@/components/demo-switcher";
import { DEMO_ACCOUNTS, isDemoMode } from "@/server/demo";

export const metadata: Metadata = { title: "Qurylys Hub", description: "Маркетплейс строительства и ремонта Казахстана" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([getSession(), getLocale()]);
  const unread = session ? await prisma.notification.count({ where: { user_id: session.user.id, channel: "in_app", read: false } }) : 0;
  const roles = session?.user.roles ?? [];
  const isSupplier = roles.includes("supplier") || roles.includes("contractor");
  const isBuyer = roles.includes("buyer");
  const nav: { href: string; label: string }[] = [{ href: "/catalog", label: t(locale, "catalog") }, { href: "/board", label: locale === "kk" ? "Талқылау" : "Обсуждения" }];
  if (session) {
    nav.push({ href: "/dashboard", label: t(locale, "dashboard") });
    if (isBuyer) nav.push({ href: "/projects", label: t(locale, "projects") }, { href: "/inbox", label: t(locale, "inbox") }, { href: "/outbox", label: t(locale, "outbox") });
    if (isSupplier) nav.push({ href: "/supplier/leads", label: t(locale, "leads") }, { href: "/supplier/map", label: t(locale, "map") }, { href: "/supplier/wallet", label: t(locale, "wallet") }, { href: "/supplier/products", label: locale === "kk" ? "Тауарлар" : "Товары" });
    nav.push({ href: "/deals", label: t(locale, "deals") }, { href: "/threads", label: t(locale, "threads") });
    if (roles.includes("supervisor")) nav.push({ href: "/supervisor", label: t(locale, "supervisor") });
    if (roles.includes("admin")) nav.push({ href: "/admin", label: t(locale, "admin") });
  }
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            <Link href="/" className="mr-2 text-lg font-bold text-brand-700">Qurylys<span className="text-slate-400">Hub</span></Link>
            <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{nav.map((n) => <Link key={n.href} href={n.href} className="text-slate-600 hover:text-brand-700">{n.label}</Link>)}</nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <form action="/api/locale" method="post"><input type="hidden" name="locale" value={locale === "ru" ? "kk" : "ru"} /><button className="text-slate-500 hover:text-brand-700">{t(locale, "lang")}</button></form>
              {session ? (<>
                <Link href="/notifications" className="relative text-slate-600">🔔{unread ? <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unread}</span> : null}</Link>
                <Link href="/settings" className="text-slate-700">{session.user.name ?? session.user.phone}</Link>
                <form action="/api/auth/logout" method="post"><button className="text-slate-500 hover:text-red-600">{t(locale, "logout")}</button></form>
              </>) : <Link href="/login" className="btn-primary">{t(locale, "login")}</Link>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-slate-400">{t(locale, "legal")}</footer>
        {session && isDemoMode() && <DemoSwitcher accounts={DEMO_ACCOUNTS} currentPhone={session.user.phone} />}
      </body>
    </html>
  );
}
