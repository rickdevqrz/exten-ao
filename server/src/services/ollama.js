import { config } from "../config.js";

function normalizeHost(host) {
  if (!host) return "";
  return host.endsWith("/") ? host.slice(0, -1) : host;
}

function safeJsonParse(input) {
  if (!input) return null;
  if (typeof input === "object") return input;
  const raw = String(input).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (innerErr) {
        return null;
      }
    }
  }
  return null;
}

function normalizeFinalVerdict(parsed, rawText) {
  if (parsed && typeof parsed === "object") {
    const candidates = [
      parsed.final_verdict,
      parsed.finalVerdict,
      parsed.veredito_final,
      parsed.vereditoFinal,
      parsed.verdict
    ];
    const found = candidates.find((item) => typeof item === "string" && item.trim());
    if (found) return found.trim();
  }

  if (typeof rawText === "string" && rawText.trim()) {
    return rawText.trim();
  }

  return "";
}

function buildPrompt({ title, text, url, evidence, signals }) {
  return [
    "Voce e um verificador de noticias.",
    "Leia o artigo e as fontes e entregue um veredito unificado.",
    "Responda somente em JSON valido.",
    "Campos obrigatorios: verdict, confidence, reasons, highlights.",
    "verdict deve ser uma destas opcoes: provavelmente verdadeira, provavelmente falsa, incerta, nao verificavel.",
    "confidence deve estar entre 0 e 1.",
    "reasons deve ter 2 a 4 itens curtos que sustentam o veredito.",
    "highlights deve ter 2 a 5 termos curtos relevantes.",
    "Nao mencione heuristica, modo ou pipeline.",
    "",
    `Titulo: ${title || ""}`,
    `URL: ${url || ""}`,
    `Texto: ${text || ""}`,
    "",
    `Sinais do texto: ${JSON.stringify(signals || [])}`,
    `Fontes: ${JSON.stringify(evidence || [])}`
  ].join("\n");
}

function buildFinalVerdictPrompt({
  verdict,
  level,
  levelLabel,
  reasons,
  sourcesCount,
  levelSummary
}) {
  return [
    "Escreva um veredito final curto e direto (1-2 frases).",
    "A primeira frase deve dizer o veredito.",
    "A segunda frase deve mencionar o Nivel X/5 e o motivo principal.",
    "Nao use 'Motivo:' e nao repita frases do resumo do nivel.",
    "Evite copiar literalmente os motivos; use palavras curtas.",
    "Nao mencione heuristica, modo ou pipeline.",
    "Responda apenas com o texto final, sem JSON.",
    "",
    `Veredito base: ${verdict || ""}`,
    `Nivel: ${level || ""}/5`,
    `Descricao do nivel: ${levelLabel || ""}`,
    `Motivos: ${JSON.stringify(reasons || [])}`,
    `Fontes confiaveis: ${Number.isFinite(sourcesCount) ? sourcesCount : 0}`,
    `Resumo do nivel (nao repetir): ${levelSummary || ""}`
  ].join("\n");
}

export async function analyzeWithOllama({ title, text, url, evidence, signals }) {
  const host = normalizeHost(config.ollamaHost || "");
  if (!host) {
    return { ok: false, error: "OLLAMA_HOST_MISSING" };
  }

  const prompt = buildPrompt({ title, text, url, evidence, signals });

  try {
    const response = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.2,
          num_predict: 220
        }
      })
    });

    if (!response.ok) {
      return { ok: false, error: "OLLAMA_HTTP_ERROR" };
    }

    const data = await response.json();
    const rawResponse = data && data.response ? data.response : "";
    const parsed = safeJsonParse(rawResponse);
    if (!parsed) {
      return { ok: false, error: "OLLAMA_PARSE_FAILED" };
    }

    return { ok: true, result: parsed };
  } catch (err) {
    const message = err && err.message ? err.message : "unknown";
    return { ok: false, error: `OLLAMA_REQUEST_FAILED:${message}` };
  }
}

export async function composeFinalVerdictWithOllama({
  verdict,
  level,
  levelLabel,
  reasons,
  sourcesCount,
  levelSummary
}) {
  const host = normalizeHost(config.ollamaHost || "");
  if (!host) {
    return { ok: false, error: "OLLAMA_HOST_MISSING" };
  }

  const prompt = buildFinalVerdictPrompt({
    verdict,
    level,
    levelLabel,
    reasons,
    sourcesCount,
    levelSummary
  });

  try {
    const response = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 120
        }
      })
    });

    if (!response.ok) {
      return { ok: false, error: "OLLAMA_HTTP_ERROR" };
    }

    const data = await response.json();
    const rawResponse = data && data.response ? data.response : "";
    const parsed = safeJsonParse(rawResponse);
    const finalText = normalizeFinalVerdict(parsed, rawResponse);
    if (!finalText) {
      return { ok: false, error: "OLLAMA_PARSE_FAILED" };
    }

    return { ok: true, result: { final_verdict: finalText } };
  } catch (err) {
    const message = err && err.message ? err.message : "unknown";
    return { ok: false, error: `OLLAMA_REQUEST_FAILED:${message}` };
  }
}
