import * as cheerio from "cheerio";
import { config } from "../config.js";

const RSS_BASE_URL = "https://news.google.com/rss/search";
const RSS_PARAMS = "hl=pt-BR&gl=BR&ceid=BR:pt-419";

function normalizeDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch (err) {
    return "";
  }
}

function isAllowlisted(domain) {
  if (!domain) return false;
  return config.allowlist.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

function buildRssUrl(query) {
  return `${RSS_BASE_URL}?q=${encodeURIComponent(query)}&${RSS_PARAMS}`;
}

async function fetchRss(query) {
  const url = buildRssUrl(query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DetectorFakeNewsBot/1.0",
        "Accept-Language": "pt-BR,pt;q=0.9"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) return { ok: false, items: [] };
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = [];

    const nodes = $("item").toArray();
    for (const node of nodes) {
      const link = $(node).find("link").first().text().trim();
      const title = $(node).find("title").first().text().trim();
      const sourceEl = $(node).find("source").first();
      const sourceUrl = (sourceEl.attr("url") || "").trim();
      const sourceName = sourceEl.text().trim();
      const publishedAt = $(node).find("pubDate").first().text().trim();
      const domain = normalizeDomain(sourceUrl || link);

      if (!domain || !isAllowlisted(domain)) continue;
      items.push({
        claim: query,
        url: link || sourceUrl,
        title,
        domain,
        source: sourceName,
        publishedAt
      });

      if (items.length >= config.maxResults) break;
    }

    return { ok: true, items };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, items: [] };
  }
}

export async function searchNewsRss(queries) {
  const results = [];
  const seen = new Set();
  let attempted = false;
  let ok = false;

  for (const query of queries || []) {
    const clean = String(query || "").trim();
    if (!clean) continue;
    attempted = true;
    const response = await fetchRss(clean);
    if (response.ok) ok = true;
    const items = response.items || [];
    for (const item of items) {
      const key = item.url || item.domain;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      results.push(item);
      if (results.length >= config.maxResults) break;
    }
    if (results.length >= config.maxResults) break;
  }

  let sorted = results;
  if (results.some((item) => item.publishedAt)) {
    sorted = results.slice().sort((a, b) => {
      const aTime = Date.parse(a.publishedAt || "") || 0;
      const bTime = Date.parse(b.publishedAt || "") || 0;
      return bTime - aTime;
    });
  }

  return { ok: attempted && ok, results: sorted, attempted };
}
