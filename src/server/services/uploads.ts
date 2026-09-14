import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { config } from "../config";
import { validateUpload } from "./projects";
import { AppError } from "../errors";
import { prisma } from "../db";

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".dwg": "application/octet-stream", ".dxf": "application/octet-stream" };

/**
 * Сохранение файла из формы. Возвращает URL:
 *  — UPLOAD_STORAGE=files: пишет в UPLOAD_DIR, URL /uploads/<subdir>/<name> (локально);
 *  — UPLOAD_STORAGE=inline: файл ≤ UPLOAD_INLINE_MAX_MB хранится как data-URL прямо в БД — временный режим для демо
 *    на serverless-хостинге, где диск не сохраняется между запусками (см. README «Известные упрощения»).
 */
export async function saveUpload(file: File, subdir: string, ownerId?: string) {
  validateUpload({ size: file.size, name: file.name }, config.uploadMaxMb);
  if (config.uploadStorage === "inline") {
    if (file.size > config.uploadInlineMaxMb * 1024 * 1024) throw new AppError("file_size", `В демо-режиме можно приложить файл до ${config.uploadInlineMaxMb} МБ (у вас ${(file.size / 1048576).toFixed(1)} МБ) — уменьшите фото или выберите другое`, 400);
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const mime = file.type || MIME[ext] || "application/octet-stream";
    // содержимое — в file_blobs, в сущности хранится только ссылка: страницы не тянут байты файлов из БД
    const blob = await prisma.fileBlob.create({ data: { mime, name: file.name, size: file.size, data: Buffer.from(await file.arrayBuffer()), owner_id: ownerId ?? null }, select: { id: true } });
    return `/f/${blob.id}/${encodeURIComponent(file.name.replace(/[^\w.\-а-яё]/gi, "_"))}`;
  }
  const dir = path.join(config.uploadDir, subdir);
  await mkdir(dir, { recursive: true });
  const safe = `${Date.now()}-${file.name.replace(/[^\w.\-а-яё]/gi, "_")}`;
  await writeFile(path.join(dir, safe), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${subdir}/${safe}`;
}
export const fileFrom = (fd: FormData, key: string) => { const f = fd.get(key); return f instanceof File && f.size > 0 ? f : null; };
export const isDataUrl = (u: string | null | undefined) => !!u && u.startsWith("data:");
