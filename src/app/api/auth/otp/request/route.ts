import { api, body } from "@/server/api";
import { requestOtp } from "@/server/auth";
export const POST = api(async (req) => { const { phone } = await body<{ phone: string }>(req); return requestOtp(phone); }, { auth: false });
