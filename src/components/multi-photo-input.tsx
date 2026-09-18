"use client";
import { useRef, useState } from "react";
/** Несколько фото с превью и удалением до отправки; размер каждого и число проверяются до сабмита (сервер повторяет проверку). */
export function MultiPhotoInput({ name = "photos", maxCount, maxMb, existing = 0 }: { name?: string; maxCount: number; maxMb: number; existing?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const sync = (next: File[]) => { const dt = new DataTransfer(); next.forEach((f) => dt.items.add(f)); if (ref.current) ref.current.files = dt.files; setFiles(next); };
  return (
    <div className="space-y-1">
      <input ref={ref} type="file" name={name} accept="image/*" multiple className="text-xs" data-max-count={maxCount} data-max-mb={maxMb}
        onChange={(e) => { setErr(null); const picked = Array.from(e.currentTarget.files ?? []); const big = picked.find((f) => f.size > maxMb * 1024 * 1024); const next = [...files, ...picked.filter((f) => f.size <= maxMb * 1024 * 1024)];
          if (big) setErr(`«${big.name}» больше ${maxMb} МБ — пропущено`); if (existing + next.length > maxCount) { setErr(`Не больше ${maxCount} фото на товар (уже ${existing})`); sync(next.slice(0, Math.max(0, maxCount - existing))); } else sync(next); }} />
      {files.length > 0 && <div className="flex flex-wrap gap-2">{files.map((f, i) => <span key={i} className="relative inline-block"><img src={URL.createObjectURL(f)} alt={f.name} className="h-14 w-14 rounded border object-cover" /><button type="button" title="Убрать" onClick={() => sync(files.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] leading-4 text-white">×</button></span>)}</div>}
      {err && <p className="text-xs text-red-700">{err}</p>}
      <p className="text-xs text-slate-400">До {maxCount} фото, каждое до {maxMb} МБ.</p>
    </div>
  );
}
