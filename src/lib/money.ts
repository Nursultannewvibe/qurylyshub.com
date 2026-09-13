import { Prisma } from "@prisma/client";
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const fmtKZT = (v: Prisma.Decimal.Value | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 }).format(Number(v)) + " ₸";
