import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError } from "../errors";

/** Обёртка server action: ошибки → redirect с ?error=, успех → redirect с ?ok= (или на другую страницу). */
export async function act(returnTo: string, fn: () => Promise<string | void>) {
  let dest = returnTo;
  try {
    const r = await fn();
    const base = r && r.startsWith("/") ? r : returnTo;
    dest = `${base}${base.includes("?") ? "&" : "?"}ok=${encodeURIComponent(r && !r.startsWith("/") ? r : "Готово")}`;
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof AppError ? e.message : e instanceof Error ? e.message : String(e);
    dest = `${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg.slice(0, 300))}`;
  }
  revalidatePath("/", "layout");
  redirect(dest);
}
function isRedirect(e: unknown) { return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT"); }
export const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };
export const num = (fd: FormData, k: string) => { const v = str(fd, k); return v === "" ? null : Number(v.replace(",", ".")); };
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true" || fd.get(k) === "1";
