const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 StackSageBot/1.0";

export type SitemapUrl = { loc: string; lastmod?: number };

/**
 * sitemap.xml 또는 sitemap index 를 따라가서 leaf URL 목록을 반환.
 *
 * Why: AI/Cloud 회사 docs 는 수십~수백 페이지라 일일이 박는 게 비효율.
 *       공식 sitemap 을 한 번 fetch 하면 전체 트리를 자동 발견 가능.
 *
 * 제한: sitemap index 1단계까지만 재귀. 너무 깊은 시드는 손으로 박는다.
 */
export async function fetchSitemap(url: string, timeoutMs = 20_000): Promise<SitemapUrl[]> {
  const xml = await rawFetch(url, timeoutMs);
  if (xml.includes("<sitemapindex")) {
    const childUrls = extractTags(xml, "loc");
    const results = await Promise.all(
      childUrls.slice(0, 6).map(async (child) => {
        try {
          return await fetchSitemap(child, timeoutMs);
        } catch {
          return [];
        }
      }),
    );
    return results.flat();
  }
  return extractUrlEntries(xml);
}

async function rawFetch(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/xml,text/xml,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function extractTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

function extractUrlEntries(xml: string): SitemapUrl[] {
  const entries: SitemapUrl[] = [];
  const blocks = xml.split(/<\/url>/i);
  for (const block of blocks) {
    const locMatch = block.match(/<loc>([\s\S]*?)<\/loc>/i);
    if (!locMatch) continue;
    const lastmodMatch = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
    const loc = locMatch[1].trim();
    if (!loc) continue;
    const lastmod = lastmodMatch ? Date.parse(lastmodMatch[1].trim()) : undefined;
    entries.push({
      loc,
      lastmod: lastmod && !Number.isNaN(lastmod) ? lastmod : undefined,
    });
  }
  return entries;
}
