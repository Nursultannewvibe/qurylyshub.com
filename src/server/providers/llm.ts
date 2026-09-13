// LLM-провайдер: реальный вызов Anthropic API при наличии ключа, иначе детерминированный мок.
// ПРИВАТНОСТЬ (10В): в промпт НИКОГДА не передаются адрес/ФИО/телефон — только техническое содержимое.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

export interface LlmProvider {
  readonly name: string;
  completeJson(system: string, user: string): Promise<unknown>;
}

const PII_PATTERNS = [
  /\+?7[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g, // телефоны РК
  /(?<!\d)8\d{10}(?!\d)/g,
  /[\w.+-]+@[\w-]+\.[\w.]+/g, // e-mail
  /(?<![а-яё])(адрес|ул|улица|пр|проспект|мкр|микрорайон|кв|квартира|уч|участок)\.?:?\s+[^\n,;]+/gi, // явные адресные маркеры
];

/**
 * Удаляет телефоны, e-mail, явные адреса и известные бэкенду ПДн (точные значения: адрес объекта, имя/телефон владельца).
 * Полная гарантия невозможна на свободном тексте — см. README, оговорка 10В.
 */
export function stripPii(text: string, known: (string | null | undefined)[] = []) {
  let t = text;
  for (const k of known) if (k && k.trim().length >= 3) t = t.split(k).join("[скрыто]");
  for (const re of PII_PATTERNS) t = t.replace(re, "[скрыто]");
  return t;
}

class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client = new Anthropic({ apiKey: config.anthropicKey! });
  async completeJson(system: string, user: string) {
    const res = await this.client.messages.create({ model: config.llmModel, max_tokens: 2000, system, messages: [{ role: "user", content: user }] });
    const text = res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

class MockLlmProvider implements LlmProvider {
  readonly name = "mock";
  async completeJson(system: string, user: string) {
    if (system.includes("REVIEW_SUMMARY")) {
      const positives = (user.match(/\[(4|5)\]/g) ?? []).length; const negatives = (user.match(/\[(1|2)\]/g) ?? []).length;
      return { praise: positives ? `Хвалят: сроки и качество монтажа (${positives} положит. отзывов)` : "Пока нет положительных отзывов", complaints: negatives ? `Ругают: коммуникацию и уборку после работ (${negatives} негат. отзывов)` : "Существенных жалоб нет", incidents: user.includes("спор") ? "Есть закрытые споры" : "Инцидентов не зафиксировано" };
    }
    // AI-разбор заявки: извлечение чисел/ключевых слов эвристикой
    const num = (re: RegExp) => { const m = user.match(re); return m ? Number(m[1].replace(",", ".")) : undefined; };
    const out: Record<string, unknown> = {};
    const count = num(/(\d+)\s*(окн|окон|изделий|шт)/i); if (count) out.count = count;
    const area = num(/(\d+[.,]?\d*)\s*(м2|м²|кв\.?\s*м)/i); if (area) out.area_m2 = area;
    const vol = num(/(\d+[.,]?\d*)\s*(м3|м³|куб)/i); if (vol) out.volume_m3 = vol;
    const points = num(/(\d+)\s*(точек|точки|розет)/i); if (points) out.points = points;
    if (/лент/i.test(user)) out.structure_type = "лента"; if (/плит/i.test(user) && /ушп|фундамент/i.test(user)) out.structure_type = "плита-УШП";
    if (/м300|в22/i.test(user)) out.grade = "М300 (В22.5)"; if (/м250/i.test(user)) out.grade = "М250 (В20)";
    if (/rehau|рехау/i.test(user)) out.profile_class = "Rehau"; if (/kbe|кбе/i.test(user)) out.profile_class = "KBE";
    if (/двухкамер/i.test(user)) out.glazing = "двухкамерный"; if (/энергосбер/i.test(user)) out.glazing = "двухкамерный энергосберегающий";
    if (/двускат/i.test(user)) out.roof_type = "двускатная"; if (/вальм/i.test(user)) out.roof_type = "вальмовая";
    if (/металлочереп/i.test(user)) out.covering = "металлочерепица (мин. уклон 14°)";
    if (/монтаж/i.test(user)) out.install_needed = true; if (/замер/i.test(user)) out.measurement_needed = true;
    if (/гидроизол/i.test(user)) out.waterproofing = true; if (/заземл/i.test(user)) out.grounding = true;
    const sizes = user.match(/\d{3,4}\s*[x×х]\s*\d{3,4}/gi); if (sizes) out.sizes = sizes.join("; ");
    return { values: out, confidence: 0.6, notes: "mock: эвристическое извлечение (ANTHROPIC_API_KEY не задан)" };
  }
}

export const llmProvider: LlmProvider = config.anthropicKey ? new AnthropicProvider() : new MockLlmProvider();
