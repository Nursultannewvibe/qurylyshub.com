import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE } from "@/server/auth";
export async function POST(req: Request) { const c = await cookies(); c.delete(COOKIE); return NextResponse.redirect(new URL("/", req.url), 303); }
