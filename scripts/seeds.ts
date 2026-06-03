export type SeedTier =
  | "docs"
  | "changelog"
  | "editorial"
  | "benchmark"
  | "community"
  | "api";

/** 단일 URL 시드 */
export type UrlSeed = {
  kind: "url";
  url: string;
  tier: SeedTier;
  tag: string;
};

/** sitemap.xml 을 fetch 해서 URL 들을 자동으로 펼치는 시드 */
export type SitemapSeed = {
  kind: "sitemap";
  sitemap: string;
  tier: SeedTier;
  tag: string;
  /** URL 경로에 정규식 필터 — docs/api 만 가져오고 싶을 때 */
  include?: RegExp;
  /** 너무 많은 페이지를 한 번에 인덱싱 안 하도록 cap */
  maxUrls?: number;
};

export type Seed = UrlSeed | SitemapSeed;

const u = (url: string, tier: SeedTier, tag: string): UrlSeed => ({ kind: "url", url, tier, tag });
const sm = (sitemap: string, tier: SeedTier, tag: string, opts?: { include?: RegExp; maxUrls?: number }): SitemapSeed => ({
  kind: "sitemap",
  sitemap,
  tier,
  tag,
  include: opts?.include,
  maxUrls: opts?.maxUrls ?? 40,
});

export const SEEDS: Seed[] = [
  // ──────────────────────────────────────────────────────────
  // Anthropic — API + Claude Code docs
  // ──────────────────────────────────────────────────────────
  u("https://docs.claude.com/en/docs/claude-code/overview", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/quickstart", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/common-workflows", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/sub-agents", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/hooks", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/mcp", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/settings", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/sdk", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/iam", "docs", "claude-code"),
  u("https://docs.claude.com/en/docs/claude-code/troubleshooting", "docs", "claude-code"),
  u("https://docs.claude.com/en/release-notes/claude-code", "changelog", "claude-code"),
  u("https://docs.claude.com/en/api/getting-started", "api", "anthropic"),
  u("https://docs.claude.com/en/api/messages", "api", "anthropic"),
  u("https://docs.claude.com/en/api/messages-examples", "api", "anthropic"),
  u("https://docs.claude.com/en/api/streaming", "api", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/extended-thinking", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/tool-use/overview", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/prompt-caching", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/citations", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/vision", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/pdf-support", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/build-with-claude/embeddings", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/about-claude/models/overview", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/about-claude/pricing", "docs", "anthropic"),
  u("https://docs.claude.com/en/docs/agents-and-tools/agent-sdk/overview", "docs", "anthropic"),
  u("https://www.anthropic.com/engineering/claude-code-best-practices", "editorial", "anthropic-eng"),
  u("https://www.anthropic.com/engineering", "editorial", "anthropic-eng"),

  // ──────────────────────────────────────────────────────────
  // OpenAI — Platform / API / Codex CLI
  // ──────────────────────────────────────────────────────────
  u("https://platform.openai.com/docs/overview", "docs", "openai"),
  u("https://platform.openai.com/docs/quickstart", "docs", "openai"),
  u("https://platform.openai.com/docs/api-reference/responses", "api", "openai"),
  u("https://platform.openai.com/docs/api-reference/chat", "api", "openai"),
  u("https://platform.openai.com/docs/api-reference/embeddings", "api", "openai"),
  u("https://platform.openai.com/docs/api-reference/assistants", "api", "openai"),
  u("https://platform.openai.com/docs/guides/text-generation", "docs", "openai"),
  u("https://platform.openai.com/docs/guides/function-calling", "docs", "openai"),
  u("https://platform.openai.com/docs/guides/reasoning", "docs", "openai"),
  u("https://platform.openai.com/docs/guides/structured-outputs", "docs", "openai"),
  u("https://platform.openai.com/docs/guides/agents", "docs", "openai"),
  u("https://platform.openai.com/docs/guides/realtime", "docs", "openai"),
  u("https://platform.openai.com/docs/guides/prompt-caching", "docs", "openai"),
  u("https://platform.openai.com/docs/guides/embeddings", "docs", "openai"),
  u("https://platform.openai.com/docs/models", "docs", "openai"),
  u("https://platform.openai.com/docs/pricing", "docs", "openai"),
  u("https://openai.com/index/codex/", "editorial", "openai-codex"),

  // ──────────────────────────────────────────────────────────
  // Google — Gemini API / AI Studio
  // ──────────────────────────────────────────────────────────
  u("https://ai.google.dev/gemini-api/docs", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/quickstart", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/text-generation", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/function-calling", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/structured-output", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/thinking", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/embeddings", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/long-context", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/files", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/vision", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/document-processing", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/grounding", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/code-execution", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/safety-settings", "docs", "gemini"),
  u("https://ai.google.dev/gemini-api/docs/models", "docs", "gemini"),
  u("https://ai.google.dev/pricing", "docs", "gemini"),

  // ──────────────────────────────────────────────────────────
  // Vercel — Platform / AI SDK
  // ──────────────────────────────────────────────────────────
  u("https://vercel.com/docs", "docs", "vercel"),
  u("https://vercel.com/docs/projects/overview", "docs", "vercel"),
  u("https://vercel.com/docs/deployments/overview", "docs", "vercel"),
  u("https://vercel.com/docs/functions", "docs", "vercel"),
  u("https://vercel.com/docs/edge-network/overview", "docs", "vercel"),
  u("https://vercel.com/docs/cron-jobs", "docs", "vercel"),
  u("https://vercel.com/docs/storage/vercel-kv", "docs", "vercel"),
  u("https://vercel.com/docs/storage/vercel-postgres", "docs", "vercel"),
  u("https://vercel.com/docs/storage/vercel-blob", "docs", "vercel"),
  u("https://vercel.com/docs/environment-variables", "docs", "vercel"),
  u("https://vercel.com/docs/pricing", "docs", "vercel"),
  u("https://ai-sdk.dev/docs/introduction", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/foundations/overview", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-core/overview", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-core/generating-text", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-core/agents", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-core/embeddings", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-ui/overview", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-ui/chatbot", "docs", "vercel-ai-sdk"),
  u("https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data", "docs", "vercel-ai-sdk"),

  // ──────────────────────────────────────────────────────────
  // Railway
  // ──────────────────────────────────────────────────────────
  u("https://docs.railway.com/overview/about-railway", "docs", "railway"),
  u("https://docs.railway.com/quick-start", "docs", "railway"),
  u("https://docs.railway.com/guides/deploy", "docs", "railway"),
  u("https://docs.railway.com/guides/cli", "docs", "railway"),
  u("https://docs.railway.com/guides/variables", "docs", "railway"),
  u("https://docs.railway.com/guides/databases", "docs", "railway"),
  u("https://docs.railway.com/guides/cron-jobs", "docs", "railway"),
  u("https://docs.railway.com/reference/pricing", "docs", "railway"),
  u("https://docs.railway.com/reference/scaling", "docs", "railway"),

  // ──────────────────────────────────────────────────────────
  // Meta — Threads API
  // ──────────────────────────────────────────────────────────
  u("https://developers.facebook.com/docs/threads", "docs", "threads"),
  u("https://developers.facebook.com/docs/threads/overview", "docs", "threads"),
  u("https://developers.facebook.com/docs/threads/get-started", "docs", "threads"),
  u("https://developers.facebook.com/docs/threads/posts", "docs", "threads"),
  u("https://developers.facebook.com/docs/threads/threads-media", "docs", "threads"),
  u("https://developers.facebook.com/docs/threads/insights", "docs", "threads"),
  u("https://developers.facebook.com/docs/threads/reply-management", "docs", "threads"),

  // ──────────────────────────────────────────────────────────
  // X (Twitter) — Developer Platform
  // ──────────────────────────────────────────────────────────
  u("https://docs.x.com/x-api/introduction", "docs", "x-api"),
  u("https://docs.x.com/x-api/getting-started/about-x-api", "docs", "x-api"),
  u("https://docs.x.com/x-api/posts/quickstart", "docs", "x-api"),
  u("https://docs.x.com/x-api/posts/lookup", "docs", "x-api"),
  u("https://docs.x.com/x-api/posts/manage", "docs", "x-api"),
  u("https://docs.x.com/x-api/posts/search", "docs", "x-api"),
  u("https://docs.x.com/x-api/users/lookup", "docs", "x-api"),
  u("https://docs.x.com/x-api/rate-limits", "docs", "x-api"),

  // ──────────────────────────────────────────────────────────
  // AI coding agents (docs)
  // ──────────────────────────────────────────────────────────
  u("https://docs.cursor.com/en/welcome", "docs", "cursor"),
  u("https://docs.cursor.com/en/get-started/concepts", "docs", "cursor"),
  u("https://docs.cursor.com/en/agent/overview", "docs", "cursor"),
  u("https://docs.cursor.com/en/agent/rules", "docs", "cursor"),
  u("https://docs.cursor.com/en/agent/modes", "docs", "cursor"),
  u("https://docs.cursor.com/en/composer", "docs", "cursor"),
  u("https://www.cursor.com/changelog", "changelog", "cursor"),
  u("https://aider.chat/", "docs", "aider"),
  u("https://aider.chat/docs/usage.html", "docs", "aider"),
  u("https://aider.chat/docs/usage/modes.html", "docs", "aider"),
  u("https://aider.chat/docs/usage/commands.html", "docs", "aider"),
  u("https://aider.chat/docs/llms.html", "docs", "aider"),
  u("https://aider.chat/HISTORY.html", "changelog", "aider"),
  u("https://docs.windsurf.com/windsurf/getting-started", "docs", "windsurf"),
  u("https://docs.windsurf.com/windsurf/cascade", "docs", "windsurf"),
  u("https://docs.windsurf.com/windsurf/memories", "docs", "windsurf"),
  u("https://docs.windsurf.com/windsurf/changelog", "changelog", "windsurf"),
  u("https://docs.continue.dev/", "docs", "continue"),
  u("https://docs.continue.dev/customize/overview", "docs", "continue"),
  u("https://docs.cline.bot/getting-started/what-is-cline", "docs", "cline"),
  u("https://docs.cline.bot/exploring-clines-tools/plan-and-act-modes", "docs", "cline"),
  u("https://docs.cline.bot/features/checkpoints", "docs", "cline"),
  u("https://zed.dev/docs/ai/overview", "docs", "zed"),
  u("https://zed.dev/docs/ai/agent-panel", "docs", "zed"),
  u("https://zed.dev/releases/stable", "changelog", "zed"),

  // ──────────────────────────────────────────────────────────
  // Editorial / commentary
  // ──────────────────────────────────────────────────────────
  u("https://simonwillison.net/tags/ai-assisted-programming/", "editorial", "simonw"),
  u("https://simonwillison.net/tags/llms/", "editorial", "simonw"),
  u("https://simonwillison.net/tags/claude-code/", "editorial", "simonw"),
  u("https://simonwillison.net/tags/coding-agents/", "editorial", "simonw"),
  u("https://www.latent.space/", "editorial", "latent-space"),
  u("https://lilianweng.github.io/posts/2023-06-23-agent/", "editorial", "lilianweng"),
  u("https://lilianweng.github.io/posts/2024-07-07-hallucination/", "editorial", "lilianweng"),
  u("https://hamel.dev/", "editorial", "hamel"),

  // ──────────────────────────────────────────────────────────
  // Benchmarks / community
  // ──────────────────────────────────────────────────────────
  u("https://www.swebench.com/", "benchmark", "swe-bench"),
  u("https://artificialanalysis.ai/", "benchmark", "artificialanalysis"),
  u("https://lmarena.ai/", "benchmark", "lmarena"),
  u("https://hn.algolia.com/api/v1/search?query=Claude+Code&tags=story&hitsPerPage=20", "community", "hackernews"),
  u("https://hn.algolia.com/api/v1/search?query=AI+coding+agent&tags=story&hitsPerPage=20", "community", "hackernews"),
  u("https://hn.algolia.com/api/v1/search?query=Cursor+vs+Claude&tags=story&hitsPerPage=15", "community", "hackernews"),
  u("https://hn.algolia.com/api/v1/search?query=OpenAI+Codex+CLI&tags=story&hitsPerPage=15", "community", "hackernews"),
  u("https://hn.algolia.com/api/v1/search?query=Gemini+API&tags=story&hitsPerPage=15", "community", "hackernews"),

  // ──────────────────────────────────────────────────────────
  // Sitemap auto-expand (선택적으로 페이지 대량 인덱싱)
  // ──────────────────────────────────────────────────────────
  sm("https://ai-sdk.dev/sitemap.xml", "docs", "vercel-ai-sdk", { include: /\/docs\//, maxUrls: 40 }),
  sm("https://docs.railway.com/sitemap.xml", "docs", "railway", { include: /\/(guides|reference|overview)/, maxUrls: 30 }),
];
