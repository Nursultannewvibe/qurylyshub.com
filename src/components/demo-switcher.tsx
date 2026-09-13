"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = { phone: string; name: string; role: string; hint: string };

/** Плавающий виджет демо-режима: текущая тестовая роль + переключение одним кликом. Рендерится только если сервер включил демо-режим. */
export function DemoSwitcher({ accounts, currentPhone }: { accounts: readonly Account[]; currentPhone: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const current = accounts.find((a) => a.phone === currentPhone);
  async function switchTo(phone: string) {
    setBusy(phone); setErr(null);
    try {
      const r = await fetch("/api/auth/demo-switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? j.error);
      setOpen(false);
      router.push("/dashboard"); router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  return (
    <div className="fixed bottom-4 right-4 z-50 text-sm">
      {open && (
        <div className="mb-2 w-80 rounded-lg border border-amber-300 bg-white p-2 shadow-xl">
          <div className="mb-1 px-1 text-xs font-semibold uppercase text-amber-700">Демо · переключить роль</div>
          {accounts.map((a) => (
            <button key={a.phone} disabled={busy !== null || a.phone === currentPhone} onClick={() => switchTo(a.phone)} className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-amber-50 disabled:opacity-60 ${a.phone === currentPhone ? "bg-amber-100" : ""}`}>
              <span className="mt-0.5 w-24 shrink-0 text-xs font-medium text-slate-500">{a.role}</span>
              <span><span className="font-medium">{a.name}</span><span className="block text-xs text-slate-400">{a.hint}</span></span>
              {busy === a.phone && <span className="ml-auto text-xs">…</span>}
            </button>
          ))}
          {err && <p className="px-2 pt-1 text-xs text-red-700">{err}</p>}
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-amber-400 bg-amber-100 px-3 py-1.5 font-medium text-amber-900 shadow-lg hover:bg-amber-200" title="Демо-режим: переключение тестовых ролей">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {current ? `${current.role}: ${current.name}` : "Демо-режим"} <span className="text-xs">▾</span>
      </button>
    </div>
  );
}
