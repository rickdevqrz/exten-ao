import { config } from "../config.js";

function buildQuery(claim) {
  const domains = config.allowlist.map((domain) => `site:${domain}`);
  return `${claim} (${domains.join(" OR ")})`;
}

export async function searchEvidence(claims) {
  if (!config.serperApiKey) {
    return { ok: false, error: "SERPER_KEY_MISSING", results: [] };
  }

  const headers = {
    "Content-Type": "application/json",
    "X-API-KEY": config.serperApiKey
  };

  const allResults = [];

  for (const claim of claims) {
    const body = {
      q: buildQuery(claim),
      num: config.maxResults
    };

    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const organic = Array.isArray(data.organic) ? data.organic : [];
      organic.forEach((item) => {
        if (item.link) {
          allResults.push({
            claim,
            url: item.link,
            title: item.title || "",
            snippet: item.snippet || "",
            publishedAt: item.date || ""
          });
        }
      });
    } catch (err) {
      // Aqui eu ignoro uma falha individual para manter a busca ativa.
    }
  }

  const unique = new Map();
  allResults.forEach((item) => {
    if (!unique.has(item.url)) {
      unique.set(item.url, item);
    }
  });

  return { ok: true, results: Array.from(unique.values()).slice(0, config.maxResults) };
}
