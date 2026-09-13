import { api } from "@/server/api";
import { companyOf } from "@/server/auth";
import { declineLead } from "@/server/services/leads";
export const POST = api(async (_r, { params, session }) => declineLead(params.id, companyOf(session!).id, session!.user.id));
