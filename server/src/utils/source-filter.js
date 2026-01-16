const BLOCKED_EXTENSIONS = new Set([
  "pdf",
  "xml",
  "rss",
  "atom",
  "json",
  "txt",
  "csv",
  "zip",
  "rar",
  "7z",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "mp3",
  "mp4",
  "avi",
  "mov",
  "wmv",
  "m4a",
  "wav",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "svg",
  "webp",
  "css",
  "js",
  "map"
]);

function normalizeDomain(input) {
  try {
    const domain = new URL(input).hostname || "";
    return domain.replace(/^www\./i, "").toLowerCase();
  } catch (err) {
    return String(input || "").replace(/^www\./i, "").toLowerCase();
  }
}

function hasBlockedExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{1,5})$/);
    if (!match) return false;
    return BLOCKED_EXTENSIONS.has(match[1]);
  } catch (err) {
    return false;
  }
}

function hasBlockedQuery(url) {
  const lower = String(url || "").toLowerCase();
  return lower.includes("format=pdf") || lower.includes("output=pdf");
}

function isAllowlistedDomain(domain, allowlist) {
  if (!domain) return false;
  const list = Array.isArray(allowlist) ? allowlist : [];
  return list.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

export function isLikelyNewsUrl(url, allowlist) {
  if (!url) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (hasBlockedExtension(url)) return false;
  if (hasBlockedQuery(url)) return false;

  const domain = normalizeDomain(parsed.hostname);
  return isAllowlistedDomain(domain, allowlist);
}

export function normalizeSourceDomain(value) {
  return normalizeDomain(value);
}
