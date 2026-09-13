import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { getSession, Session } from "./auth";

type Handler = (req: Request, ctx: { params: Record<string, string>; session: Session | null }) => Promise<unknown>;

/** Обёртка API-роута: JSON-ответ, AppError → статус, прочее → 500. */
export function api(handler: Handler, opts: { auth?: boolean } = { auth: true }) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const session = await getSession();
      if (opts.auth !== false && !session) return NextResponse.json({ error: "unauthorized", message: "Требуется вход" }, { status: 401 });
      const params = await ctx.params;
      const data = await handler(req, { params, session });
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: e.code, message: e.message, details: e.details ?? null }, { status: e.status });
      const msg = e instanceof Error ? e.message : String(e);
      if (/No record was found|not found/i.test(msg)) return NextResponse.json({ error: "not_found", message: msg }, { status: 404 });
      console.error(e);
      return NextResponse.json({ error: "internal", message: msg }, { status: 500 });
    }
  };
}
export async function body<T = Record<string, unknown>>(req: Request): Promise<T> { try { return (await req.json()) as T; } catch { return {} as T; } }
