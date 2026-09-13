import { api, body } from "@/server/api";
import { createRequest, CreateRequestInput, buyerOutbox } from "@/server/services/requests";
export const POST = api(async (req, { session }) => createRequest(session!.user.id, await body<CreateRequestInput>(req)));
export const GET = api(async (_r, { session }) => buyerOutbox(session!.user.id));
