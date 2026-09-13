import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { config } from "../config";
import { validateUpload } from "./projects";

/** Сохранение файла из формы (server action / route). Возвращает URL для /uploads/*. На serverless-хостинге диск временный — см. README. */
export async function saveUpload(file: File, subdir: string) {
  validateUpload({ size: file.size, name: file.name }, config.uploadMaxMb);
  const dir = path.join(config.uploadDir, subdir);
  await mkdir(dir, { recursive: true });
  const safe = `${Date.now()}-${file.name.replace(/[^\w.\-а-яё]/gi, "_")}`;
  await writeFile(path.join(dir, safe), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${subdir}/${safe}`;
}
export const fileFrom = (fd: FormData, key: string) => { const f = fd.get(key); return f instanceof File && f.size > 0 ? f : null; };
