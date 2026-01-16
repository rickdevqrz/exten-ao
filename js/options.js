const sensitivityEl = document.getElementById("sensitivity");
const useApiEl = document.getElementById("useApi");
const apiUrlEl = document.getElementById("apiUrl");
const themeEl = document.getElementById("theme");
const autoRefreshEl = document.getElementById("autoRefresh");
const refreshIntervalEl = document.getElementById("refreshInterval");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

const DEFAULTS = {
  sensitivity: "media",
  useApi: true,
  apiUrl: "http://localhost:8787/api/analisar",
  theme: "tech",
  autoRefreshEnabled: true,
  autoRefreshIntervalMinutes: 5
};

const REFRESH_MIN = 1;
const REFRESH_MAX = 60;

function setStatus(message) {
  statusEl.textContent = message || "";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme || DEFAULTS.theme;
}

function clampInterval(value) {
  if (!Number.isFinite(value)) return DEFAULTS.autoRefreshIntervalMinutes;
  return Math.min(REFRESH_MAX, Math.max(REFRESH_MIN, value));
}

function loadOptions() {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    sensitivityEl.value = items.sensitivity || "media";
    useApiEl.checked = Boolean(items.useApi);
    apiUrlEl.value = items.apiUrl || "";
    themeEl.value = items.theme || DEFAULTS.theme;
    autoRefreshEl.checked = Boolean(items.autoRefreshEnabled);
    refreshIntervalEl.value = clampInterval(Number(items.autoRefreshIntervalMinutes));
    applyTheme(themeEl.value);
  });
}

function saveOptions() {
  const interval = clampInterval(Number(refreshIntervalEl.value));

  const payload = {
    sensitivity: sensitivityEl.value,
    useApi: useApiEl.checked,
    apiUrl: apiUrlEl.value.trim(),
    theme: themeEl.value,
    autoRefreshEnabled: autoRefreshEl.checked,
    autoRefreshIntervalMinutes: interval
  };

  chrome.storage.sync.set(payload, () => {
    setStatus("Configuracoes salvas.");
    setTimeout(() => setStatus(""), 2000);
  });
}

themeEl.addEventListener("change", () => applyTheme(themeEl.value));
saveBtn.addEventListener("click", saveOptions);
loadOptions();
