import { api } from "@/server/api";
import { companyOf } from "@/server/auth";
import { purchaseLead } from "@/server/services/leads";
export const POST = api(async (_r, { params, session }) => purchaseLead(params.id, companyOf(session!).id, session!.user.id));
