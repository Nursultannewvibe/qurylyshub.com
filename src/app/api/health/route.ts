import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
export async function GET() { const t = Date.now(); await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ ok: true, db_ms: Date.now() - t, provider: { payment: process.env.PAYMENT_PROVIDER ?? "mock", llm: process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock" } }); }
