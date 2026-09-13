"use client";
import { useState } from "react";
// 14. Калькуляторы объёмов — подставляют результат в поле формы.
export function Calculators({ category }: { category: string }) {
  const [out, setOut] = useState<string | null>(null);
  const set = (key: string, v: number) => { const el = document.getElementById(`f_${key}`) as HTMLInputElement | null; if (el) el.value = String(Math.round(v * 100) / 100); setOut(`${key} = ${Math.round(v * 100) / 100}`); };
  const val = (k: string) => Number((document.getElementById(`f_${k}`) as HTMLInputElement | null)?.value || 0);
  if (category === "concrete") return <div className="card mb-4 text-sm"><b>Калькулятор бетона:</b> V = Д×Ш×В + запас <button className="btn-secondary ml-2" type="button" onClick={() => set("volume_m3", val("length_m") * val("width_m") * val("height_m") * 1.07)}>Посчитать (+7%)</button> {out}</div>;
  if (category === "roof") return <div className="card mb-4 text-sm"><b>Калькулятор кровли:</b> S = основание / cos(угла) × длина × 2 ската + запас <button className="btn-secondary ml-2" type="button" onClick={() => { const a = (val("angle_deg") * Math.PI) / 180; set("area_m2", ((val("base_m") / 2) / Math.cos(a)) * val("length_m") * 2 * 1.1); }}>Посчитать (+10%)</button> {out}</div>;
  if (category === "walls") return <div className="card mb-4 text-sm"><b>Калькулятор кладки:</b> площадь × толщина + 5% <button className="btn-secondary ml-2" type="button" onClick={() => set("volume_m3", val("wall_area_m2") * val("thickness_m") * 1.05)}>Посчитать</button> {out}</div>;
  if (category.startsWith("reno_")) return <RoomCalc onArea={(a) => set("area_m2", a)} out={out} />;
  return null;
}
function RoomCalc({ onArea, out }: { onArea: (a: number) => void; out: string | null }) {
  const [rooms, setRooms] = useState([{ l: 4, w: 3 }]);
  const total = rooms.reduce((s, r) => s + r.l * r.w, 0);
  return <div className="card mb-4 text-sm"><b>Площади из габаритов комнат:</b> {rooms.map((r, i) => <span key={i} className="ml-2 inline-flex gap-1"><input className="input w-16" type="number" value={r.l} onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, l: +e.target.value } : x))} />×<input className="input w-16" type="number" value={r.w} onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, w: +e.target.value } : x))} /></span>)}
    <button type="button" className="btn-secondary ml-2" onClick={() => setRooms([...rooms, { l: 3, w: 3 }])}>+ комната</button> = {total.toFixed(1)} м² <button type="button" className="btn-secondary ml-2" onClick={() => onArea(total)}>Подставить</button> {out}</div>;
}
