/** Миниатюра первого фото + галерея; без фото — плейсхолдер (серверный компонент). */
export function ProductGallery({ photos, name }: { photos: string[]; name: string }) {
  if (!photos.length) return <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400" title="Фото не добавлены">нет фото</div>;
  return <details className="inline-block align-middle"><summary className="list-none cursor-pointer"><img src={photos[0]} alt={name} loading="lazy" className="h-14 w-14 rounded border object-cover" />{photos.length > 1 && <span className="block text-center text-[10px] text-slate-500">+{photos.length - 1}</span>}</summary>
    <div className="mt-1 flex flex-wrap gap-1">{photos.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`${name} ${i + 1}`} loading="lazy" className="h-24 w-24 rounded border object-cover" /></a>)}</div></details>;
}
