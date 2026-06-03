import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const REWRITE_MODEL = "gpt-4o-mini";

const RewriteSchema = z.object({
  hyde: z
    .string()
    .describe(
      "한 단락(60~120단어) 분량의 가상 답변. 검색용 임베딩 시드로만 쓰일 것이라 사실 정확도보다 키워드 풍부도가 중요.",
    ),
  queries: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "원래 질문을 다른 시각·다른 어휘로 재작성한 2~4개의 영어 검색 쿼리. 도구 이름·기술 용어 풀네임 포함.",
    ),
});

export type RewriteResult = z.infer<typeof RewriteSchema>;

const SYSTEM = `너는 AI 코딩 도구(Claude Code, Cursor, Codex CLI, Aider, Windsurf, Cline 등) 검색 쿼리 재작성기다.
입력 질문을 받아 두 가지를 만든다:

1) hyde: 그 질문에 대한 *그럴듯한 가상 답변*을 60~120단어로 영어로 작성.
   - 가상 답변의 본문은 검색용 dense embedding 의 seed 역할만 한다.
   - 사실 정확도보다 *해당 주제의 어휘·고유명사·관용 표현*이 많이 들어가야 좋다.
   - 도구 이름, 기능 이름, 가격 단위 같은 키워드가 자연스레 등장하도록.
2) queries: 같은 질문을 다른 각도에서 본 *영어* 키워드 쿼리 2~4개.
   - 한 줄당 한 쿼리. 의문문보다 키워드 phrase 가 더 좋다.
   - 약어/풀네임(Codex CLI, OpenAI Codex), 동의어(IDE/editor, terminal/CLI) 포함.

질문이 한국어면 결과도 영어로. 영어면 영어 그대로.`;

export async function rewriteQuery(question: string): Promise<RewriteResult> {
  const { object } = await generateObject({
    model: openai(REWRITE_MODEL),
    schema: RewriteSchema,
    system: SYSTEM,
    prompt: `질문: ${question.trim()}`,
    temperature: 0.4,
  });
  return object;
}
