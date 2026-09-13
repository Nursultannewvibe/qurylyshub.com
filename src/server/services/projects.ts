import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { logActivity } from "../activity";
import { evaluateRegulatory, seismicityForRegion } from "./regulatory";
import { bad, forbidden, notFound } from "../errors";

export type ProjectInput = {
  name: string;
  object_type: string;
  construction_type?: string | null;
  region: string;
  city: string;
  district?: string | null;
  address?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  floors?: number | null;
  deadline?: Date | null;
  budget_min?: number | null;
  budget_max?: number | null;
  open_to_pitches?: boolean;
  parent_project_id?: string | null;
  company_id?: string | null;
  land_purpose?: string | null;
  tu_electric?: boolean; tu_gas?: boolean; tu_water?: boolean; tu_sewer?: boolean; tu_heat?: boolean;
  start_date?: Date | null;
};

/** Детект дублей по адресу (предупреждение, не блокировка). */
export async function findDuplicateByAddress(ownerId: string, address?: string | null, city?: string) {
  if (!address) return null;
  const norm = address.trim().toLowerCase();
  return prisma.project.findFirst({ where: { owner_id: ownerId, city, address: { equals: norm, mode: "insensitive" }, status: { not: "archived" } } });
}

export async function createProject(ownerId: string, input: ProjectInput) {
  if (input.parent_project_id) {
    const parent = await prisma.project.findUnique({ where: { id: input.parent_project_id } });
    if (!parent) throw notFound("Родительский объект не найден");
    if (parent.owner_id !== ownerId) throw forbidden();
  }
  const reg = await evaluateRegulatory({ object_type: input.object_type, construction_type: input.construction_type, area: input.area, floors: input.floors });
  const duplicate = await findDuplicateByAddress(ownerId, input.address, input.city);
  const region = await prisma.region.findUnique({ where: { code: input.region } });

  const project = await prisma.project.create({
    data: {
      owner_id: ownerId,
      company_id: input.company_id ?? null,
      parent_project_id: input.parent_project_id ?? null,
      name: input.name,
      object_type: input.object_type,
      construction_type: input.construction_type ?? null,
      region: input.region,
      city: input.city,
      district: input.district ?? null,
      address: input.address?.trim() ?? null,
      geo_lat: input.geo_lat ?? region?.lat ?? null,
      geo_lng: input.geo_lng ?? region?.lng ?? null,
      area: input.area ?? null,
      rooms: input.rooms ?? null,
      floor: input.floor ?? null,
      floors: input.floors ?? null,
      deadline: input.deadline ?? null,
      budget_min: input.budget_min ?? null,
      budget_max: input.budget_max ?? null,
      open_to_pitches: input.open_to_pitches ?? false,
      land_purpose: input.land_purpose ?? null,
      seismicity: seismicityForRegion(input.region),
      responsibility_level: reg.responsibility_level,
      needs_permit: reg.needs_permit,
      needs_expertise: reg.needs_expertise,
      needs_tech_supervision: reg.needs_tech_supervision,
      tu_electric: !!input.tu_electric, tu_gas: !!input.tu_gas, tu_water: !!input.tu_water, tu_sewer: !!input.tu_sewer, tu_heat: !!input.tu_heat,
    },
  });
  await prisma.projectMember.create({ data: { project_id: project.id, user_id: ownerId, permission: "owner" } });
  await generateStages(project.id, input.start_date ?? new Date());
  await logActivity({ actor_id: ownerId, entity_type: "project", entity_id: project.id, action: "created", meta: { regulatory: reg, duplicate_of: duplicate?.id ?? null } });
  return { project, regulatory: reg, duplicate };
}

/** Этапы + предиктивный график из stage_typical_duration (10А). */
export async function generateStages(projectId: string, startDate: Date) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  let typical = await prisma.stageTypicalDuration.findMany({ where: { object_type: project.object_type, construction_type: project.construction_type ?? null }, orderBy: { order_index: "asc" } });
  if (!typical.length) typical = await prisma.stageTypicalDuration.findMany({ where: { object_type: project.object_type, construction_type: null }, orderBy: { order_index: "asc" } });
  if (!typical.length) typical = await prisma.stageTypicalDuration.findMany({ where: { object_type: "house" }, orderBy: { order_index: "asc" } });
  const categories = await prisma.category.findMany();
  const catByCode = new Map(categories.map((c) => [c.code, c.id]));

  let cursor = new Date(startDate);
  let prevStageId: string | null = null;
  for (const t of typical) {
    const stage = await prisma.constructionStage.create({ data: { project_id: projectId, name: t.stage_name, order_index: t.order_index, category_code: t.category_code ?? null } });
    const planned_start = new Date(cursor);
    const planned_end = new Date(cursor.getTime() + t.typical_days * 86400000);
    await prisma.stageSchedule.create({
      data: {
        project_id: projectId,
        stage_id: stage.id,
        planned_start,
        planned_end,
        predicted_next_need_category_id: t.category_code ? catByCode.get(t.category_code) ?? null : null,
        predicted_date: planned_start,
      },
    });
    if (prevStageId) await prisma.stageDependency.create({ data: { stage_id: stage.id, depends_on_stage_id: prevStageId } });
    prevStageId = stage.id;
    cursor = planned_end;
  }
}

export async function assertProjectAccess(projectId: string, userId: string, allowAdmin = true) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
  if (!p) throw notFound("Объект не найден");
  if (p.owner_id === userId || p.members.some((m) => m.user_id === userId)) return p;
  if (p.company_id) {
    const m = await prisma.companyMember.findUnique({ where: { user_id_company_id: { user_id: userId, company_id: p.company_id } } });
    if (m) return p;
  }
  if (allowAdmin) {
    const r = await prisma.userRole.findUnique({ where: { user_id_role: { user_id: userId, role: "admin" } } });
    if (r) return p;
  }
  throw forbidden("Нет доступа к объекту");
}

/** Предупреждения (не блокировка): сезонность категории, незавершённые зависимости этапа. */
export async function stageWarnings(projectId: string, categoryId: string, stageId?: string | null) {
  const warnings: string[] = [];
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  const sr = cat?.seasonal_restrictions_json as { months?: number[]; message?: string } | null;
  const month = new Date().getMonth() + 1;
  if (sr?.months?.includes(month)) warnings.push(`Сезонное ограничение: ${sr.message ?? "неблагоприятный сезон для категории"}`);
  if (stageId) {
    const deps = await prisma.stageDependency.findMany({ where: { stage_id: stageId }, include: { depends_on: true } });
    for (const d of deps) if (d.depends_on.progress_pct < 100) warnings.push(`Этап «${d.depends_on.name}» не завершён (${d.depends_on.progress_pct}%)`);
  }
  return warnings;
}

export async function listProjectsForUser(userId: string) {
  const memberships = await prisma.companyMember.findMany({ where: { user_id: userId } });
  return prisma.project.findMany({
    where: { OR: [{ owner_id: userId }, { members: { some: { user_id: userId } } }, { company_id: { in: memberships.map((m) => m.company_id) } }] },
    include: { children: true, requests: { select: { id: true, status: true, category_id: true } } },
    orderBy: { created_at: "desc" },
  });
}

export async function updateProject(projectId: string, userId: string, patch: Partial<ProjectInput> & { status?: Prisma.ProjectUpdateInput["status"]; commissioning_status?: Prisma.ProjectUpdateInput["commissioning_status"] }) {
  await assertProjectAccess(projectId, userId);
  const data: Prisma.ProjectUpdateInput = {};
  for (const k of ["name", "address", "district", "area", "floors", "floor", "rooms", "deadline", "budget_min", "budget_max", "open_to_pitches", "land_purpose", "tu_electric", "tu_gas", "tu_water", "tu_sewer", "tu_heat", "status", "commissioning_status", "geo_lat", "geo_lng"] as const) {
    if (k in patch && patch[k] !== undefined) (data as Record<string, unknown>)[k] = patch[k];
  }
  const p = await prisma.project.update({ where: { id: projectId }, data });
  await logActivity({ actor_id: userId, entity_type: "project", entity_id: projectId, action: "updated", meta: patch });
  return p;
}

export function validateUpload(file: { size: number; name: string; type?: string }, maxMb: number) {
  const allowed = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".dwg", ".dxf", ".xlsx", ".docx", ".m4a", ".mp3", ".ogg", ".wav"];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!allowed.includes(ext)) throw bad("file_format", `Формат ${ext} не поддерживается`);
  if (file.size > maxMb * 1024 * 1024) throw bad("file_size", `Файл больше ${maxMb} МБ`);
  return true;
}
