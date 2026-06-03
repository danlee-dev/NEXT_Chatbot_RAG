export type Chunk = {
  content: string;
  index: number;
  tokenEst: number;
};

const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;
const MIN_CHARS = 200;
const OVERLAP_CHARS = 180;

/**
 * 마크다운 헤더 기준으로 1차 분할 후, 큰 섹션은 슬라이딩 윈도우로 2차 분할.
 *
 * Why: 단순 N자 단위로 자르면 헤더 중간이 잘려 임베딩 품질이 떨어진다.
 * docs/changelog는 "## Topic" 헤더가 의미 단위라 거기서 자르면 retrieve가 잘 된다.
 */
export function chunkMarkdown(md: string): Chunk[] {
  const clean = md.trim();
  if (!clean) return [];

  const sections = splitByHeaders(clean);
  const chunks: string[] = [];
  for (const sec of sections) {
    if (sec.length < MIN_CHARS) continue;
    if (sec.length <= MAX_CHARS) {
      chunks.push(sec);
    } else {
      chunks.push(...slidingWindow(sec));
    }
  }
  return chunks.map((content, index) => ({
    content,
    index,
    tokenEst: estimateTokens(content),
  }));
}

function splitByHeaders(md: string): string[] {
  const lines = md.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const joined = current.join("\n").trim();
    if (joined) sections.push(joined);
    current = [];
  };

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line) && current.length > 0) {
      const joined = current.join("\n").trim();
      if (joined.length >= TARGET_CHARS / 2) {
        flush();
      }
    }
    current.push(line);
  }
  flush();

  // 너무 작은 인접 섹션은 병합
  const merged: string[] = [];
  for (const sec of sections) {
    const last = merged[merged.length - 1];
    if (last && last.length + sec.length + 2 <= TARGET_CHARS) {
      merged[merged.length - 1] = `${last}\n\n${sec}`;
    } else {
      merged.push(sec);
    }
  }
  return merged;
}

function slidingWindow(text: string): string[] {
  const out: string[] = [];
  const step = TARGET_CHARS - OVERLAP_CHARS;
  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(text.length, start + TARGET_CHARS);
    const slice = text.slice(start, end).trim();
    if (slice.length >= MIN_CHARS) out.push(slice);
    if (end >= text.length) break;
  }
  return out;
}

function estimateTokens(text: string): number {
  // 영문 ~4 chars/token, 한글 ~1.5 chars/token. 보수적으로 3.
  return Math.ceil(text.length / 3);
}
