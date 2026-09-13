import { api, body } from "@/server/api";
import { payMilestone } from "@/server/services/escrow";
export const POST = api(async (req, { params, session }) => { const b = await body<{ idempotency_key?: string }>(req); return payMilestone(session!.user.id, params.id, b.idempotency_key ?? req.headers.get("idempotency-key") ?? undefined); });
