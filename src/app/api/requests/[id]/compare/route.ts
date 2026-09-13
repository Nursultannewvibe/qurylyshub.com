import { api } from "@/server/api";
import { compareOffers } from "@/server/services/offers";
export const GET = api(async (_r, { params }) => (await compareOffers(params.id)).rows);
