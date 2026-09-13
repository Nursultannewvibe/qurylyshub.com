"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ next }: { next: string }) {
  const [phone, setPhone] = useState("+7701");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [name, setName] = useState("");
  const [role, setRole] = useState("buyer");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function post(url: string, data: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message ?? j.error);
    return j;
  }
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(null); try {
      if (step === "phone") { const j = await post("/api/auth/otp/request", { phone }); setMsg(j.dev_code ? `Код отправлен (демо: ${j.dev_code})` : "Код отправлен по SMS"); setStep("code"); }
      else { await post("/api/auth/otp/verify", { phone, code, name, role }); router.push(next); router.refresh(); }
    } catch (err) { setMsg((err as Error).message); } finally { setBusy(false); } }}>
      <div><label className="label">Телефон</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={step === "code"} /></div>
      {step === "code" && (<>
        <div><label className="label">Код из SMS</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></div>
        <details className="text-sm"><summary className="cursor-pointer text-slate-500">Если вы впервые — имя и роль</summary>
          <div className="mt-2 space-y-2"><input className="input" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}><option value="buyer">Заказчик</option><option value="supplier">Поставщик</option><option value="contractor">Подрядчик</option><option value="supervisor">Технадзор</option></select></div></details>
      </>)}
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{step === "phone" ? "Получить код" : "Войти"}</button>{step === "code" && <button type="button" className="btn-secondary" onClick={() => setStep("phone")}>Другой номер</button>}</div>
    </form>
  );
}
