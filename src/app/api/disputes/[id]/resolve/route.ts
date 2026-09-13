import { api, body } from "@/server/api";
import { requireRole } from "@/server/auth";
import { resolveDispute } from "@/server/services/disputes";
export const POST = api(async (req, { params, session }) => { requireRole(session!, "admin"); const b = await body<{ outcome: "resolved" | "rejected"; resolution: string; release_to_seller?: boolean; accepted_share?: number }>(req); return resolveDispute(session!.user.id, params.id, b.outcome, b.resolution, b); });
