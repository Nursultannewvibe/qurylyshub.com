import { api, body } from "@/server/api";
import { sendMessage } from "@/server/services/chat";
export const POST = api(async (req, { params, session }) => { const b = await body<{ body: string }>(req); return sendMessage(params.id, session!.user.id, b.body); });
