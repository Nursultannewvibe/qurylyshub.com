import { api, body } from "@/server/api";
import { openDispute } from "@/server/services/disputes";
import type { DisputeCategory } from "@prisma/client";
export const POST = api(async (req, { params, session }) => openDispute(session!.user.id, params.id, await body<{ milestone_id?: string; reason: string; category?: DisputeCategory }>(req)));
