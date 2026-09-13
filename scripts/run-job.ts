import "dotenv/config";
import { JOBS } from "../src/server/jobs";
import { prisma } from "../src/server/db";
const name = process.argv[2];
(async () => {
  if (!name || !JOBS[name]) { console.log("Доступные джобы:", Object.keys(JOBS).join(", ")); process.exit(name ? 1 : 0); }
  console.log(await JOBS[name].run());
  await prisma.$disconnect();
})();
