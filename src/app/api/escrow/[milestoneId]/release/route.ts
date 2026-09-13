import { api } from "@/server/api";
import { requireRole } from "@/server/auth";
import { releaseEscrow } from "@/server/services/escrow";
// Прямое раскрытие (только админ) — та же проверка активного спора внутри releaseEscrow → 409 escrow_blocked.
export const POST = api(async (_r, { params, session }) => { requireRole(session!, "admin"); return releaseEscrow(params.milestoneId, session!.user.id); });
