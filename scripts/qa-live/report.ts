/* Печатает markdown-таблицу по qa-live-result.json (последний прогон). */
import { readFileSync } from "fs";
type Row = { id: string; role: string; title: string; type: string; steps: string[]; result: string; finding: string | null; ms: number };
const rows: Row[] = JSON.parse(readFileSync(process.argv[2] ?? "qa-live-result.json", "utf8"));
console.log("| # | Роль | Кейс / категория | Тип | Шаги (факт) | Что произошло | Проблема |");
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.id} | ${r.role} | ${r.title} | ${r.type} | ${r.steps.slice(0, 4).join(" → ").replace(/\|/g, "/").slice(0, 220)} | ${(r.finding ? "❌ " + r.finding : "✅ " + (r.result || "ок")).replace(/\|/g, "/").slice(0, 160)} | ${r.finding ? "да" : "нет"} |`);
console.log(`\n${rows.filter((r) => !r.finding).length}/${rows.length} без находок`);
