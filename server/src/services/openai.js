import OpenAI from "openai";
import { config } from "../config.js";

let client = null;

function getClient() {
  if (!config.openaiApiKey) {
    return null;
  }
  if (!client) {
    const options = { apiKey: config.openaiApiKey };
    if (config.openaiBaseUrl) {
      options.baseURL = config.openaiBaseUrl;
    }
    client = new OpenAI(options);
  }
  return client;
}

function buildAnalyzeInput({ title, text, url, evidence, signals }) {
  return [
    "Voce e um verificador de noticias.",
    "Leia o artigo e as fontes e entregue um veredito unificado.",
    "Responda apenas com JSON valido.",
    "Campos: verdict, confidence, reasons, highlights.",
    "verdict deve ser: provavelmente verdadeira, provavelmente falsa, incerta, nao verificavel.",
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

function buildFinalVerdictInput({
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
    "Responda apenas com JSON valido.",
    "",
    `Veredito base: ${verdict || ""}`,
    `Nivel: ${level || ""}/5`,
    `Descricao do nivel: ${levelLabel || ""}`,
    `Motivos: ${JSON.stringify(reasons || [])}`,
    `Fontes confiaveis: ${Number.isFinite(sourcesCount) ? sourcesCount : 0}`,
    `Resumo do nivel (nao repetir): ${levelSummary || ""}`
  ].join("\n");
}
export async function extractClaims({ title, text, url }) {
  const api = getClient();
  if (!api) {
    return { ok: false, error: "OPENAI_KEY_MISSING" };
  }

  const schema = {
    type: "json_schema",
    name: "claims_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        claims: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: { type: "string" }
        }
      },
      required: ["claims"]
    },
    strict: true
  };

  const input = `Extraia de 3 a 8 alegacoes verificaveis e curtas (PT-BR) a partir do texto abaixo.\n\nTitulo: ${title}\nURL: ${url}\nTexto: ${text}`;

  try {
    const response = await api.responses.create({
      model: config.openaiModel,
      input,
      text: { format: schema }
    });

    const content = response.output_text || "";
    try {
      const parsed = JSON.parse(content);
      return { ok: true, claims: parsed.claims || [] };
    } catch (err) {
      return { ok: false, error: "OPENAI_PARSE_FAILED" };
    }
  } catch (err) {
    const message = err && err.message ? err.message : "unknown";
    return { ok: false, error: `OPENAI_REQUEST_FAILED:${message}` };
  }
}

export async function judgeClaims({ claims, evidence }) {
  const api = getClient();
  if (!api) {
    return { ok: false, error: "OPENAI_KEY_MISSING" };
  }

  const schema = {
    type: "json_schema",
    name: "judgement_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        verdict: { type: "string" },
        confidence: { type: "number" },
        reasons: { type: "array", items: { type: "string" } },
        claims: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              claim: { type: "string" },
              status: { type: "string" },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    url: { type: "string" },
                    domain: { type: "string" },
                    snippet: { type: "string" }
                  },
                  required: ["url", "domain", "snippet"]
                }
              }
            },
            required: ["claim", "status", "evidence"]
          }
        },
        highlights: { type: "array", items: { type: "string" } }
      },
      required: ["verdict", "confidence", "reasons", "claims", "highlights"]
    },
    strict: true
  };

  const input = `Voce e um verificador de fatos. Avalie cada claim usando as evidencias fornecidas.\n\nClaims: ${JSON.stringify(claims)}\n\nEvidencias: ${JSON.stringify(evidence)}\n\nResponda com status por claim (confirmada, desmentida, incerta, nao encontrada), um veredito geral em PT-BR (provavelmente verdadeira, provavelmente falsa, incerta, nao verificavel), confianca (0-1), motivos curtos e highlights.`;

  try {
    const response = await api.responses.create({
      model: config.openaiModel,
      input,
      text: { format: schema }
    });

    const content = response.output_text || "";
    try {
      const parsed = JSON.parse(content);
      return { ok: true, result: parsed };
    } catch (err) {
      return { ok: false, error: "OPENAI_PARSE_FAILED" };
    }
  } catch (err) {
    const message = err && err.message ? err.message : "unknown";
    return { ok: false, error: `OPENAI_REQUEST_FAILED:${message}` };
  }
}

export async function analyzeArticle({ title, text, url, evidence, signals }) {
  const api = getClient();
  if (!api) {
    return { ok: false, error: "OPENAI_KEY_MISSING" };
  }

  const schema = {
    type: "json_schema",
    name: "analysis_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        verdict: { type: "string" },
        confidence: { type: "number" },
        reasons: { type: "array", items: { type: "string" } },
        highlights: { type: "array", items: { type: "string" } }
      },
      required: ["verdict", "confidence", "reasons", "highlights"]
    },
    strict: true
  };

  const input = buildAnalyzeInput({ title, text, url, evidence, signals });

  try {
    const response = await api.responses.create({
      model: config.openaiModel,
      input,
      text: { format: schema }
    });

    const content = response.output_text || "";
    try {
      const parsed = JSON.parse(content);
      return { ok: true, result: parsed };
    } catch (err) {
      return { ok: false, error: "OPENAI_PARSE_FAILED" };
    }
  } catch (err) {
    const message = err && err.message ? err.message : "unknown";
    return { ok: false, error: `OPENAI_REQUEST_FAILED:${message}` };
  }
}

export async function composeFinalVerdict({
  verdict,
  level,
  levelLabel,
  reasons,
  sourcesCount,
  levelSummary
}) {
  const api = getClient();
  if (!api) {
    return { ok: false, error: "OPENAI_KEY_MISSING" };
  }

  const schema = {
    type: "json_schema",
    name: "final_verdict_response",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        final_verdict: { type: "string" }
      },
      required: ["final_verdict"]
    },
    strict: true
  };

  const input = buildFinalVerdictInput({
    verdict,
    level,
    levelLabel,
    reasons,
    sourcesCount,
    levelSummary
  });

  try {
    const response = await api.responses.create({
      model: config.openaiModel,
      input,
      text: { format: schema }
    });

    const content = response.output_text || "";
    try {
      const parsed = JSON.parse(content);
      return { ok: true, result: parsed };
    } catch (err) {
      return { ok: false, error: "OPENAI_PARSE_FAILED" };
    }
  } catch (err) {
    const message = err && err.message ? err.message : "unknown";
    return { ok: false, error: `OPENAI_REQUEST_FAILED:${message}` };
  }
}
