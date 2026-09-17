import "dotenv/config";
import { prisma } from "../src/server/db";
import { upsertLogistics } from "../prisma/seed-data/logistics";
upsertLogistics(prisma).then((r) => { console.log("logistics:", r.category.code, "carrier:", r.carrier.name); return prisma.$disconnect(); });
