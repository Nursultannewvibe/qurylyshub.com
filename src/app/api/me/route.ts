import { api } from "@/server/api";
export const GET = api(async (_r, { session }) => session);
