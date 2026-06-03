export type SeedTier = "docs" | "changelog" | "editorial" | "benchmark" | "community";

export type Seed = {
  url: string;
  tier: SeedTier;
  tag: string;
  title?: string;
};

/**
 * Stack Sage: AI 코딩 에이전트 메타 어드바이저 시드.
 *
 * tier:
 *   - docs       : 공식 문서 (도구 자체에 대한 사실 근거)
 *   - changelog  : release notes / changelog (최신 변화)
 *   - editorial  : 전문가 블로그 (비교·평가·맥락)
 *   - benchmark  : 정량 벤치마크 (객관 비교)
 *   - community  : 커뮤니티 토론 (실제 사용자 경험)
 *
 * fetch가 실패해도 다음 시드로 넘어가도록 ingestion runner가 처리한다.
 */
export const SEEDS: Seed[] = [
  // Tier 1 — docs
  { url: "https://docs.claude.com/en/docs/claude-code/overview", tier: "docs", tag: "claude-code" },
  { url: "https://docs.claude.com/en/docs/claude-code/quickstart", tier: "docs", tag: "claude-code" },
  { url: "https://docs.cursor.com/en/welcome", tier: "docs", tag: "cursor" },
  { url: "https://docs.cursor.com/en/get-started/concepts", tier: "docs", tag: "cursor" },
  { url: "https://aider.chat/", tier: "docs", tag: "aider" },
  { url: "https://aider.chat/docs/usage.html", tier: "docs", tag: "aider" },
  { url: "https://docs.windsurf.com/windsurf/getting-started", tier: "docs", tag: "windsurf" },
  { url: "https://docs.continue.dev/", tier: "docs", tag: "continue" },
  { url: "https://docs.cline.bot/getting-started/what-is-cline", tier: "docs", tag: "cline" },
  { url: "https://zed.dev/docs/ai/overview", tier: "docs", tag: "zed" },

  // Tier 2 — changelogs
  { url: "https://docs.claude.com/en/release-notes/claude-code", tier: "changelog", tag: "claude-code" },
  { url: "https://www.cursor.com/changelog", tier: "changelog", tag: "cursor" },
  { url: "https://aider.chat/HISTORY.html", tier: "changelog", tag: "aider" },
  { url: "https://docs.windsurf.com/windsurf/changelog", tier: "changelog", tag: "windsurf" },
  { url: "https://zed.dev/releases/stable", tier: "changelog", tag: "zed" },

  // Tier 3 — editorial / commentary
  { url: "https://simonwillison.net/tags/ai-assisted-programming/", tier: "editorial", tag: "simonw" },
  { url: "https://simonwillison.net/tags/llms/", tier: "editorial", tag: "simonw" },
  { url: "https://www.latent.space/", tier: "editorial", tag: "latent-space" },
  { url: "https://lilianweng.github.io/posts/2023-06-23-agent/", tier: "editorial", tag: "lilianweng" },
  { url: "https://hamel.dev/", tier: "editorial", tag: "hamel" },
  { url: "https://www.anthropic.com/engineering", tier: "editorial", tag: "anthropic-eng" },
  { url: "https://www.anthropic.com/engineering/claude-code-best-practices", tier: "editorial", tag: "anthropic-eng" },
  { url: "https://openai.com/index/introducing-codex/", tier: "editorial", tag: "openai-eng" },

  // Tier 4 — benchmarks
  { url: "https://www.swebench.com/", tier: "benchmark", tag: "swe-bench" },
  { url: "https://artificialanalysis.ai/", tier: "benchmark", tag: "artificialanalysis" },
  { url: "https://lmarena.ai/", tier: "benchmark", tag: "lmarena" },

  // Tier 4 — community (Reddit/HN — JSON endpoints handled in ingestor)
  { url: "https://www.reddit.com/r/cursor/top.json?t=month&limit=25", tier: "community", tag: "r/cursor" },
  { url: "https://www.reddit.com/r/ChatGPTCoding/top.json?t=month&limit=25", tier: "community", tag: "r/ChatGPTCoding" },
  { url: "https://hn.algolia.com/api/v1/search?query=AI+coding+agent&tags=story&hitsPerPage=20", tier: "community", tag: "hackernews" },
  { url: "https://hn.algolia.com/api/v1/search?query=Claude+Code&tags=story&hitsPerPage=15", tier: "community", tag: "hackernews" },
];
