import { randomBytes } from "crypto";
export const referralCode = () => randomBytes(4).toString("hex").toUpperCase();
const TR: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ә: "a", і: "i", ң: "n", ғ: "g", ү: "u", ұ: "u", қ: "q", ө: "o", һ: "h" };
/** URL-безопасный slug: кириллица транслитерируется (кириллический slug в пути даёт 404 из-за percent-encoding параметра). */
export const slugify = (s: string) =>
  (s.toLowerCase().replace(/[а-яёәіңғүұқөһ]/g, (ch) => TR[ch] ?? "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "company") + "-" + randomBytes(2).toString("hex");
