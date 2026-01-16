import { config } from "../config.js";
import { analyzeArticle, composeFinalVerdict as composeFinalVerdictWithOpenAI } from "./openai.js";
import { analyzeWithOllama, composeFinalVerdictWithOllama } from "./ollama.js";

function normalizeVerdict(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("falsa")) return "provavelmente falsa";
  if (text.includes("nao verific")) return "nao verificavel";
  if (text.includes("incerta")) return "incerta";
  if (text.includes("verdadeira")) return "provavelmente verdadeira";
  return "";
}

function clampConfidence(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeList(list, maxItems) {
  if (!Array.isArray(list)) return [];
  const cleaned = list
    .map((item) => String(item || "").trim())
    .filter((item) => item && !item.toLowerCase().includes("heurist") && !item.toLowerCase().includes("modo"));
  if (maxItems) return cleaned.slice(0, maxItems);
  return cleaned;
}

function normalizeResult(result) {
  const verdict = normalizeVerdict(result && result.verdict);
  return {
    verdict,
    confidence: clampConfidence(Number(result && result.confidence)),
    reasons: normalizeList(result && result.reasons, 4),
    highlights: normalizeList(result && result.highlights, 5)
  };
}

function normalizeFinalVerdictText(text) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  const lowered = clean.toLowerCase();
  if (lowered.includes("heurist") || lowered.includes("pipeline") || lowered.includes("modo")) {
    return clean
      .replace(/heurist[a-z]+|pipeline|modo/gi, "")
      .replace(/\bMotivo:\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return clean.replace(/\bMotivo:\s*/gi, "").replace(/\s{2,}/g, " ").trim();
}

export async function analyzeWithAI(payload) {
  if (!config.aiEnabled) {
    return { ok: false, error: "AI_DISABLED" };
  }

  const provider = String(config.aiProvider || "ollama").toLowerCase();
  let response = null;

  if (provider === "openai") {
    response = await analyzeArticle(payload);
  } else if (provider === "ollama") {
    response = await analyzeWithOllama(payload);
  } else {
    return { ok: false, error: "AI_PROVIDER_INVALID" };
  }

  if (!response.ok && provider !== "openai" && config.openaiApiKey) {
    response = await analyzeArticle(payload);
  }

  if (!response.ok) {
    return response;
  }

  return { ok: true, result: normalizeResult(response.result || {}) };
}

export async function composeFinalVerdict(payload) {
  if (!config.aiEnabled) {
    return { ok: false, error: "AI_DISABLED" };
  }

  const provider = String(config.aiProvider || "ollama").toLowerCase();
  let response = null;

  if (provider === "openai") {
    response = await composeFinalVerdictWithOpenAI(payload);
  } else if (provider === "ollama") {
    response = await composeFinalVerdictWithOllama(payload);
  } else {
    return { ok: false, error: "AI_PROVIDER_INVALID" };
  }

  if (!response.ok && provider !== "openai" && config.openaiApiKey) {
    response = await composeFinalVerdictWithOpenAI(payload);
  }

  if (!response.ok) {
    return response;
  }

  const finalText = normalizeFinalVerdictText(
    response.result && response.result.final_verdict
  );
  if (!finalText) {
    return { ok: false, error: "AI_FINAL_VERDICT_EMPTY" };
  }

  return { ok: true, final_verdict: finalText };
}
