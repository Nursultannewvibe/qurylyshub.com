import { BoardList } from "../list";
export const dynamic = "force-dynamic";
export default async function P({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) { const { category } = await params; return <BoardList category={category} region={null} sp={await searchParams} />; }
