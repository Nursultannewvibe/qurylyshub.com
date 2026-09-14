import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth";
import { assertProjectAccess } from "@/server/services/projects";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { saveUpload } from "@/server/services/uploads";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await requireSession();
  await assertProjectAccess(id, s.user.id);
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const type = String(fd.get("type") ?? "document");
  try {
    if (!file) throw new AppError("no_file", "Файл не передан");
    const url = await saveUpload(file, `projects/${id}`);
    await prisma.projectFile.create({ data: { project_id: id, type: type as never, url, name: file.name, size_bytes: file.size, validated: true } });
    return NextResponse.redirect(new URL(`/projects/${id}?ok=${encodeURIComponent("Файл загружен")}`, req.url), 303);
  } catch (e) {
    return NextResponse.redirect(new URL(`/projects/${id}?error=${encodeURIComponent((e as Error).message)}`, req.url), 303);
  }
}
