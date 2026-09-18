import { prisma } from "../db";
import { conflict, notFound } from "../errors";
import { config } from "../config";

/** Список сравнения: только одна категория за раз и не больше config.compareMax позиций (UX-ограничение). */
export async function addToCompare(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product || !product.is_active) throw notFound("Товар не найден или снят с продажи");
  const items = await prisma.comparisonItem.findMany({ where: { user_id: userId }, include: { product: { include: { category: true } } } });
  if (items.some((i) => i.product_id === productId)) return { added: false, count: items.length, category: product.category.name };
  const other = items.find((i) => i.product.category_id !== product.category_id);
  if (other) throw conflict("compare_category", `В списке уже товары категории «${other.product.category.name}». Сначала очистите список или сравнивайте товары одной категории.`);
  if (items.length >= config.compareMax) throw conflict("compare_limit", `В списке сравнения не больше ${config.compareMax} позиций — уберите что-нибудь, чтобы добавить новое.`);
  await prisma.comparisonItem.create({ data: { user_id: userId, product_id: productId } });
  return { added: true, count: items.length + 1, category: product.category.name };
}
export const removeFromCompare = (userId: string, productId: string) => prisma.comparisonItem.deleteMany({ where: { user_id: userId, product_id: productId } });
export const clearCompare = (userId: string) => prisma.comparisonItem.deleteMany({ where: { user_id: userId } });
export const compareCount = (userId: string) => prisma.comparisonItem.count({ where: { user_id: userId } });

/** Строки таблицы сравнения: продавец, цена, единица, остаток, рейтинг, срок поставки. Остаток — на момент открытия страницы. */
export async function compareRows(userId: string) {
  const items = await prisma.comparisonItem.findMany({ where: { user_id: userId }, include: { product: { include: { company: { include: { reputation: true } }, category: true } } }, orderBy: { added_at: "asc" } });
  return items.map((i) => ({ product_id: i.product_id, name: i.product.name, category: i.product.category.name, company: i.product.company.name, slug: i.product.company.public_slug, legal_type: i.product.company.legal_type, price: Number(i.product.price), unit: i.product.unit, stock: i.product.stock_qty, min_order: i.product.min_order_qty, rating: i.product.company.reputation?.avg_rating ?? 0, deals: i.product.company.reputation?.deals_count ?? 0, delivery_days: i.product.delivery_days, is_active: i.product.is_active, photos: (i.product.photos_json as string[]) ?? [] }));
}
