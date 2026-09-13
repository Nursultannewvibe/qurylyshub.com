import { LoginForm } from "./form";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  return <div className="mx-auto max-w-md"><div className="card"><h1 className="h1 mb-1">Вход / регистрация</h1><p className="muted mb-4">По номеру телефона и коду из SMS. В демо-режиме код: <b>{process.env.DEV_OTP_CODE ?? "см. лог сервера"}</b>.</p><LoginForm next={sp.next ?? "/dashboard"} /></div>
    <div className="card mt-4 text-sm"><b>Тестовые аккаунты</b><ul className="mt-2 grid grid-cols-1 gap-1 text-slate-600">
      {[["+77010000001", "Частный заказчик (Айдар)"], ["+77010000002", "Крупный заказчик BI Construct"], ["+77010000003", "Поставщик «Окна Алматы»"], ["+77010000004", "Поставщик «БетонСервис»"], ["+77010000005", "Подрядчик «КровляМастер»"], ["+77010000008", "Подрядчик «РемСтрой»"], ["+77010000006", "Технадзор (Марат)"], ["+77010000007", "Админ / диспетчер"]].map(([p, n]) => <li key={p}><code className="rounded bg-slate-100 px-1">{p}</code> — {n}</li>)}
    </ul></div></div>;
}
