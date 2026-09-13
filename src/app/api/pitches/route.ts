import { api, body } from "@/server/api";
import { companyOf } from "@/server/auth";
import { createPitch, mapProjectsForCompany } from "@/server/services/pitches";
export const GET = api(async (_r, { session }) => mapProjectsForCompany(companyOf(session!).id));
export const POST = api(async (req, { session }) => createPitch(companyOf(session!).id, session!.user.id, await body<{ project_id: string; category_id: string; message: string; price_estimate?: number }>(req)));
