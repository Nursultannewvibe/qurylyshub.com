import { api } from "@/server/api";
import { handleWebhook } from "@/server/services/payments";
export const POST = api(async (req, { params }) => handleWebhook(params.provider, Object.fromEntries(req.headers), await req.text()), { auth: false });
