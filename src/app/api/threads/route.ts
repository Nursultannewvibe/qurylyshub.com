import { api, body } from "@/server/api";
import { getOrCreateThread, threadsForUser } from "@/server/services/chat";
export const POST = api(async (req, { session }) => { const b = await body<{ request_id: string; seller_id: string }>(req); return getOrCreateThread(b.request_id, b.seller_id, session!.user.id); });
export const GET = api(async (_r, { session }) => threadsForUser(session!.user.id));
