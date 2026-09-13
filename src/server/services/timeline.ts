import { prisma } from "../db";
import { notify } from "./notifications";
import { logActivity } from "../activity";
import { forbidden } from "../errors";
import { assertProjectAccess } from "./projects";

/**
 * 10А. Предиктивный таймлайн: для каждого этапа известна predicted_date и категория, которая понадобится.
 * Планировщик заранее (за lead_time_days) создаёт уведомление «скоро понадобится X — пора собирать КП».
 */
export async function predictiveNotifications(now = new Date()) {
  const rows = await prisma.stageSchedule.findMany({ where: { notified_at: null, predicted_date: { not: null }, predicted_next_need_category_id: { not: null }, actual_date: null }, include: { project: true, stage: true } });
  let created = 0;
  for (const r of rows) {
    const leadMs = r.lead_time_days * 86400000;
    if (r.predicted_date!.getTime() - now.getTime() > leadMs) continue;
    if (r.project.status !== "active") continue;
    const hasRequest = await prisma.request.findFirst({ where: { project_id: r.project_id, category_id: r.predicted_next_need_category_id!, status: { notIn: ["cancelled", "expired"] } } });
    if (hasRequest) { await prisma.stageSchedule.update({ where: { id: r.id }, data: { notified_at: now } }); continue; }
    const cat = await prisma.category.findUnique({ where: { id: r.predicted_next_need_category_id! } });
    await notify({ user_id: r.project.owner_id, type: "timeline.upcoming_need", payload: { project_id: r.project_id, stage: r.stage.name, category: cat?.name, category_id: cat?.id, predicted_date: r.predicted_date }, dedup_key: `timeline:${r.id}` });
    await prisma.stageSchedule.update({ where: { id: r.id }, data: { notified_at: now } });
    created++;
  }
  return { created };
}

/** Обновление прогресса этапа: 100% → actual_date, сдвиг последующих этапов относительно факта. */
export async function updateStageProgress(userId: string, stageId: string, progress: number) {
  const stage = await prisma.constructionStage.findUniqueOrThrow({ where: { id: stageId }, include: { schedule: true } });
  await assertProjectAccess(stage.project_id, userId).catch(() => { throw forbidden(); });
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  await prisma.constructionStage.update({ where: { id: stageId }, data: { progress_pct: pct } });
  if (pct === 100) {
    const now = new Date();
    await prisma.stageSchedule.updateMany({ where: { stage_id: stageId }, data: { actual_date: now } });
    const sched = stage.schedule[0];
    if (sched?.planned_end) {
      const shift = now.getTime() - sched.planned_end.getTime();
      if (Math.abs(shift) > 86400000) {
        const later = await prisma.stageSchedule.findMany({ where: { project_id: stage.project_id, stage: { order_index: { gt: stage.order_index } }, actual_date: null } });
        for (const s of later) await prisma.stageSchedule.update({ where: { id: s.id }, data: { planned_start: s.planned_start ? new Date(s.planned_start.getTime() + shift) : null, planned_end: s.planned_end ? new Date(s.planned_end.getTime() + shift) : null, predicted_date: s.predicted_date ? new Date(s.predicted_date.getTime() + shift) : null, notified_at: null } });
      }
    }
  }
  await logActivity({ actor_id: userId, entity_type: "stage", entity_id: stageId, action: "progress", meta: { pct } });
}

export async function addLabReport(userId: string, input: { project_id: string; lab_name: string; report_type: "concrete" | "soil" | "water" | "electrical" | "other"; file_url?: string; verdict_summary?: string }) {
  await assertProjectAccess(input.project_id, userId);
  const r = await prisma.labReport.create({ data: { project_id: input.project_id, lab_name: input.lab_name, report_type: input.report_type, file_url: input.file_url ?? null, verdict_summary: input.verdict_summary ?? null, uploaded_by: userId } });
  await logActivity({ actor_id: userId, entity_type: "lab_report", entity_id: r.id, action: "uploaded" });
  return r;
}
export const LAB_DISCLAIMER = "Лабораторный отчёт — предварительная информация, загруженная пользователем; не заменяет заключение аккредитованной лаборатории/экспертизы и не является заключением платформы.";
