import { api } from "@/server/api";
import { signAct } from "@/server/services/acts";
export const POST = api(async (_r, { params, session }) => signAct(session!.user.id, params.id));
