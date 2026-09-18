/** Подсветка разницы в таблицах сравнения (КП и товары): минимальное значение — зелёным, максимальное — красным. */
export function extremes(values: (number | null | undefined)[]) {
  const nums = values.map((v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v)));
  const present = nums.filter((v): v is number => v != null);
  if (present.length < 2) return { min: -1, max: -1 };
  const min = Math.min(...present), max = Math.max(...present);
  if (min === max) return { min: -1, max: -1 };
  return { min, max };
}
export function hl(value: number | null | undefined, ex: { min: number; max: number }, lowerIsBetter = true) {
  if (value == null || ex.min < 0) return "";
  const v = Number(value);
  if (v === ex.min) return lowerIsBetter ? "bg-green-50 font-semibold text-green-800" : "bg-red-50 text-red-800";
  if (v === ex.max) return lowerIsBetter ? "bg-red-50 text-red-800" : "bg-green-50 font-semibold text-green-800";
  return "";
}
