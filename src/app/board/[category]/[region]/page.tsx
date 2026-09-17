import { BoardList } from "../../list";
export const dynamic = "force-dynamic";
export default async function P({ params, searchParams }: { params: Promise<{ category: string; region: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) { const { category, region } = await params; return <BoardList category={category} region={region} sp={await searchParams} />; }
