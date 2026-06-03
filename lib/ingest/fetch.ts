import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 StackSageBot/1.0";

export type FetchedDoc = {
  url: string;
  title: string;
  markdown: string;
  lastModified?: number;
};

export async function fetchAndExtract(url: string, timeoutMs = 20_000): Promise<FetchedDoc> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en;q=0.9,ko;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "";
    const lastModRaw = res.headers.get("last-modified");
    const lastModified = lastModRaw ? Date.parse(lastModRaw) : undefined;

    if (contentType.includes("application/json")) {
      const json = await res.json();
      const doc = jsonToDoc(url, json);
      if (lastModified && !Number.isNaN(lastModified)) doc.lastModified = lastModified;
      return doc;
    }

    const html = await res.text();
    const doc = htmlToDoc(url, html);
    if (lastModified && !Number.isNaN(lastModified)) doc.lastModified = lastModified;
    return doc;
  } finally {
    clearTimeout(timer);
  }
}

function htmlToDoc(url: string, html: string): FetchedDoc {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("error", () => {});
  virtualConsole.on("warn", () => {});
  virtualConsole.on("jsdomError", () => {});

  const dom = new JSDOM(html, { url, virtualConsole });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const title = article?.title || dom.window.document.title || url;
  const contentHtml = article?.content || dom.window.document.body?.innerHTML || "";
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  td.remove(["script", "style", "nav", "footer", "aside"]);
  let markdown = td.turndown(contentHtml).trim();
  markdown = collapseWhitespace(markdown);
  return { url, title, markdown };
}

type RedditChild = { data?: { title?: string; selftext?: string; permalink?: string; ups?: number; num_comments?: number; subreddit?: string } };
type RedditListing = { data?: { children?: RedditChild[] } };
type HNHit = { title?: string; story_text?: string; url?: string; points?: number; num_comments?: number; objectID?: string; created_at?: string };

function jsonToDoc(url: string, json: unknown): FetchedDoc {
  if (isRedditListing(json)) {
    const children = json.data?.children ?? [];
    const lines: string[] = [];
    for (const c of children) {
      const d = c.data;
      if (!d) continue;
      const body = (d.selftext ?? "").trim();
      if (!body || body.length < 40) continue;
      const head = `## ${d.title ?? "(no title)"} — r/${d.subreddit ?? ""} (↑${d.ups ?? 0}, ${d.num_comments ?? 0} comments)`;
      const link = d.permalink ? `https://www.reddit.com${d.permalink}` : "";
      lines.push(`${head}\n${link}\n\n${body}`);
    }
    return {
      url,
      title: `Reddit community digest (${children.length} posts)`,
      markdown: lines.join("\n\n---\n\n"),
    };
  }
  if (isHnSearch(json)) {
    const hits = json.hits ?? [];
    const lines: string[] = [];
    for (const h of hits) {
      const body = (h.story_text ?? "").trim();
      const meta = `↑${h.points ?? 0}, ${h.num_comments ?? 0} comments, ${h.created_at ?? ""}`;
      const link = h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : (h.url ?? "");
      const head = `## ${h.title ?? "(no title)"} (${meta})`;
      const block = [head, link, body].filter(Boolean).join("\n");
      if (block.length > 60) lines.push(block);
    }
    return {
      url,
      title: `Hacker News search digest (${hits.length} stories)`,
      markdown: lines.join("\n\n---\n\n"),
    };
  }
  return { url, title: url, markdown: JSON.stringify(json).slice(0, 50_000) };
}

function isRedditListing(v: unknown): v is RedditListing {
  return typeof v === "object" && v !== null && (v as RedditListing).data?.children !== undefined;
}
function isHnSearch(v: unknown): v is { hits: HNHit[] } {
  return typeof v === "object" && v !== null && Array.isArray((v as { hits?: unknown }).hits);
}

function collapseWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
