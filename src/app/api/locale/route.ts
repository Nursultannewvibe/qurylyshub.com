import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/server/auth";
import { prisma } from "@/server/db";
export async function POST(req: Request) {
  const fd = await req.formData(); const locale = fd.get("locale") === "kk" ? "kk" : "ru";
  const c = await cookies(); c.set("qh_locale", locale, { path: "/", maxAge: 365 * 86400 });
  const s = await getSession(); if (s) await prisma.user.update({ where: { id: s.user.id }, data: { locale } });
  return NextResponse.redirect(new URL(req.headers.get("referer") ?? "/", req.url), 303);
}
