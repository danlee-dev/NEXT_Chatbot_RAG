import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { chatModel } from "@/lib/ai/model";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { stackSageTools } from "@/lib/tools";
import {
  MAX_INPUT_CHARS,
  MAX_OUTPUT_TOKENS,
  MAX_HISTORY_MESSAGES,
  TEMPERATURE,
} from "@/lib/utils/limits";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const sessionBlock = buildSessionSourcesBlock(sessionSources);
  if (sessionBlock) systemPrompt = `${systemPrompt}\n\n${sessionBlock}`;

  try {
    const modelMessages = await convertToModelMessages(trimmedMessages);
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: modelMessages,
      tools: stackSageTools,
      stopWhen: stepCountIs(6),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    });

    return result.toUIMessageStreamResponse();
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

function buildSessionSourcesBlock(sources: SessionSource[] | undefined): string {
  if (!sources || sources.length === 0) return "";
  const blocks = sources.map((s, i) => {
    return [
      `## [session-${i + 1}] ${s.title ?? s.url}`,
      `URL: ${s.url}`,
      "",
      s.snippets.join("\n\n"),
    ].join("\n");
  });
  return [
    "# 사용자가 세션에 추가한 자료 (URL ingest)",
    "이 자료도 rag_search 결과와 동등하게 인용 가능. 인용 라벨: [session-N]",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}
