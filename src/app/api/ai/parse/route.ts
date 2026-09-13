import { api, body } from "@/server/api";
import { aiParseRequest } from "@/server/services/ai";
export const POST = api(async (req, { session }) => aiParseRequest(session!.user.id, await body<{ project_id: string; category_id: string; text: string }>(req)));
