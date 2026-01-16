import * as cheerio from "cheerio";
import { config } from "../config.js";
import { isSafeUrl } from "../utils/safe-url.js";

function timeoutPromise(ms, controller) {
  return new Promise((_, reject) =>
    setTimeout(() => {
      if (controller) controller.abort();
      reject(new Error("timeout"));
    }, ms)
  );
}

function extractText($) {
  const candidates = [
    "article",
    "main",
    "#content",
    ".content",
    ".post",
    ".entry-content"
  ];

  let bestText = "";
  for (const selector of candidates) {
    const text = $(selector).text().replace(/\s+/g, " ").trim();
    if (text.length > bestText.length) {
      bestText = text;
    }
  }

  if (!bestText) {
    bestText = $("body").text().replace(/\s+/g, " ").trim();
  }

  return bestText.slice(0, config.maxTextChars);
}

function getMetaContent($, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    const el = $(`meta[name="${key}"], meta[property="${key}"], meta[itemprop="${key}"]`).first();
    const content = el.attr("content");
    if (content) return content.trim();
  }
  return "";
}

function extractTitle($) {
  const title =
    getMetaContent($, ["og:title", "twitter:title"]) ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim();
  return title;
}

function countOutboundLinks($, baseUrl) {
  let count = 0;
  let baseHost = "";
  try {
    baseHost = new URL(baseUrl).hostname;
  } catch (err) {
    baseHost = "";
  }

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#")) return;
    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.hostname && baseHost && linkUrl.hostname !== baseHost) {
        count += 1;
      }
    } catch (err) {
      // Aqui eu ignoro links malformados para nao quebrar a contagem.
    }
  });
  return count;
}

function extractMeta($, baseUrl, text) {
  let publishedAt =
    getMetaContent($, [
      "article:published_time",
      "article:published",
      "pubdate",
      "date",
      "parsely-pub-date"
    ]) || "";

  if (!publishedAt) {
    const timeEl = $("time[datetime]").first();
    if (timeEl && timeEl.attr("datetime")) {
      publishedAt = String(timeEl.attr("datetime")).trim();
    }
  }

  const author =
    getMetaContent($, ["article:author", "author", "parsely-author", "byl", "dc.creator"]) || "";
  const section = getMetaContent($, ["article:section", "section", "parsely-section"]) || "";
  const siteName = getMetaContent($, ["og:site_name", "application-name", "twitter:site"]) || "";
  let canonical = $("link[rel=\"canonical\"]").attr("href") || getMetaContent($, ["og:url"]);
  if (canonical) {
    try {
      canonical = new URL(canonical, baseUrl).href;
    } catch (err) {
      canonical = canonical.trim();
    }
  }
  const keywords = getMetaContent($, ["news_keywords", "keywords"]) || "";

  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const readingMinutes = wordCount ? Math.max(1, Math.round(wordCount / 200)) : 0;
  const outboundLinks = countOutboundLinks($, baseUrl);

  return {
    author,
    publishedAt,
    section,
    siteName,
    canonical: canonical || "",
    keywords,
    wordCount,
    readingMinutes,
    outboundLinks
  };
}

export async function fetchArticle(url) {
  if (!url) return null;
  if (!(await isSafeUrl(url))) return null;
  try {
    const controller = new AbortController();
    const fetchPromise = fetch(url, {
      headers: {
        "User-Agent": "DetectorFakeNewsBot/1.0",
        "Accept-Language": "pt-BR,pt;q=0.9"
      },
      signal: controller.signal
    });

    const response = await Promise.race([
      fetchPromise,
      timeoutPromise(config.fetchTimeoutMs, controller)
    ]);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const finalUrl = response.url || url;
    let domain = "";
    try {
      domain = new URL(finalUrl).hostname;
    } catch (err) {
      domain = "";
    }

    const text = extractText($);
    const title = extractTitle($);
    const meta = extractMeta($, finalUrl, text);

    return {
      url: finalUrl,
      domain,
      title,
      text,
      meta
    };
  } catch (err) {
    return null;
  }
}
