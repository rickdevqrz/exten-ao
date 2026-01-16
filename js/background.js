const resultsByTab = new Map();
const resultsByUrl = new Map();
const lastAutoAnalyzeAt = new Map();
const lastAutoRefreshAt = new Map();
const refreshInFlight = new Set();
const refreshBackoffByUrl = new Map();
const AUTO_ANALYZE_MIN_INTERVAL_MS = 4000;
const CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_BACKOFF_MULTIPLIER = 4;
const AUTO_REFRESH_MINUTES_MIN = 1;
const AUTO_REFRESH_MINUTES_MAX = 60;
const AUTO_REFRESH_ALARM = "auto-refresh";
const SETTINGS_DEFAULTS = {
  extensionEnabled: true,
  pausedDomains: {},
  autoRefreshEnabled: true,
  autoRefreshIntervalMinutes: 5
};

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_DEFAULTS, (items) => resolve(items));
  });
}

function normalizeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch (err) {
    return String(url).split("#")[0];
  }
}

function isCacheFresh(stamped) {
  if (!stamped || !stamped.analyzedAt) return false;
  return Date.now() - stamped.analyzedAt < CACHE_TTL_MS;
}

function getCachedResultByUrl(url) {
  const key = normalizeUrl(url);
  if (!key) return null;
  const cached = resultsByUrl.get(key) || null;
  if (!cached) return null;
  if (!isCacheFresh(cached)) {
    resultsByUrl.delete(key);
    return null;
  }
  return cached;
}

function getSourceKeys(result) {
  const sources = Array.isArray(result && result.sources) ? result.sources : [];
  return sources.map((item) => item.url || item.domain || "").filter(Boolean);
}

function hasMeaningfulChange(prev, next) {
  if (!prev) return true;
  const prevSources = getSourceKeys(prev);
  const nextSources = getSourceKeys(next);
  if (prevSources.length !== nextSources.length) return true;
  const limit = Math.min(2, prevSources.length, nextSources.length);
  for (let i = 0; i < limit; i += 1) {
    if (prevSources[i] !== nextSources[i]) return true;
  }
  const prevScore = Number.isFinite(prev.score) ? prev.score : 0;
  const nextScore = Number.isFinite(next.score) ? next.score : 0;
  if (prevScore !== nextScore) return true;
  return false;
}

function updateRefreshBackoff(urlKey, prevResult, nextResult, intervalMs) {
  if (!urlKey || !intervalMs) return;
  if (hasMeaningfulChange(prevResult, nextResult)) {
    refreshBackoffByUrl.set(urlKey, { streak: 0, nextAllowedAt: 0 });
    return;
  }

  const previous = refreshBackoffByUrl.get(urlKey) || { streak: 0, nextAllowedAt: 0 };
  const nextStreak = previous.streak + 1;
  const multiplier = Math.min(MAX_BACKOFF_MULTIPLIER, nextStreak + 1);
  const backoffMs = intervalMs * multiplier;
  refreshBackoffByUrl.set(urlKey, {
    streak: nextStreak,
    nextAllowedAt: Date.now() + backoffMs
  });
}

async function canAnalyze(tabUrl, settingsOverride) {
  const settings = settingsOverride || (await getSettings());
  return settings.extensionEnabled !== false;
}

function clampRefreshMinutes(value) {
  if (!Number.isFinite(value)) return SETTINGS_DEFAULTS.autoRefreshIntervalMinutes;
  return Math.min(AUTO_REFRESH_MINUTES_MAX, Math.max(AUTO_REFRESH_MINUTES_MIN, value));
}

function getRefreshIntervalMs(settings) {
  const minutes = clampRefreshMinutes(Number(settings.autoRefreshIntervalMinutes));
  return minutes * 60 * 1000;
}

function storeResult(tabId, result, tabUrl) {
  const stamped = { ...result, analyzedAt: Date.now() };
  resultsByTab.set(tabId, stamped);
  const urlKey = normalizeUrl(result.url || tabUrl || "");
  if (urlKey) {
    resultsByUrl.set(urlKey, stamped);
  }
  updateBadge(tabId, stamped.score || 0);
  return stamped;
}

async function updateAutoRefreshAlarm() {
  const settings = await getSettings();
  if (!settings.autoRefreshEnabled) {
    chrome.alarms.clear(AUTO_REFRESH_ALARM);
    return;
  }

  const minutes = clampRefreshMinutes(Number(settings.autoRefreshIntervalMinutes));
  chrome.alarms.create(AUTO_REFRESH_ALARM, { periodInMinutes: minutes });
}

function clampScore(score) {
  const value = Number.isFinite(score) ? Math.round(score) : 0;
  return Math.max(0, Math.min(100, value));
}

function getLevel(score) {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

function getBadgeMeta(score) {
  const level = getLevel(score);
  if (level >= 4) return { color: "#c0392b", text: String(level) };
  if (level === 3) return { color: "#f1c40f", text: String(level) };
  return { color: "#2ecc71", text: String(level) };
}

function updateBadge(tabId, score) {
  const safeScore = clampScore(score);
  const meta = getBadgeMeta(safeScore);
  chrome.action.setBadgeText({ tabId, text: meta.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: meta.color });
}

function shouldAutoAnalyze(tabId) {
  const now = Date.now();
  const last = lastAutoAnalyzeAt.get(tabId) || 0;
  if (now - last < AUTO_ANALYZE_MIN_INTERVAL_MS) return false;
  lastAutoAnalyzeAt.set(tabId, now);
  return true;
}

async function autoAnalyzeTab(tabId, tabUrl) {
  if (!shouldAutoAnalyze(tabId)) return;
  const settings = await getSettings();
  if (!(await canAnalyze(tabUrl, settings))) return;
  const cached = getCachedResultByUrl(tabUrl);
  if (cached) {
    resultsByTab.set(tabId, cached);
    updateBadge(tabId, cached.score || 0);
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "ANALYZE" });
    if (response && response.result) {
      storeResult(tabId, response.result, tabUrl);
    }
  } catch (err) {
    // Aqui eu ignoro quando nao ha content script para evitar erro desnecessario.
  }
}

async function refreshActiveTab() {
  const settings = await getSettings();
  if (!settings.autoRefreshEnabled) return;

  const intervalMs = getRefreshIntervalMs(settings);
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab || typeof tab.id !== "number") return;
  const tabUrl = tab.url || "";
  if (tabUrl && !tabUrl.startsWith("http")) return;

  const tabId = tab.id;
  const lastRefresh = lastAutoRefreshAt.get(tabId) || 0;
  if (Date.now() - lastRefresh < intervalMs) return;
  if (refreshInFlight.has(tabId)) return;

  const cached = getCachedResultByUrl(tabUrl);
  if (cached && Date.now() - cached.analyzedAt < intervalMs) {
    resultsByTab.set(tabId, cached);
    updateBadge(tabId, cached.score || 0);
    return;
  }

  const urlKey = normalizeUrl(tabUrl);
  const backoff = urlKey ? refreshBackoffByUrl.get(urlKey) : null;
  if (backoff && Date.now() < backoff.nextAllowedAt) return;

  const domainKey = tabUrl || (resultsByTab.get(tabId) || {}).domain || "";
  if (!(await canAnalyze(domainKey, settings))) return;

  refreshInFlight.add(tabId);
  try {
    const previousResult = urlKey ? resultsByUrl.get(urlKey) : null;
    const response = await chrome.tabs.sendMessage(tabId, { type: "ANALYZE" });
    if (response && response.result) {
      storeResult(tabId, response.result, tabUrl);
      updateRefreshBackoff(urlKey, previousResult, response.result, intervalMs);
    }
  } catch (err) {
    // Aqui eu ignoro falhas de comunicacao para manter o ciclo de atualizacao leve.
  } finally {
    refreshInFlight.delete(tabId);
    lastAutoRefreshAt.set(tabId, Date.now());
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "SET_RESULT") {
    const tabId = message.tabId;
    const result = message.result;
    if (typeof tabId === "number" && result) {
      const senderUrl = sender && sender.tab ? sender.tab.url : "";
      storeResult(tabId, result, senderUrl);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "GET_LAST_RESULT") {
    const tabId = message.tabId;
    const result = resultsByTab.get(tabId) || null;
    sendResponse({ ok: true, result });
    return true;
  }

  if (message.type === "GET_RESULT_BY_URL") {
    const result = getCachedResultByUrl(message.url);
    sendResponse({ ok: true, result });
    return true;
  }

  if (message.type === "API_ANALYZE") {
    const payload = message.payload || {};
    const apiUrl = message.apiUrl;

    (async () => {
      if (!apiUrl) {
        sendResponse({ ok: false, error: "API_URL_INVALID" });
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          sendResponse({ ok: false, error: "API_HTTP_ERROR" });
          return;
        }

        const data = await response.json();
        if (!data || !data.mode) {
          sendResponse({ ok: false, error: "API_INVALID_RESPONSE" });
          return;
        }

        if (data.mode !== "verify" && data.mode !== "search_only" && data.mode !== "unified") {
          sendResponse({ ok: false, error: "API_FALLBACK" });
          return;
        }

        sendResponse({
          ok: true,
          result: {
            title: data.title || "",
            url: data.url || "",
            domain: data.domain || "",
            meta: data.meta || null,
            score: clampScore(data.score),
            reasons: Array.isArray(data.reasons) ? data.reasons : [],
            highlights: Array.isArray(data.highlights)
              ? data.highlights.map((term) => ({ type: "term", value: term }))
              : [],
            verdict: data.verdict || "incerta",
            final_verdict: data.final_verdict || "",
            confidence: Number.isFinite(data.confidence) ? data.confidence : 0.5,
            claims: Array.isArray(data.claims) ? data.claims : [],
            sources: Array.isArray(data.sources) ? data.sources : [],
            mode: data.mode,
            debug: data.debug || {}
          }
        });
      } catch (err) {
        const isAbort = err && err.name === "AbortError";
        sendResponse({ ok: false, error: isAbort ? "API_TIMEOUT" : "API_FETCH_FAILED" });
      }
    })();

    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  updateAutoRefreshAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  updateAutoRefreshAlarm();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.autoRefreshEnabled || changes.autoRefreshIntervalMinutes) {
    updateAutoRefreshAlarm();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_REFRESH_ALARM) {
    refreshActiveTab();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  resultsByTab.delete(tabId);
  lastAutoAnalyzeAt.delete(tabId);
  lastAutoRefreshAt.delete(tabId);
  refreshInFlight.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    autoAnalyzeTab(tabId, tab && tab.url ? tab.url : "");
  }
});

updateAutoRefreshAlarm();
