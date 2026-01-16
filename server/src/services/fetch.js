import * as cheerio from "cheerio";
import { config } from "../config.js";
import { isSafeUrl } from "../utils/safe-url.js";
import { isLikelyNewsUrl } from "../utils/source-filter.js";

function timeoutPromise(ms, controller) {
  return new Promise((_, reject) =>
    setTimeout(() => {
      if (controller) controller.abort();
      reject(new Error("timeout"));
    }, ms)
  );
}

function extractText(html) {
  const $ = cheerio.load(html);
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

async function fetchOne(item) {
  try {
    if (!item || !isLikelyNewsUrl(item.url, config.allowlist)) {
      return null;
    }
    if (!(await isSafeUrl(item.url))) {
      return null;
    }
    const controller = new AbortController();
    const fetchPromise = fetch(item.url, {
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

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return null;
    }

    const html = await response.text();
    const text = extractText(html);
    const snippet = text.slice(0, 400);
    const finalUrl = response.url || item.url;
    let domain = "";
    try {
      domain = new URL(finalUrl).hostname;
    } catch (err) {
      domain = "";
    }
    return {
      claim: item.claim,
      url: finalUrl,
      domain,
      title: item.title || "",
      snippet
    };
  } catch (err) {
    return null;
  }
}

export async function fetchEvidencePages(results) {
  const items = Array.isArray(results) ? results.slice(0, config.maxResults) : [];
  if (items.length === 0) return [];

  const settled = await Promise.allSettled(items.map((item) => fetchOne(item)));
  const evidence = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled" && outcome.value) {
      evidence.push(outcome.value);
    }
  }

  return evidence.slice(0, config.maxSources);
}
