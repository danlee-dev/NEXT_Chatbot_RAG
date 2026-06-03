import { runRag } from "@/lib/rag/orchestrate";

export const runtime = "nodejs";

type SearchBody = { query?: string };

export async function POST(req: Request) {
  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  if (!body.query || body.query.trim().length === 0) {
    return Response.json({ error: "query가 비어 있습니다." }, { status: 400 });
  }

  try {
    const { chunks, rewrite } = await runRag(body.query);
    return Response.json({ chunks, rewrite });
  } catch (err) {
    console.error("[/api/search] 검색 실패:", err);
    return Response.json({ error: "검색 중 오류" }, { status: 500 });
  }
}
