import { requireSession, companyOf } from "@/server/auth";
import { prisma } from "@/server/db";
import { Badge, Field, Flash, Money } from "@/components/ui";
import { createProductAction, updateProductAction } from "@/server/actions/products";
import Link from "next/link";
import { MultiPhotoInput } from "@/components/multi-photo-input";
import { ProductGallery } from "@/components/product-gallery";
import { config } from "@/server/config";

export default async function SupplierProducts({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams; const c = companyOf(s);
  const [company, products, cats] = await Promise.all([prisma.company.findUniqueOrThrow({ where: { id: c.id } }), prisma.product.findMany({ where: { company_id: c.id }, include: { category: true, _count: { select: { deals: true } } }, orderBy: { created_at: "desc" } }), prisma.category.findMany({ orderBy: { order_index: "asc" } })]);
  const mine = cats.filter((k) => ((company.categories_json as string[]) ?? []).includes(k.id));
  return <div><h1 className="h1 mb-1">Товары — {company.name}</h1><p className="muted mb-4">Прямая продажа без заявки и КП: покупатель выбирает товар в вашей <Link className="text-brand-600" href={`/catalog/${company.public_slug}`}>карточке</Link>, оплачивает, подтверждает получение — деньги за вычетом комиссии платформы зачисляются на баланс.</p><Flash sp={sp} />
    <div className="grid gap-4 lg:grid-cols-3"><div className="card lg:col-span-2"><table className="table"><thead><tr><th>Фото</th><th>Товар</th><th>Категория</th><th>Цена</th><th>Остаток</th><th>Заказов</th><th>Статус</th><th></th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><ProductGallery photos={(p.photos_json as string[]) ?? []} name={p.name} /></td><td><b>{p.name}</b><div className="muted text-xs">{p.description}</div></td><td>{p.category.name}</td><td><Money v={p.price} />/{p.unit}</td><td>{p.stock_qty ?? "под заказ"}</td><td>{p._count.deals}</td><td><Badge s={p.is_active ? "active" : "paused"}>{p.is_active ? "в продаже" : "скрыт"}</Badge></td>
      <td><form action={updateProductAction} className="flex gap-1"><input type="hidden" name="product_id" value={p.id} /><input className="input w-24" name="price" type="number" defaultValue={Number(p.price)} /><input className="input w-20" name="stock_qty" type="number" defaultValue={p.stock_qty ?? ""} placeholder="∞" /><label className="text-xs"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> в продаже</label><button className="btn-secondary text-xs">Сохранить</button>
        <details className="text-xs"><summary className="cursor-pointer text-slate-500">фото ({((p.photos_json as string[]) ?? []).length}/{config.productPhotosMax})</summary>{((p.photos_json as string[]) ?? []).map((u) => <label key={u} className="mr-2 inline-flex items-center gap-1"><img src={u} alt="" className="h-10 w-10 rounded object-cover" /><input type="checkbox" name="remove_photo" value={u} /> удалить</label>)}<MultiPhotoInput maxCount={config.productPhotosMax} maxMb={config.uploadEffectiveMaxMb} existing={((p.photos_json as string[]) ?? []).length} /></details></form></td></tr>)}</tbody></table>{!products.length && <p className="muted">Товаров пока нет — добавьте первый справа.</p>}</div>
      <form action={createProductAction} className="card space-y-2"><h2 className="h2">Добавить товар</h2>
        <Field label="Категория"><select className="input" name="category_id">{(mine.length ? mine : cats).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
        <Field label="Название"><input className="input" name="name" required placeholder="Бетон М300, м³" /></Field>
        <Field label="Описание"><textarea className="input" name="description" rows={2} /></Field>
        <div className="grid grid-cols-3 gap-1"><Field label="Ед."><input className="input" name="unit" defaultValue="шт" /></Field><Field label="Цена, ₸"><input className="input" name="price" type="number" required /></Field><Field label="Мин. заказ"><input className="input" name="min_order_qty" type="number" defaultValue={1} /></Field></div>
        <Field label="Остаток на складе" hint="Пусто = под заказ, без ограничения по количеству"><input className="input" name="stock_qty" type="number" /></Field>
        <Field label="Срок поставки, дн." hint="Показывается в карточке и в сравнении"><input className="input" name="delivery_days" type="number" /></Field>
        <Field label="Фото товара"><MultiPhotoInput maxCount={config.productPhotosMax} maxMb={config.uploadEffectiveMaxMb} /></Field>
        <button className="btn-primary">Добавить</button></form></div></div>;
}
