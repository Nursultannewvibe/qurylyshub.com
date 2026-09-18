"use server";
import { requireSession } from "../auth";
import { act, str } from "./helpers";
import * as C from "../services/compare";
import { redirect } from "next/navigation";

export async function addToCompareAction(fd: FormData) {
  const back = str(fd, "back") || "/catalog";
  let s; try { s = await requireSession(); } catch { redirect(`/login?next=${encodeURIComponent(back)}&error=${encodeURIComponent("Чтобы сравнивать товары, войдите — список сравнения хранится в вашем аккаунте")}`); }
  await act(back, async () => { const r = await C.addToCompare(s.user.id, str(fd, "product_id")); return r.added ? `/compare?ok=${encodeURIComponent(`Добавлено в сравнение (${r.count}) — категория «${r.category}»`)}` : "Этот товар уже в списке сравнения"; });
}
export async function removeFromCompareAction(fd: FormData) { const s = await requireSession(); await act("/compare", async () => { await C.removeFromCompare(s.user.id, str(fd, "product_id")); return "Убрано из сравнения"; }); }
export async function clearCompareAction() { const s = await requireSession(); await act("/compare", async () => { await C.clearCompare(s.user.id); return "Список сравнения очищен"; }); }
