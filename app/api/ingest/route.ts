import { fetchAndExtract } from "@/lib/ingest/fetch";
import { chunkMarkdown } from "@/lib/ingest/chunk";

export const runtime = "nodejs";

type IngestBody = { url?: string };

const MAX_SNIPPETS = 4;
const MAX_SNIPPET_CHARS = 800;
const MAX_INGEST_BYTES = 600_000;

export async function POST(req: Request) {
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  if (!body.url || !/^https?:\/\//i.test(body.url)) {
    return Response.json({ error: "유효한 http(s) URL 이 필요합니다." }, { status: 400 });
  }

  try {
    const doc = await fetchAndExtract(body.url);
    if (!doc.markdown || doc.markdown.length < 200) {
      return Response.json(
        { error: "본문을 충분히 추출하지 못했습니다. 다른 URL 을 시도해보세요." },
        { status: 422 },
      );
    }
    const truncated = doc.markdown.slice(0, MAX_INGEST_BYTES);
    const chunks = chunkMarkdown(truncated);
    const snippets = chunks.slice(0, MAX_SNIPPETS).map((c) => c.content.slice(0, MAX_SNIPPET_CHARS));
    return Response.json({
      ok: true,
      source: {
        url: body.url,
        title: doc.title,
        snippets,
        chunkCount: chunks.length,
        rawLength: doc.markdown.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[/api/ingest] fetch 실패:", msg);
    return Response.json({ error: `URL 처리 실패: ${msg}` }, { status: 502 });
  }
}
