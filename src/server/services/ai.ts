import { prisma } from "../db";
import { AppError, notFound } from "../errors";
import { llmProvider, stripPii } from "../providers/llm";
import { config } from "../config";
import { logActivity } from "../activity";
import { currentTemplate } from "./requests";
import { assertProjectAccess } from "./projects";

/**
 * 10В. AI-разбор заявки: текст (описание/расшифровка голоса/описание плана) → ai_extracted_json → предзаполненная форма.
 * В LLM уходит ТОЛЬКО техническое содержимое: stripPii() + никаких полей объекта кроме типа/площади/этажности.
 * Фактически отправленный промпт сохраняется в ai_parses.sent_prompt для аудита.
 */
export async function aiParseRequest(userId: string, input: { project_id: string; category_id: string; text: string; input_kind?: "text" | "photo" | "voice" | "plan" }) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const used = await prisma.aiParse.count({ where: { user_id: userId, created_at: { gte: dayStart } } });
  if (used >= config.aiParseDailyLimit) throw new AppError("ai_rate_limit", `Лимит AI-разборов на сегодня исчерпан (${config.aiParseDailyLimit})`, 429);
  const project = await assertProjectAccess(input.project_id, userId);
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: project.owner_id } });
  const knownPii = [project.address, owner.name, owner.phone, owner.email, ...(owner.name?.split(/\s+/) ?? [])];
  const category = await prisma.category.findUnique({ where: { id: input.category_id } });
  if (!category) throw notFound("Категория не найдена");
  const tpl = await currentTemplate(category.id);
  const schema = tpl.parameters.map((p) => `- ${p.key} (${p.field_type}${p.options_json ? ": " + (p.options_json as string[]).join(" | ") : ""}${p.unit ? ", " + p.unit : ""}): ${p.label}`).join("\n");
  const technical = `Тип объекта: ${project.object_type}; площадь: ${project.area ?? "?"} м²; этажей: ${project.floors ?? "?"}; сейсмичность: ${project.seismicity ?? "?"}`;
  const system = `Ты — инженер-сметчик. Извлеки параметры заявки категории «${category.name}» из описания заказчика. Верни СТРОГО JSON вида {"values": {<key>: <value>}, "confidence": 0..1, "notes": "..."}. Ключи только из списка:\n${schema}\nНе выдумывай значения, которых нет в тексте.`;
  const user = `${technical}\n\nОписание (источник: ${input.input_kind ?? "text"}):\n${stripPii(input.text, knownPii)}`;
  const result = (await llmProvider.completeJson(system, user)) as { values?: Record<string, unknown>; confidence?: number; notes?: string };
  const values: Record<string, unknown> = {};
  for (const p of tpl.parameters) if (result.values && result.values[p.key] !== undefined) values[p.key] = result.values[p.key];
  const row = await prisma.aiParse.create({ data: { user_id: userId, project_id: project.id, category_id: category.id, input_kind: input.input_kind ?? "text", sent_prompt: `${system}\n---\n${user}`, result_json: { values, confidence: result.confidence ?? null, notes: result.notes ?? null } as never, provider: llmProvider.name } });
  await logActivity({ actor_id: userId, entity_type: "ai_parse", entity_id: row.id, action: "parsed", meta: { provider: llmProvider.name, keys: Object.keys(values) } });
  return { parse_id: row.id, values, confidence: result.confidence ?? null, notes: result.notes ?? null, template: tpl, sent_prompt: row.sent_prompt, provider: llmProvider.name, remaining: config.aiParseDailyLimit - used - 1 };
}
