const domainEl = document.getElementById("domain");
const titleEl = document.getElementById("title");
const detailSiteEl = document.getElementById("detail-site");
const detailPublishedEl = document.getElementById("detail-published");
const detailAuthorEl = document.getElementById("detail-author");
const detailSectionEl = document.getElementById("detail-section");
const detailReadingEl = document.getElementById("detail-reading");
const detailLinksEl = document.getElementById("detail-links");
const openDetailsBtn = document.getElementById("open-details");
const detailsModalEl = document.getElementById("details-modal");
const closeDetailsModalBtn = document.getElementById("close-details-modal");
const scoreEl = document.getElementById("score-value");
const scoreBarEl = document.getElementById("score-bar");
const scoreLabelEl = document.getElementById("score-label");
const levelPillEl = document.getElementById("level-pill");
const levelTopLabelEl = document.getElementById("level-top-label");
const trustPillEl = document.getElementById("trust-pill");
const scaleTextEl = document.getElementById("scale-text");
const verdictEl = document.getElementById("verdict-text");
const confidenceEl = document.getElementById("confidence-text");
const levelReportEl = document.getElementById("level-report");
const sourcesListEl = document.getElementById("sources-list");
const emptySourcesEl = document.getElementById("empty-sources");
const moreSourcesBtn = document.getElementById("more-sources");
const sourcesLabelEl = document.getElementById("sources-label");
const sourcesModalEl = document.getElementById("sources-modal");
const modalSourcesListEl = document.getElementById("modal-sources-list");
const modalEmptySourcesEl = document.getElementById("modal-empty-sources");
const closeSourcesModalBtn = document.getElementById("close-sources-modal");
const modalSourcesTitleEl = document.getElementById("modal-sources-title");
const reasonsListEl = document.getElementById("reasons-list");
const emptyReasonsEl = document.getElementById("empty-reasons");
const analyzeBtn = document.getElementById("analyze");
const shareToggleBtn = document.getElementById("share-toggle");
const sharePanelEl = document.getElementById("share-panel");
const toggleEnabledBtn = document.getElementById("toggle-enabled");
const reloadBtn = document.getElementById("reload");
const settingsBtn = document.getElementById("open-settings");
const statusEl = document.getElementById("status");
const statusSerperEl = document.getElementById("status-serper");
const statusHeuristicEl = document.getElementById("status-heuristic");
const scaleStepEls = document.querySelectorAll(".scale-steps span");
const topicInput = document.getElementById("topic-input");
const topicSearchBtn = document.getElementById("topic-search");

let currentTabId = null;
let currentDomain = "";
let currentUrl = "";
let lastResult = null;
let sharePayload = { title: "", url: "" };

const MAX_VISIBLE_SOURCES = 3;
const MAX_MODAL_SOURCES = 2;
const MAX_TOTAL_SOURCES = 5;
const MAX_VISIBLE_REASONS = 2;
const SETTINGS_DEFAULTS = {
  extensionEnabled: true,
  pausedDomains: {},
  theme: "tech",
  autoRefreshEnabled: true,
  autoRefreshIntervalMinutes: 5,
  useApi: false,
  apiUrl: "https://veredicto.up.railway.app/api/analisar",
  apiToken: ""
};

function setStatus(message) {
  statusEl.textContent = message || "";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme || SETTINGS_DEFAULTS.theme;
}

function normalizeDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch (err) {
    return "";
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (err) {
    return false;
  }
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_DEFAULTS, (items) => resolve(items));
  });
}

function applyControlState(settings) {
  const enabled = settings.extensionEnabled !== false;
  const canSearch = Boolean(settings.useApi && settings.apiUrl);

  if (toggleEnabledBtn) {
    toggleEnabledBtn.dataset.active = enabled ? "true" : "false";
    toggleEnabledBtn.dataset.state = enabled ? "on" : "off";
    toggleEnabledBtn.setAttribute("aria-pressed", String(enabled));
  }

  const blocked = !enabled;
  analyzeBtn.disabled = blocked;
  if (reloadBtn) {
    reloadBtn.disabled = blocked;
  }
  if (topicSearchBtn) {
    topicSearchBtn.disabled = !enabled || !canSearch;
  }
  if (topicInput) {
    topicInput.disabled = !enabled || !canSearch;
  }
  if (shareToggleBtn) {
    const shareEnabled = shareToggleBtn.dataset.state === "on";
    shareToggleBtn.disabled = blocked || !shareEnabled;
    if (blocked) {
      closeSharePanel();
    }
  }
}

function updateStatusFromSettings(settings) {
  if (!settings.extensionEnabled) {
    setStatus("Desligado.");
    return;
  }

  setStatus("Pronto.");
}

function getScoreLabel(score) {
  if (score >= 67) return "Alto";
  if (score >= 34) return "Moderado";
  return "Baixo";
}

function formatVerdict(text) {
  const clean = (text || "").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function trimText(text, maxLength = 110) {
  const clean = (text || "").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 3))}...`;
}

function parseDateValue(value) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 0;
  return timestamp;
}

function formatRelativeTime(value) {
  const timestamp = parseDateValue(value);
  if (!timestamp) return "";
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 0) return "";

  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `ha ${days}d`;
  return "";
}

function formatReading(meta) {
  const minutes = Number(meta && meta.readingMinutes) || 0;
  const words = Number(meta && meta.wordCount) || 0;
  if (minutes && words) return `${minutes} min, ${words} palavras`;
  if (minutes) return `${minutes} min`;
  if (words) return `${words} palavras`;
  return "-";
}

function renderMeta(result) {
  const meta = (result && result.meta) || {};
  const isQuery = result && result.context === "query";
  const hasDetails = Boolean(
    meta &&
      (meta.author ||
        meta.publishedAt ||
        meta.section ||
        meta.siteName ||
        meta.readingMinutes ||
        meta.outboundLinks)
  );

  if (openDetailsBtn) {
    openDetailsBtn.style.display = !isQuery && hasDetails ? "inline-flex" : "none";
  }
  if ((isQuery || !hasDetails) && detailsModalEl) {
    closeDetailsModal();
  }

  if (isQuery) {
    if (detailSiteEl) detailSiteEl.textContent = "-";
    if (detailPublishedEl) detailPublishedEl.textContent = "-";
    if (detailAuthorEl) detailAuthorEl.textContent = "-";
    if (detailSectionEl) detailSectionEl.textContent = "-";
    if (detailReadingEl) detailReadingEl.textContent = "-";
    if (detailLinksEl) detailLinksEl.textContent = "-";
    return;
  }
  const site = meta.siteName || result.domain || "-";
  if (detailSiteEl) detailSiteEl.textContent = site || "-";
  if (detailPublishedEl) detailPublishedEl.textContent = formatDate(meta.publishedAt);
  if (detailAuthorEl) detailAuthorEl.textContent = meta.author || "-";
  if (detailSectionEl) detailSectionEl.textContent = meta.section || "-";
  if (detailReadingEl) detailReadingEl.textContent = formatReading(meta);
  if (detailLinksEl) {
    detailLinksEl.textContent = Number.isFinite(meta.outboundLinks)
      ? `${meta.outboundLinks} links`
      : "-";
  }
}

function buildVerdictReason(levelMeta, result) {
  const sourcesCount = Array.isArray(result.sources) ? result.sources.length : 0;
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];

  if (sourcesCount >= 3) {
    return `${sourcesCount} fontes confirmam.`;
  }
  if (sourcesCount === 2) {
    return "2 fontes confirmam.";
  }
  if (sourcesCount === 1) {
    return "1 fonte confirma.";
  }

  if (reasons.length) {
    return trimText(reasons[0]);
  }

  return "Baseado no texto analisado.";
}

function formatEngineError(error) {
  if (!error) return "";
  const key = String(error).split(":")[0];
  const map = {
    API_URL_INVALID: "url",
    API_TIMEOUT: "timeout",
    API_FETCH_FAILED: "offline",
    API_HTTP_ERROR: "http",
    API_INVALID_RESPONSE: "resp",
    API_FALLBACK: "fallback",
    API_FAILED: "falha"
  };
  return map[key] || key.toLowerCase();
}

function getSearchProviderLabel(debug) {
  const provider = String((debug && debug.search_provider) || "").toLowerCase();
  if (provider === "rss") return "rss";
  if (provider === "serper") return "serper";
  return "";
}

function setVerdictText(verdictText, reasonText, options = {}) {
  verdictEl.innerHTML = "";
  const strong = document.createElement("span");
  strong.className = "verdict-strong";
  strong.textContent = verdictText || "Sem veredito";
  verdictEl.appendChild(strong);

  if (reasonText) {
    const reason = document.createElement("span");
    reason.className = "verdict-reason";
    reason.textContent = options.prefix ? `Motivo: ${reasonText}` : reasonText;
    verdictEl.appendChild(reason);
  }
}

function setStatusChip(el, text, state) {
  if (!el) return;
  el.textContent = text;
  el.className = `status-chip ${state || "neutral"}`;
}

function updateEngineStatus(result) {
  const debug = (result && result.debug) || {};
  if (result && result.source === "heuristica") {
    const apiEnabled = debug.api_enabled !== false;
    const apiError = debug.api_error;
    const apiErrorTag = apiError ? ` (${formatEngineError(apiError)})` : "";

    if (!apiEnabled && !apiError) {
      setStatusChip(statusSerperEl, "Busca: off", "off");
    } else if (apiError || debug.api_attempted) {
      setStatusChip(statusSerperEl, `Busca: falha${apiErrorTag}`, "fail");
    } else {
      setStatusChip(statusSerperEl, "Busca: aguardando", "warn");
    }

    setStatusChip(statusHeuristicEl, "Heuristica: ok", "ok");
    return;
  }

  const searchEnabled = debug.search_enabled !== false;
  const providerLabel = getSearchProviderLabel(debug);
  const providerTag = providerLabel ? ` (${providerLabel})` : "";
  if (!searchEnabled) {
    setStatusChip(statusSerperEl, "Busca: off", "off");
  } else if (debug.search_ok === false) {
    setStatusChip(statusSerperEl, `Busca: falha${providerTag}`, "fail");
  } else if (debug.search_used) {
    setStatusChip(statusSerperEl, `Busca: ok${providerTag}`, "ok");
  } else {
    setStatusChip(statusSerperEl, "Busca: aguardando", "warn");
  }

  const heuristicUsed = debug.heuristic_used !== false;
  setStatusChip(
    statusHeuristicEl,
    heuristicUsed ? "Heuristica: ok" : "Heuristica: off",
    heuristicUsed ? "ok" : "off"
  );
}

function getLevelMeta(score) {
  if (score >= 80) {
    return { level: 5, label: "Alto risco de desinformacao", className: "pill danger" };
  }
  if (score >= 60) {
    return { level: 4, label: "Verificacao recomendada", className: "pill warn" };
  }
  if (score >= 40) {
    return { level: 3, label: "Indicios mistos", className: "pill caution" };
  }
  if (score >= 20) {
    return { level: 2, label: "Provavelmente verdadeira", className: "pill good" };
  }
  return { level: 1, label: "Confirmada", className: "pill good" };
}

function getToneClass(levelMeta) {
  if (!levelMeta || !levelMeta.className) return "good";
  if (levelMeta.className.includes("danger")) return "danger";
  if (levelMeta.className.includes("warn")) return "warn";
  if (levelMeta.className.includes("caution")) return "caution";
  return "good";
}

function updateScaleSteps(level, toneClass) {
  scaleStepEls.forEach((el) => {
    el.classList.remove("active", "good", "warn", "danger", "caution");
    if (Number(el.dataset.level) === level) {
      el.classList.add("active", toneClass);
    }
  });
}

function clearScaleSteps() {
  scaleStepEls.forEach((el) => {
    el.classList.remove("active", "good", "warn", "danger", "caution");
  });
}

function buildLevelReport(levelMeta, sourcesCount, reasons) {
  const base = `Nivel ${levelMeta.level}/5 - ${levelMeta.label}.`;
  const sourcesPart = sourcesCount > 0 ? `Fontes: ${sourcesCount}.` : "";
  return [base, sourcesPart].filter(Boolean).join(" ");
}

function renderResult(result) {
  lastResult = result;
  const isQuery = result && result.context === "query";
  document.body.dataset.view = isQuery ? "query" : "default";
  domainEl.textContent = isQuery ? "Pesquisa" : result.domain || "-";
  titleEl.textContent = result.title || "-";
  renderMeta(result);
  if (sourcesLabelEl) {
    sourcesLabelEl.textContent = isQuery ? "Noticias" : "Fontes";
  }
  if (modalSourcesTitleEl) {
    modalSourcesTitleEl.textContent = isQuery ? "Mais noticias" : "Outras fontes";
  }
  if (!isQuery && result.domain) {
    currentDomain = result.domain.replace(/^www\./i, "");
    getSettings().then((settings) => {
      applyControlState(settings);
      updateStatusFromSettings(settings);
    });
  } else if (isQuery) {
    currentDomain = "";
    getSettings().then((settings) => {
      applyControlState(settings);
    });
  }

  if (isQuery) {
    if (emptySourcesEl) {
      emptySourcesEl.textContent = "Sem noticias.";
    }
    if (modalEmptySourcesEl) {
      modalEmptySourcesEl.textContent = "Sem noticias.";
    }
    scoreEl.textContent = "-";
    scoreBarEl.style.width = "0%";
    scoreLabelEl.textContent = "Pesquisa";
    levelPillEl.textContent = "Pesquisa";
    if (levelTopLabelEl) {
      levelTopLabelEl.textContent = "Noticias recentes";
    }
    trustPillEl.textContent = "Pesquisa";
    trustPillEl.className = "pill neutral";
    scaleTextEl.textContent = "Resultados da pesquisa";
    clearScaleSteps();

    const verdictText = formatVerdict(result.verdict || "Noticias recentes");
    const reasonText =
      trimText((result.reasons && result.reasons[0]) || "") || "Selecione uma fonte.";
    setVerdictText(verdictText, reasonText, { prefix: false });
    confidenceEl.textContent = "-";
    levelReportEl.textContent = "Noticias recentes.";
    updateShareState(result, null);
  } else {
    if (emptySourcesEl) {
      emptySourcesEl.textContent = "Sem fontes.";
    }
    if (modalEmptySourcesEl) {
      modalEmptySourcesEl.textContent = "Sem fontes.";
    }
    const score = Number.isFinite(result.score) ? result.score : 0;
    const levelMeta = getLevelMeta(score);
    scoreEl.textContent = score;
    scoreBarEl.style.width = `${levelMeta.level * 20}%`;
    scoreLabelEl.textContent = getScoreLabel(score);
    levelPillEl.textContent = `Nivel ${levelMeta.level}/5`;
    if (levelTopLabelEl) {
      const bannerText = formatVerdict(result.verdict || levelMeta.label);
      levelTopLabelEl.textContent = trimText(bannerText, 32);
    }
    trustPillEl.textContent = levelMeta.label;
    trustPillEl.className = levelMeta.className;
    scaleTextEl.textContent = `Nivel ${levelMeta.level} de 5: ${levelMeta.label}`;
    updateScaleSteps(levelMeta.level, getToneClass(levelMeta));

    const levelReportText = buildLevelReport(
      levelMeta,
      Array.isArray(result.sources) ? result.sources.length : 0,
      result.reasons || []
    );

    const verdictText = formatVerdict(result.verdict || levelMeta.label || "Sem veredito");
    const reasonText = buildVerdictReason(levelMeta, result);
    setVerdictText(verdictText, reasonText, { prefix: true });

    if (Number.isFinite(result.confidence)) {
      confidenceEl.textContent = `${Math.round(result.confidence * 100)}%`;
    } else {
      confidenceEl.textContent = "-";
    }

    levelReportEl.textContent = levelReportText;
    updateShareState(result, levelMeta);
  }

  reasonsListEl.innerHTML = "";
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const visibleReasons = reasons.slice(0, MAX_VISIBLE_REASONS);
  if (visibleReasons.length > 0) {
    emptyReasonsEl.style.display = "none";
    visibleReasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = trimText(reason, 120);
      reasonsListEl.appendChild(li);
    });
  } else {
    emptyReasonsEl.textContent = "Sem motivos.";
    emptyReasonsEl.style.display = "block";
  }

  renderSources(result.sources || []);
  updateEngineStatus(result);
}

function closeSharePanel() {
  if (!sharePanelEl) return;
  sharePanelEl.classList.remove("open");
  sharePanelEl.setAttribute("aria-hidden", "true");
}

function toggleSharePanel() {
  if (!sharePanelEl) return;
  const isOpen = sharePanelEl.classList.toggle("open");
  sharePanelEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function buildShareText(title, url) {
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) return url;
  return `${cleanTitle} - ${url}`;
}

function updateShareState(result, levelMeta) {
  if (!shareToggleBtn || !sharePanelEl) return;
  const isQuery = result && result.context === "query";
  const url = (result && result.url) || currentUrl || "";
  const title = (result && result.title) || "";
  const levelOk = levelMeta ? levelMeta.level <= 3 : false;
  const allowed = Boolean(result && !isQuery && levelOk && isHttpUrl(url));

  sharePayload = { title, url };
  shareToggleBtn.disabled = !allowed;
  shareToggleBtn.dataset.state = allowed ? "on" : "off";
  if (!allowed) {
    closeSharePanel();
  }
}

async function handleShare(target) {
  if (!shareToggleBtn || shareToggleBtn.disabled) {
    setStatus("Compartilhamento indisponivel.");
    return;
  }

  const url = sharePayload.url || "";
  if (!isHttpUrl(url)) {
    setStatus("URL invalida para compartilhar.");
    return;
  }

  const title = sharePayload.title || "Noticia";
  const shareText = buildShareText(title, url);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(shareText);
  let shareUrl = "";

  if (target === "whatsapp") {
    shareUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  } else if (target === "telegram") {
    shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
  } else if (target === "twitter") {
    shareUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
  } else if (target === "instagram") {
    try {
      await navigator.clipboard.writeText(shareText);
      setStatus("Link copiado para o Instagram.");
    } catch (err) {
      setStatus("Nao foi possivel copiar o link.");
    }
    window.open("https://www.instagram.com/", "_blank", "noopener");
    closeSharePanel();
    return;
  }

  if (shareUrl) {
    window.open(shareUrl, "_blank", "noopener");
    closeSharePanel();
  }
}

function buildSourceItem(source) {
  const li = document.createElement("li");
  const link = document.createElement("a");
  const safeUrl = source && isHttpUrl(source.url) ? source.url : "";
  link.href = safeUrl || "#";
  link.className = "source-link";
  if (!safeUrl) {
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
  }
  const title = source.title || source.domain || source.url || "fonte";
  const metaParts = [];
  if (source.domain) metaParts.push(source.domain);
  const publishedValue = source.publishedAt || source.published_at || source.date;
  const relative = formatRelativeTime(publishedValue);
  const published = relative || formatDate(publishedValue);
  if (published && published !== "-") metaParts.push(published);
  const meta = metaParts.join(" · ");

  const titleEl = document.createElement("span");
  titleEl.className = "source-title";
  titleEl.textContent = title;
  link.appendChild(titleEl);

  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "source-meta";
    metaEl.textContent = meta;
    link.appendChild(metaEl);
  }
  link.target = "_blank";
  link.rel = "noreferrer";
  li.appendChild(link);
  return li;
}

function getSourceTimestamp(source) {
  if (!source) return 0;
  return parseDateValue(source.publishedAt || source.published_at || source.date);
}

function sortSourcesByRecency(sources) {
  const list = Array.isArray(sources) ? sources.slice() : [];
  return list
    .map((source, index) => ({ source, index, time: getSourceTimestamp(source) }))
    .sort((a, b) => {
      if (a.time && b.time) return b.time - a.time;
      if (a.time) return -1;
      if (b.time) return 1;
      return a.index - b.index;
    })
    .map((item) => item.source);
}

function renderSources(sources) {
  const orderedSources = sortSourcesByRecency(sources);
  const list = orderedSources.slice(0, MAX_TOTAL_SOURCES);
  const visible = list.slice(0, MAX_VISIBLE_SOURCES);
  const remaining = list.slice(MAX_VISIBLE_SOURCES, MAX_VISIBLE_SOURCES + MAX_MODAL_SOURCES);
  const isQuery = lastResult && lastResult.context === "query";

  sourcesListEl.innerHTML = "";
  modalSourcesListEl.innerHTML = "";

  if (list.length === 0) {
    emptySourcesEl.style.display = "block";
    modalEmptySourcesEl.style.display = "block";
    moreSourcesBtn.style.display = "none";
    return;
  }

  emptySourcesEl.style.display = "none";
  modalEmptySourcesEl.style.display = remaining.length > 0 ? "none" : "block";

  visible.forEach((source) => {
    sourcesListEl.appendChild(buildSourceItem(source));
  });

  remaining.forEach((source) => {
    modalSourcesListEl.appendChild(buildSourceItem(source));
  });

  if (remaining.length > 0) {
    moreSourcesBtn.style.display = "block";
    moreSourcesBtn.textContent = isQuery
      ? `Mais noticias (${remaining.length})`
      : `Mais fontes (${remaining.length})`;
  } else {
    moreSourcesBtn.style.display = "none";
  }
}

function openSourcesModal() {
  if (!lastResult || !lastResult.sources || lastResult.sources.length <= MAX_VISIBLE_SOURCES) {
    return;
  }
  sourcesModalEl.classList.add("open");
  sourcesModalEl.setAttribute("aria-hidden", "false");
}

function closeSourcesModal() {
  sourcesModalEl.classList.remove("open");
  sourcesModalEl.setAttribute("aria-hidden", "true");
}

function openDetailsModal() {
  if (!detailsModalEl) return;
  detailsModalEl.classList.add("open");
  detailsModalEl.setAttribute("aria-hidden", "false");
}

function closeDetailsModal() {
  if (!detailsModalEl) return;
  detailsModalEl.classList.remove("open");
  detailsModalEl.setAttribute("aria-hidden", "true");
}

function resetHighlightState() {
  // highlight feature removed
}

function shouldAutoAnalyzeOnOpen(settings, hasResult) {
  if (!hasResult || !lastResult) return true;
  if (settings.useApi && settings.apiUrl) {
    const sources = Array.isArray(lastResult.sources) ? lastResult.sources : [];
    if (sources.length === 0) return true;
  }
  return false;
}

async function canAnalyze() {
  const settings = await getSettings();
  applyControlState(settings);

  if (!settings.extensionEnabled) {
    setStatus("Desligado.");
    return false;
  }

  return true;
}

async function toggleEnabled() {
  const settings = await getSettings();
  const nextEnabled = !settings.extensionEnabled;
  await chrome.storage.sync.set({ extensionEnabled: nextEnabled });
  const updated = { ...settings, extensionEnabled: nextEnabled };
  applyControlState(updated);
  updateStatusFromSettings(updated);
}

function openSettings() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function requestLastResult() {
  if (currentTabId === null) return false;
  const response = await chrome.runtime.sendMessage({
    type: "GET_LAST_RESULT",
    tabId: currentTabId
  });

  if (response && response.ok && response.result) {
    renderResult(response.result);
    return true;
  }

  return false;
}

async function requestCachedResult(url) {
  if (!url) return false;
  const response = await chrome.runtime.sendMessage({
    type: "GET_RESULT_BY_URL",
    url
  });

  if (response && response.ok && response.result) {
    renderResult(response.result);
    return true;
  }

  return false;
}

async function getCurrentTabUrl() {
  if (currentTabId === null) return currentUrl;
  try {
    const tab = await chrome.tabs.get(currentTabId);
    return tab && tab.url ? tab.url : currentUrl;
  } catch (err) {
    return currentUrl;
  }
}

async function analyzePage(options = {}) {
  if (currentTabId === null) return;
  const startMessage = options.startMessage || "Analisando...";
  const successMessage = options.successMessage || "Pronto.";

  const allowed = await canAnalyze();
  if (!allowed) return;

  if (!options.refreshCache && options.useCache !== false) {
    const tabUrl = await getCurrentTabUrl();
    const cached = await requestCachedResult(tabUrl);
    if (cached) {
      setStatus("Analise recente.");
      return;
    }
  }

  if (options.refreshCache) {
    await requestLastResult();
  }

  setStatus(startMessage);
  analyzeBtn.disabled = true;
  if (reloadBtn) {
    reloadBtn.disabled = true;
    if (options.useSpinner) {
      reloadBtn.classList.add("loading");
    }
  }

  try {
    const response = await chrome.tabs.sendMessage(currentTabId, { type: "ANALYZE" });
    if (!response || !response.result) {
      setStatus("Falha ao analisar.");
      return;
    }

    if (!response.ok && response.error === "no_text") {
      renderResult(response.result);
      setStatus("Sem texto principal.");
      resetHighlightState();
      return;
    }

    renderResult(response.result);
    resetHighlightState();

    await chrome.runtime.sendMessage({
      type: "SET_RESULT",
      tabId: currentTabId,
      result: response.result
    });

    setStatus(successMessage);
  } catch (err) {
    setStatus("Sem acesso a esta aba.");
  } finally {
    analyzeBtn.disabled = false;
    if (reloadBtn) {
      reloadBtn.disabled = false;
      reloadBtn.classList.remove("loading");
    }
  }
}

async function analyzeTopic() {
  const query = (topicInput && topicInput.value ? topicInput.value : "").trim();
  if (!query) {
    setStatus("Digite um assunto.");
    return;
  }

  const settings = await getSettings();
  if (!settings.extensionEnabled) {
    setStatus("Desligado.");
    return;
  }
  if (!settings.useApi || !settings.apiUrl) {
    setStatus("Servidor nao definido.");
    return;
  }

  setStatus("Buscando...");
  if (topicSearchBtn) {
    topicSearchBtn.disabled = true;
    topicSearchBtn.classList.add("loading");
  }

  try {
    const apiResponse = await chrome.runtime.sendMessage({
      type: "API_ANALYZE",
      payload: { query },
      apiUrl: settings.apiUrl,
      apiToken: settings.apiToken
    });

    if (!apiResponse || !apiResponse.ok || !apiResponse.result) {
      setStatus("Falha na busca.");
      return;
    }

    const result = {
      ...apiResponse.result,
      title: query,
      domain: "Pesquisa",
      url: "",
      context: "query"
    };
    renderResult(result);
    setStatus("Tema pronto.");
  } catch (err) {
    setStatus("Sem acesso ao servidor.");
  } finally {
    if (topicSearchBtn) {
      topicSearchBtn.disabled = false;
      topicSearchBtn.classList.remove("loading");
    }
  }
}

async function toggleHighlights() {
  // highlight feature removed
}

analyzeBtn.addEventListener("click", analyzePage);
if (shareToggleBtn) {
  shareToggleBtn.addEventListener("click", () => {
    if (shareToggleBtn.disabled) {
      setStatus("Compartilhamento indisponivel.");
      return;
    }
    toggleSharePanel();
  });
}
if (sharePanelEl) {
  sharePanelEl.addEventListener("click", (event) => {
    const target = event.target.closest("[data-share]");
    if (!target) return;
    handleShare(target.dataset.share);
  });
}
if (topicSearchBtn) {
  topicSearchBtn.addEventListener("click", analyzeTopic);
}
if (topicInput) {
  topicInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      analyzeTopic();
    }
  });
}
if (toggleEnabledBtn) {
  toggleEnabledBtn.addEventListener("click", toggleEnabled);
}
if (reloadBtn) {
  reloadBtn.addEventListener("click", () =>
    analyzePage({
      startMessage: "Recarregando...",
      successMessage: "Atualizado.",
      useSpinner: true,
      refreshCache: true
    })
  );
}
if (settingsBtn) {
  settingsBtn.addEventListener("click", openSettings);
}
moreSourcesBtn.addEventListener("click", openSourcesModal);
closeSourcesModalBtn.addEventListener("click", closeSourcesModal);
sourcesModalEl.addEventListener("click", (event) => {
  if (event.target === sourcesModalEl) {
    closeSourcesModal();
  }
});
if (openDetailsBtn) {
  openDetailsBtn.addEventListener("click", openDetailsModal);
}
if (closeDetailsModalBtn) {
  closeDetailsModalBtn.addEventListener("click", closeDetailsModal);
}
if (detailsModalEl) {
  detailsModalEl.addEventListener("click", (event) => {
    if (event.target === detailsModalEl) {
      closeDetailsModal();
    }
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.theme) {
    applyTheme(changes.theme.newValue);
  }
  if (changes.extensionEnabled) {
    getSettings().then(applyControlState);
  }
});

(async () => {
  const tab = await getActiveTab();
  if (!tab) {
    setStatus("Nenhuma aba ativa encontrada.");
    return;
  }

  currentTabId = tab.id;
  currentUrl = tab.url || "";
  currentDomain = normalizeDomain(currentUrl);
  if (currentDomain && (!lastResult || !domainEl.textContent || domainEl.textContent === "-")) {
    domainEl.textContent = currentDomain;
  }

  const settings = await getSettings();
  applyTheme(settings.theme);
  applyControlState(settings);
  updateStatusFromSettings(settings);
  const hasResult = await requestLastResult();
  const hasCached = !hasResult ? await requestCachedResult(currentUrl) : false;
  if (shouldAutoAnalyzeOnOpen(settings, hasResult || hasCached)) {
    await analyzePage({
      startMessage: "Analisando...",
      successMessage: "Pronto.",
      useSpinner: true
    });
  }
})();
