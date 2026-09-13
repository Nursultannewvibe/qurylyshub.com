import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { getSession } from "./auth";
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get("qh_locale")?.value;
  if (v === "kk" || v === "ru") return v;
  const s = await getSession();
  return s?.user.locale ?? "ru";
}
