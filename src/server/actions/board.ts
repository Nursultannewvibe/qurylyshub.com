"use server";
import { requireSession } from "../auth";
import { act, str } from "./helpers";
import * as Bd from "../services/board";
import { redirect } from "next/navigation";
async function sessionOrLogin(next: string) { try { return await requireSession(); } catch { redirect(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent("Чтобы писать на доске, войдите")}`); } }

export async function createPostAction(fd: FormData) {
  const back = str(fd, "back") || "/board"; const s = await sessionOrLogin(back);
  await act(back, async () => { const p = await Bd.createPost(s.user.id, { category_id: str(fd, "category_id"), region_id: str(fd, "region_id") || null, company_id: str(fd, "company_id") || null, title: str(fd, "title"), body: str(fd, "body") }); return `/board/post/${p.id}?ok=${encodeURIComponent("Ветка создана")}`; });
}
export async function createReplyAction(fd: FormData) {
  const pid = str(fd, "post_id"); const s = await sessionOrLogin(`/board/post/${pid}`);
  await act(`/board/post/${pid}`, async () => { await Bd.createReply(s.user.id, pid, str(fd, "body")); return "Ответ опубликован"; });
}
export async function reportAction(fd: FormData) {
  const pid = str(fd, "post_id"); const s = await sessionOrLogin(`/board/post/${pid}`);
  await act(`/board/post/${pid}`, async () => { await Bd.reportTarget(s.user.id, str(fd, "target_type") as "post" | "reply", str(fd, "target_id"), str(fd, "reason")); return "Жалоба отправлена модератору"; });
}
