"use server";
import { requireSession } from "../auth";
import { act, str, num, bool } from "./helpers";
import * as E from "../services/escrow";
import * as Dis from "../services/disputes";
import * as Act from "../services/acts";
import * as R from "../services/reviews";

export async function payMilestoneAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { const r = await E.payMilestone(s.user.id, str(fd, "milestone_id"), str(fd, "idempotency_key") || undefined); return `Платёж ${r.payment.status}${r.idempotent_replay ? " (повтор — списания не было)" : ""}: ${r.payment.provider_ref ?? r.payment.last_error ?? ""}`; });
}
export async function startWorkAction(fd: FormData) { const s = await requireSession(); const did = str(fd, "deal_id"); await act(`/deals/${did}`, async () => { await E.startWork(s.user.id, did); return "Работы начаты"; }); }
export async function submitMilestoneAction(fd: FormData) { const s = await requireSession(); const did = str(fd, "deal_id"); await act(`/deals/${did}`, async () => { await E.submitMilestone(s.user.id, str(fd, "milestone_id")); return "Этап сдан на приёмку"; }); }
export async function checklistAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { await E.setChecklistResult(s.user.id, str(fd, "milestone_id"), str(fd, "item_id"), bool(fd, "checked"), str(fd, "photo_url") || null); return "Пункт чек-листа сохранён"; });
}
export async function acceptMilestoneAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { const r = await E.acceptMilestone(s.user.id, str(fd, "milestone_id"), { accepted_amount: num(fd, "accepted_amount") ?? undefined }); return `Этап ${r.partial ? "принят частично" : "принят"}: исполнителю ${r.net} ₸, комиссия ${r.commission} ₸${r.penalty.gt(0) ? `, пеня ${r.penalty} ₸` : ""}${r.refund.gt(0) ? `, возврат ${r.refund} ₸` : ""}. Акт сформирован.`; });
}
export async function releaseEscrowAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { const r = await E.releaseEscrow(str(fd, "milestone_id"), s.user.id); return `Эскроу раскрыт: ${r.net} ₸ исполнителю`; });
}
export async function openDisputeAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { const d = await Dis.openDispute(s.user.id, did, { milestone_id: str(fd, "milestone_id") || null, reason: str(fd, "reason"), category: (str(fd, "category") || "other") as never }); return `Спор ${d.id.slice(-6)} открыт — эскроу по этапу заблокирован`; });
}
export async function resolveDisputeAction(fd: FormData) {
  const s = await requireSession(); const back = str(fd, "back") || "/admin";
  await act(back, async () => { const r = await Dis.resolveDispute(s.user.id, str(fd, "dispute_id"), str(fd, "outcome") as never, str(fd, "resolution"), { release_to_seller: bool(fd, "release"), accepted_share: num(fd, "share") ?? 1 }); return `Спор ${r.dispute.status}${r.release ? `, раскрыто ${r.release.net} ₸` : ""}`; });
}
export async function signActAction(fd: FormData) { const s = await requireSession(); const did = str(fd, "deal_id"); await act(`/deals/${did}`, async () => { const a = await Act.signAct(s.user.id, str(fd, "act_id")); return `Акт подписан (${a.status})`; }); }
export async function supervisorActAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { const a = await Act.generateAct(did, str(fd, "milestone_id") || null, "supervisor_conclusion", s.user.id, { supervisor_id: s.user.id, conclusion: str(fd, "conclusion") }); await Act.signAct(s.user.id, a.id); return "Заключение технадзора сформировано и подписано"; });
}
export async function warrantyAction(fd: FormData) { const s = await requireSession(); const did = str(fd, "deal_id"); await act(`/deals/${did}`, async () => { await Dis.openWarrantyClaim(s.user.id, did, str(fd, "description"), str(fd, "photo_url") || null); return "Гарантийная претензия отправлена"; }); }
export async function warrantyStatusAction(fd: FormData) { const s = await requireSession(); const did = str(fd, "deal_id"); await act(`/deals/${did}`, async () => { await Dis.updateWarrantyClaim(s.user.id, str(fd, "claim_id"), str(fd, "status") as never); return "Статус претензии обновлён"; }); }
export async function reviewAction(fd: FormData) {
  const s = await requireSession(); const did = str(fd, "deal_id");
  await act(`/deals/${did}`, async () => { const r = await R.createReview(s.user.id, did, { rating: Number(str(fd, "rating")), text: str(fd, "text") || undefined, photo_urls: str(fd, "photo_url") ? [str(fd, "photo_url")] : [] }); await R.recalculateReputation(r.target_company_id); return `Отзыв сохранён (verified=${r.verified}), репутация пересчитана`; });
}
export async function rateAction(fd: FormData) { const s = await requireSession(); const did = str(fd, "deal_id"); await act(`/deals/${did}`, async () => { await R.rateCounterparty(s.user.id, did, Number(str(fd, "rating")), str(fd, "text") || undefined); return "Оценка сохранена"; }); }
export async function cancelDealAction(fd: FormData) { const s = await requireSession(); const did = str(fd, "deal_id"); await act(`/deals/${did}`, async () => { await E.cancelDeal(s.user.id, did, str(fd, "reason") || "buyer_cancelled"); return "Сделка отменена по cancel_policy"; }); }
export async function reviewResponseAction(fd: FormData) { const s = await requireSession(); const back = str(fd, "back"); await act(back, async () => { await R.respondToReview(s.user.id, str(fd, "review_id"), str(fd, "text")); return "Ответ опубликован"; }); }
export async function reviewDisputeAction(fd: FormData) { const s = await requireSession(); const back = str(fd, "back"); await act(back, async () => { await R.disputeReview(s.user.id, str(fd, "review_id"), str(fd, "reason")); return "Отзыв отправлен на оспаривание"; }); }
