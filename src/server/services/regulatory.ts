import { prisma } from "../db";

export type RegulatoryInput = { object_type: string; construction_type?: string | null; area?: number | null; floors?: number | null };

/** Конфигурируемая матрица правил (regulatory_rules): берётся правило с максимальным priority среди подходящих. */
export async function evaluateRegulatory(p: RegulatoryInput) {
  const rules = await prisma.regulatoryRule.findMany();
  const matching = rules.filter((r) => {
    if (r.object_type && r.object_type !== p.object_type) return false;
    if (r.construction_type && r.construction_type !== (p.construction_type ?? null)) return false;
    if (r.min_area != null && (p.area ?? 0) < r.min_area) return false;
    if (r.max_area != null && (p.area ?? 0) >= r.max_area) return false;
    if (r.min_floors != null && (p.floors ?? 1) < r.min_floors) return false;
    return true;
  });
  matching.sort((a, b) => b.priority - a.priority);
  const r = matching[0];
  if (!r) return { responsibility_level: "III" as const, needs_permit: false, needs_expertise: false, needs_tech_supervision: false, note: "правило не найдено" };
  return { responsibility_level: r.responsibility_level, needs_permit: r.needs_permit, needs_expertise: r.needs_expertise, needs_tech_supervision: r.needs_tech_supervision, note: r.note };
}

/** Сейсмичность по региону (упрощённая карта СП РК 2.03-30). */
export function seismicityForRegion(region: string): number {
  const map: Record<string, number> = { almaty: 9, almaty_obl: 9, kaskelen: 9, boraldai: 9, uzynagash: 9, chemolgan: 9, talgar: 9, alatau: 8, konaev: 8, shymkent: 8, turkestan: 8, zhambyl: 8, vko: 7, zhetisu: 8, abai: 7 };
  return map[region] ?? 6;
}
