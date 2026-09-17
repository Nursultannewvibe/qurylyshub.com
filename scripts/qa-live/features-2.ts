/* Продолжение сценариев раздела 6: доска, товары, логистика, связка (дописываются по мере реализации фич). */
import type * as D from "./driver";
export type Ctx = { run: (id: string, title: string, fn: (st: string[]) => Promise<string | void>) => Promise<void>; aidar: D.Session; adm: D.Session; house: { id: string }; flat: { id: string }; photo: string; cid: (s: D.Session) => Promise<string> };
export async function run(_c: Ctx) {}
