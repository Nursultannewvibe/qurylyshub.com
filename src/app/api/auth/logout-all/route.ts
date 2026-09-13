import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, requireSession, logoutAllDevices } from "@/server/auth";
export async function POST(req: Request) { const s = await requireSession(); await logoutAllDevices(s.user.id); const c = await cookies(); c.delete(COOKIE); return NextResponse.redirect(new URL("/login?next=/dashboard", req.url), 303); }
