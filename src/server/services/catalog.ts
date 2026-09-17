import { prisma } from "../db";

export async function catalog(filter: { category?: string; region?: string; q?: string } = {}) {
  const category = filter.category ? await prisma.category.findUnique({ where: { code: filter.category } }) : null;
  const companies = await prisma.company.findMany({ where: { is_public: true, role: { in: ["supplier", "contractor"] }, ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {}) }, include: { reputation: true, verifications: { where: { status: "verified" } } }, orderBy: { rating: "desc" } });
  const cats = await prisma.category.findMany();
  return companies
    .filter((c) => !category || ((c.categories_json as string[]) ?? []).includes(category.id))
    .filter((c) => !filter.region || c.region === filter.region || ((c.service_regions_json as string[]) ?? []).includes(filter.region))
    .map((c) => ({ ...c, category_names: ((c.categories_json as string[]) ?? []).map((id) => cats.find((x) => x.id === id)?.name).filter(Boolean) as string[] }));
}

export async function companyCard(slug: string) {
  const c = await prisma.company.findUnique({ where: { public_slug: slug }, include: { reputation: true, verifications: true, external_profiles: true, reviews_received: { where: { verified: true }, include: { author: { select: { name: true } }, responses: true, disputes: true }, orderBy: { created_at: "desc" } } } });
  if (!c) return null;
  const cats = await prisma.category.findMany({ where: { id: { in: (c.categories_json as string[]) ?? [] } } });
  const products = await prisma.product.findMany({ where: { company_id: c.id, is_active: true }, include: { category: true }, orderBy: { created_at: "desc" } });
  return { ...c, categories: cats, products };
}
