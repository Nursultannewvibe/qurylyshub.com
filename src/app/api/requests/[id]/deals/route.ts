import { api, body } from "@/server/api";
import { createDeals, Selection } from "@/server/services/deals";
export const POST = api(async (req, { params, session }) => { const b = await body<{ selections: Selection[] }>(req); return createDeals(session!.user.id, params.id, b.selections ?? []); });
