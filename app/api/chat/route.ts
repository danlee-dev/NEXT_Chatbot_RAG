import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { chatModel } from "@/lib/ai/model";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { runRag, buildRagContext } from "@/lib/rag/orchestrate";
import {
  MAX_INPUT_CHARS,
  MAX_OUTPUT_TOKENS,
  MAX_HISTORY_MESSAGES,
  TEMPERATURE,
} from "@/lib/utils/limits";

export const runtime = "nodejs";

type SessionSource = {
  url: string;
  title?: string;
  snippets: string[];
};

type ChatRequestBody = {
  messages: UIMessage[];
  sessionSources?: SessionSource[];
};

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { messages, sessionSources } = body;

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "서버에 OPENAI_API_KEY가 설정되어 있지 않습니다." },
      { status: 500 },
    );
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "메시지가 비어 있습니다." }, { status: 400 });
  }

  const lastMessage = messages[messages.length - 1];
  const lastText = extractText(lastMessage);
  if (!lastText.trim()) {
    return Response.json({ error: "마지막 메시지가 비어 있습니다." }, { status: 400 });
  }
  if (lastText.length > MAX_INPUT_CHARS) {
    return Response.json(
      { error: `메시지가 너무 깁니다. ${MAX_INPUT_CHARS}자 이하로 줄여주세요.` },
      { status: 400 },
    );
  }

  const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES);

  let systemPrompt = buildSystemPrompt();
  let ragChunks: Awaited<ReturnType<typeof runRag>>["chunks"] = [];
  let ragRewrite: Awaited<ReturnType<typeof runRag>>["rewrite"] | null = null;

  try {
    const rag = await runRag(lastText);
    ragChunks = rag.chunks;
    ragRewrite = rag.rewrite;
    const ctx = buildRagContext(rag.chunks);
    if (ctx) systemPrompt = `${systemPrompt}\n\n${ctx}`;
  } catch (err) {
    console.error("[chat] RAG 실패 (RAG 없이 진행):", err);
  }

  const sessionBlock = buildSessionSourcesBlock(sessionSources, ragChunks.length);
  if (sessionBlock) systemPrompt = `${systemPrompt}\n\n${sessionBlock}`;

  try {
    const modelMessages = await convertToModelMessages(trimmedMessages);
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    });

    const sessionOffset = ragChunks.length;
    return result.toUIMessageStreamResponse({
      messageMetadata: () => ({
        sources: [
          ...ragChunks.map((c, i) => ({
            n: i + 1,
            url: c.url,
            title: c.title,
            tag: c.sourceTag,
            type: c.sourceType,
            content: c.content,
            score: c.score,
            kind: "rag" as const,
          })),
          ...(sessionSources ?? []).flatMap((s, i) => [
            {
              n: sessionOffset + i + 1,
              url: s.url,
              title: s.title ?? null,
              tag: "session" as string | null,
              type: "session" as string | null,
              content: s.snippets.join("\n\n"),
              score: 0,
              kind: "session" as const,
            },
          ]),
        ],
        rewrite: ragRewrite,
      }),
    });
  } catch (err) {
    console.error("[/api/chat] streamText 실패:", err);
    return Response.json(
      { error: "모델 호출 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function extractText(message: UIMessage): string {
  if (!message?.parts) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function buildSessionSourcesBlock(
  sources: SessionSource[] | undefined,
  ragCount: number,
): string {
  if (!sources || sources.length === 0) return "";
  const blocks = sources.map((s, i) => {
    const n = ragCount + i + 1;
    return [
      `[${n}] ${s.title ?? s.url} (사용자 추가)`,
      `URL: ${s.url}`,
      "",
      s.snippets.join("\n\n"),
    ].join("\n");
  });
  return [
    "# 사용자가 세션에 추가한 자료 (URL ingest)",
    "이 자료도 위의 근거 자료와 동등하게 인용해도 된다. 인용 번호는 이어서 매긴다.",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}
