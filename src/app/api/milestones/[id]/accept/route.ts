import { api, body } from "@/server/api";
import { acceptMilestone } from "@/server/services/escrow";
export const POST = api(async (req, { params, session }) => { const b = await body<{ accepted_amount?: number }>(req); const r = await acceptMilestone(session!.user.id, params.id, { accepted_amount: b.accepted_amount }); return { ...r, act: { id: r.act.id, file_url: r.act.file_url } }; });
