/* Удаление данных QA-прогона (объекты/компании/пользователи с меткой [QA] / телефонами +77099…) в порядке зависимостей. activity_log не трогается. */
import "dotenv/config";
import { prisma } from "../../src/server/db";
(async () => {
  const users = await prisma.user.findMany({ where: { OR: [{ phone: { startsWith: "+77099" } }, { name: { startsWith: "[QA]" } }] }, select: { id: true } });
  const uids = users.map((u) => u.id);
  const projects = await prisma.project.findMany({ where: { OR: [{ name: { startsWith: "[QA]" } }, { owner_id: { in: uids } }] }, select: { id: true } });
  const pids = projects.map((p) => p.id);
  const companies = await prisma.company.findMany({ where: { OR: [{ name: { startsWith: "[QA]" } }, { members: { some: { user_id: { in: uids } } } }] }, select: { id: true } });
  const cids = companies.map((c) => c.id);
  const deals = await prisma.deal.findMany({ where: { OR: [{ request: { project_id: { in: pids } } }, { seller_id: { in: cids } }, { buyer_id: { in: uids } }] }, select: { id: true } });
  const dids = deals.map((d) => d.id);
  const r1 = await prisma.payment.deleteMany({ where: { OR: [{ deal_id: { in: dids } }, { payer_id: { in: uids } }, { lead: { request: { project_id: { in: pids } } } }] } });
  const r2 = await prisma.deal.deleteMany({ where: { id: { in: dids } } });
  await prisma.requestBatch.deleteMany({ where: { OR: [{ created_by_company_id: { in: cids } }, { items: { some: { request: { project_id: { in: pids } } } } }] } });
  const r3 = await prisma.project.deleteMany({ where: { id: { in: pids } } });
  await prisma.reviewResponse.deleteMany({ where: { company_id: { in: cids } } });
  await prisma.reviewDispute.deleteMany({ where: { opened_by_company_id: { in: cids } } });
  await prisma.offerTemplate.deleteMany({ where: { name: "QA шаблон" } });
  await prisma.lead.deleteMany({ where: { company_id: { in: cids } } });
  await prisma.offer.deleteMany({ where: { company_id: { in: cids } } });
  await prisma.supplierPitch.deleteMany({ where: { company_id: { in: cids } } });
  await prisma.thread.deleteMany({ where: { seller_id: { in: cids } } });
  const r4 = await prisma.company.deleteMany({ where: { id: { in: cids } } });
  await prisma.aiParse.deleteMany({ where: { user_id: { in: uids } } });
  await prisma.phoneChangeLog.deleteMany({ where: { user_id: { in: uids } } });
  await prisma.otpAttempt.deleteMany({ where: { phone: { startsWith: "+77099" } } });
  await prisma.otpCode.deleteMany({ where: { phone: { startsWith: "+77099" } } });
  const r5 = await prisma.user.deleteMany({ where: { id: { in: uids } } });
  await prisma.company.updateMany({ where: { soft_ban_reason: { startsWith: "auto:" } }, data: { soft_banned_until: null, soft_ban_reason: null } }); // авто-баны из QA-споров
  await prisma.verification.updateMany({ where: { company: { public_slug: "elektromontazh" }, doc_type: "license", status: "rejected" }, data: { status: "pending" } });
  console.log({ payments: r1.count, deals: r2.count, projects: r3.count, companies: r4.count, users: r5.count });
  await prisma.$disconnect();
})();
