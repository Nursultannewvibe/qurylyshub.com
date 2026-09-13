import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireSession } from "@/server/auth";
import { assertProjectAccess, validateUpload } from "@/server/services/projects";
import { prisma } from "@/server/db";
import { config } from "@/server/config";
import { AppError } from "@/server/errors";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await requireSession();
  await assertProjectAccess(id, s.user.id);
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const type = String(fd.get("type") ?? "document");
  try {
    if (!file) throw new AppError("no_file", "Файл не передан");
    validateUpload({ size: file.size, name: file.name }, config.uploadMaxMb);
    const dir = path.join(config.uploadDir, "projects", id); await mkdir(dir, { recursive: true });
    const safe = `${Date.now()}-${file.name.replace(/[^\w.\-а-яё]/gi, "_")}`;
    await writeFile(path.join(dir, safe), Buffer.from(await file.arrayBuffer()));
    await prisma.projectFile.create({ data: { project_id: id, type: type as never, url: `/uploads/projects/${id}/${safe}`, name: file.name, size_bytes: file.size, validated: true } });
    return NextResponse.redirect(new URL(`/projects/${id}?ok=${encodeURIComponent("Файл загружен")}`, req.url), 303);
  } catch (e) {
    return NextResponse.redirect(new URL(`/projects/${id}?error=${encodeURIComponent((e as Error).message)}`, req.url), 303);
  }
}
