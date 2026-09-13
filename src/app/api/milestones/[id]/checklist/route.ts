import { api, body } from "@/server/api";
import { checklistGate, setChecklistResult } from "@/server/services/escrow";
export const GET = api(async (_r, { params }) => checklistGate(params.id));
export const POST = api(async (req, { params, session }) => { const b = await body<{ item_id: string; checked: boolean; photo_url?: string }>(req); return setChecklistResult(session!.user.id, params.id, b.item_id, b.checked, b.photo_url); });
