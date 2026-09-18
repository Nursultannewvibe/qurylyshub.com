import Link from "next/link";
import { requireSession } from "@/server/auth";
import { compareRows } from "@/server/services/compare";
import { Flash, Money } from "@/components/ui";
import { extremes, hl } from "@/lib/compare";
import { removeFromCompareAction, clearCompareAction } from "@/server/actions/compare";
import { ProductGallery } from "@/components/product-gallery";
import { config } from "@/server/config";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const s = await requireSession(); const sp = await searchParams;
  const rows = await compareRows(s.user.id);
  const active = rows.filter((r) => r.is_active);
  const exPrice = extremes(active.map((r) => r.price)); const exDays = extremes(active.map((r) => r.delivery_days)); const exRating = extremes(active.map((r) => r.rating));
  return <div><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h1 className="h1">Сравнение товаров</h1><p className="muted">Та же таблица, что при сравнении КП: лучшее значение подсвечено зелёным, худшее — красным. Остатки — на момент открытия страницы; при покупке остаток проверяется заново.</p></div>{rows.length > 0 && <form action={clearCompareAction}><button className="btn-secondary">Очистить список</button></form>}</div><Flash sp={sp} />
    {rows.length ? <div className="card overflow-x-auto"><p className="muted mb-2 text-xs">Категория: <b>{rows[0].category}</b> · {rows.length} из {config.compareMax}</p><table className="table"><thead><tr><th></th><th>Товар</th><th>Продавец</th><th>Цена</th><th>Ед.</th><th>Остаток</th><th>Рейтинг продавца</th><th>Срок поставки</th><th></th><th></th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.product_id} className={r.is_active ? "" : "opacity-50"}><td><ProductGallery photos={r.photos} name={r.name} /></td><td><b>{r.name}</b>{!r.is_active && <div className="text-xs text-red-700">снят с продажи</div>}{r.min_order > 1 && <div className="muted text-xs">мин. заказ {r.min_order}</div>}</td><td><Link className="text-brand-600" href={`/catalog/${r.slug}`}>{r.company}</Link>{r.legal_type === "individual_contractor" && <div className="text-xs text-amber-800">физлицо-исполнитель</div>}</td>
        <td className={hl(r.price, exPrice)}><Money v={r.price} /></td><td>{r.unit}</td><td className={r.stock === 0 ? "text-red-700" : ""}>{r.stock == null ? "под заказ" : r.stock === 0 ? "нет в наличии" : r.stock}</td><td className={hl(r.rating, exRating, false)}>★ {r.rating.toFixed(1)} <span className="muted text-xs">({r.deals} сделок)</span></td><td className={hl(r.delivery_days, exDays)}>{r.delivery_days != null ? `${r.delivery_days} дн.` : "—"}</td>
        <td>{r.is_active && r.stock !== 0 ? <Link href={`/catalog/${r.slug}#product-${r.product_id}`} className="btn-primary text-xs">Купить</Link> : null}</td><td><form action={removeFromCompareAction}><input type="hidden" name="product_id" value={r.product_id} /><button className="btn-secondary text-xs">убрать</button></form></td></tr>)}</tbody></table></div>
    : <div className="card"><p className="muted">Список сравнения пуст. Откройте <Link className="text-brand-600" href="/catalog">каталог</Link>, выберите компанию и нажмите «+ Сравнить» у товаров одной категории (до {config.compareMax} позиций).</p></div>}</div>;
}
