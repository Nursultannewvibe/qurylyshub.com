import { cookies } from "next/headers";
import { api, body } from "@/server/api";
import { verifyOtp, COOKIE } from "@/server/auth";
import type { Role } from "@prisma/client";
export const POST = api(async (req) => {
  const b = await body<{ phone: string; code: string; name?: string; role?: Role; referral?: string }>(req);
  const { user, token } = await verifyOtp(b.phone, b.code, { name: b.name || undefined, role: b.role, referral: b.referral });
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  return { user: { id: user.id, phone: user.phone, name: user.name }, token };
}, { auth: false });
