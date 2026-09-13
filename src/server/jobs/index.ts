// Планировщик фоновых задач. Запускается из instrumentation.ts (в процессе Next) или вручную: npm run job <name>.
import { prisma } from "../db";
import { rematchAll } from "../services/matching";
import { recalculateReputation } from "../services/reviews";
import { predictiveNotifications } from "../services/timeline";
import { deliverDeferred } from "../services/notifications";
import { autoRefundStaleLeads } from "../services/leads";
import { remindPendingOffers, expireStale } from "../services/requests";
import { expirePitches } from "../services/pitches";
import { autoDisputeUnsignedActs } from "../services/acts";
import { retryPendingPayments, reconcilePayments, billSubscriptions } from "../services/payments";
import { autoSoftBan, remindExpiringLicenses } from "../services/admin";
import { logActivity } from "../activity";

export const JOBS: Record<string, { every_min: number; run: () => Promise<unknown> }> = {
  deliver_deferred: { every_min: 1, run: () => deliverDeferred() },
  rematch: { every_min: 60, run: () => rematchAll() },
  reputation: { every_min: 30, run: () => recalculateReputation() },
  predictive_timeline: { every_min: 60, run: () => predictiveNotifications() },
  lead_auto_refund: { every_min: 60, run: () => autoRefundStaleLeads() },
  offer_reminders: { every_min: 360, run: () => remindPendingOffers() },
  expire_stale: { every_min: 60, run: () => expireStale() },
  expire_pitches: { every_min: 60, run: () => expirePitches() },
  act_auto_dispute: { every_min: 60, run: () => autoDisputeUnsignedActs() },
  retry_payments: { every_min: 5, run: () => retryPendingPayments() },
  reconciliation: { every_min: 1440, run: () => reconcilePayments() },
  billing: { every_min: 1440, run: () => billSubscriptions() },
  auto_soft_ban: { every_min: 60, run: () => autoSoftBan() },
  license_reminders: { every_min: 1440, run: () => remindExpiringLicenses() },
};

const lastRun = new Map<string, number>();
export async function tick() {
  const now = Date.now();
  for (const [name, job] of Object.entries(JOBS)) {
    const last = lastRun.get(name) ?? 0;
    if (now - last < job.every_min * 60000) continue;
    lastRun.set(name, now);
    try {
      const res = await job.run();
      await logActivity({ entity_type: "job", entity_id: name, action: "run", meta: res as never });
    } catch (e) {
      console.error(`[job:${name}]`, e);
    }
  }
}

let timer: NodeJS.Timeout | null = null;
export function startScheduler(intervalSec: number) {
  if (timer) return;
  timer = setInterval(() => { void tick(); }, intervalSec * 1000);
  void prisma.$connect();
  console.log(`[scheduler] started, interval ${intervalSec}s, jobs: ${Object.keys(JOBS).join(", ")}`);
}
