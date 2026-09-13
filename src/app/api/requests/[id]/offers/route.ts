import { api, body } from "@/server/api";
import { companyOf } from "@/server/auth";
import { createOffer, OfferInput } from "@/server/services/offers";
export const POST = api(async (req, { params, session }) => createOffer(companyOf(session!).id, session!.user.id, params.id, await body<OfferInput>(req)));
