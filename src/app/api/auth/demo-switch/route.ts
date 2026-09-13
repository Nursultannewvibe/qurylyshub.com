import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, getSession } from "@/server/auth";
import { demoSwitch, isDemoMode, DEMO_ACCOUNTS } from "@/server/demo";
import { AppError } from "@/server/errors";

/** GET — список тестовых аккаунтов (только в демо-режиме). */
export async function GET() {
  if (!isDemoMode()) return NextResponse.json({ error: "forbidden", message: "Демо-режим выключен" }, { status: 403 });
  return NextResponse.json({ demo: true, accounts: DEMO_ACCOUNTS });
}

/** POST {phone} (JSON или form) — вход под тестовым аккаунтом одним кликом. Проверка демо-режима — в demoSwitch(). */
export async function POST(req: Request) {
  const isForm = (req.headers.get("content-type") ?? "").includes("form");
  let phone = "";
  if (isForm) phone = String((await req.formData()).get("phone") ?? "");
  else { try { phone = String(((await req.json()) as { phone?: string }).phone ?? ""); } catch { /* пусто */ } }
  try {
    const session = await getSession();
    const { user, token, account } = await demoSwitch(phone, { actorId: session?.user.id ?? null, ip: req.headers.get("x-forwarded-for"), userAgent: req.headers.get("user-agent") });
    const c = await cookies();
    c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
    if (isForm) return NextResponse.redirect(new URL("/dashboard", req.url), 303);
    return NextResponse.json({ ok: true, user: { id: user.id, phone: user.phone, name: user.name }, role: account.role });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    if (isForm) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url), 303);
    return NextResponse.json({ error: e instanceof AppError ? e.code : "internal", message }, { status });
  }
}
