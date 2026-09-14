"use client";
import { useState } from "react";
/** Поле файла с проверкой размера ДО отправки (сервер/хостинг могут отвергнуть большое тело запроса без понятного ответа). */
export function FileInput({ name, accept, maxMb, required, className = "text-sm" }: { name: string; accept?: string; maxMb: number; required?: boolean; className?: string }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-block">
      <input type="file" name={name} accept={accept} required={required} className={className} data-max-mb={maxMb}
        onChange={(e) => { const f = e.currentTarget.files?.[0]; const bad = f && f.size > maxMb * 1024 * 1024; e.currentTarget.setCustomValidity(bad ? `Файл больше ${maxMb} МБ` : ""); setErr(bad ? `Файл ${(f!.size / 1048576).toFixed(1)} МБ — больше лимита ${maxMb} МБ. Сожмите фото или выберите другой файл.` : null); }} />
      {err && <span className="block text-xs text-red-700">{err}</span>}
    </span>
  );
}
