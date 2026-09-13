import { LoginForm } from "./form";
import { DEMO_ACCOUNTS, isDemoMode } from "@/server/demo";
import { Flash } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const demo = isDemoMode();
  return <div className="mx-auto max-w-md"><Flash sp={sp} />
    {demo && <div className="card mb-4 border-amber-300 bg-amber-50"><h2 className="h2">Демо-режим: войти одним кликом</h2><p className="muted mb-3">Тестовые аккаунты — без телефона и кода. Внутри приложения роль можно сменить через виджет в правом нижнем углу.</p>
      <ul className="divide-y divide-amber-200">{DEMO_ACCOUNTS.map((a) => <li key={a.phone} className="flex items-center gap-2 py-1.5 text-sm"><span className="w-28 shrink-0 text-xs font-medium text-slate-500">{a.role}</span><span className="flex-1"><b>{a.name}</b><span className="block text-xs text-slate-400">{a.hint} · {a.phone}</span></span>
        <form action="/api/auth/demo-switch" method="post"><input type="hidden" name="phone" value={a.phone} /><button className="btn-primary text-xs">Войти</button></form></li>)}</ul></div>}
    <div className="card"><h1 className="h1 mb-1">Вход / регистрация</h1><p className="muted mb-4">По номеру телефона и коду из SMS.{demo ? <> В демо-режиме код: <b>{process.env.DEV_OTP_CODE ?? "000000"}</b>.</> : null}</p><LoginForm next={sp.next ?? "/dashboard"} /></div></div>;
}
