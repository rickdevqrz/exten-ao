import { config } from "../config.js";
import { searchEvidence, hasSerperKey } from "./search.js";
import { fetchEvidencePages } from "./fetch.js";
import { searchNewsRss } from "./rss.js";

const cache = new Map();

function cacheKey(title, text, url) {
  const safeTitle = String(title || "").slice(0, 60);
  const safeText = String(text || "").slice(0, 120);
  return `${safeTitle}|${url || ""}|${safeText}`;
}

function cacheKeyForQuery(query) {
  const safeQuery = String(query || "").slice(0, 120);
  return `query|${safeQuery}`;
}

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > config.cacheTtlMs) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  cache.set(key, { ts: Date.now(), value });
}

const SENSATIONAL_TERMS = [
  "urgente",
  "bomba",
  "chocante",
  "voce nao vai acreditar",
  "revelado",
  "segredo",
  "imperdivel",
  "midia nao mostra",
  "compartilhe",
  "vai viralizar"
];

const SUSPICIOUS_TLDS = ["xyz", "top", "click", "info", "buzz", "work", "gq", "tk", "ml", "ga", "cf"];

function heuristicScoreDetails({ title, text, url }) {
  const combined = `${title || ""} ${text || ""}`.trim();
  let score = 0;
  const reasons = [];

  const exclamations = (combined.match(/!{2,}/g) || []).length;
  if (exclamations > 0) {
    score += Math.min(10, exclamations * 4);
    reasons.push("Muitos sinais de exagero (!!!).");
  }

  const questions = (combined.match(/\?{2,}/g) || []).length;
  if (questions > 0) {
    score += Math.min(8, questions * 3);
    reasons.push("Excesso de interrogacoes (???).");
  }

  const letters = (title.match(/[A-Za-z]/g) || []).length;
  const upper = (title.match(/[A-Z]/g) || []).length;
  const upperRatio = letters ? upper / letters : 0;
  if (title.length >= 10 && upperRatio > 0.6) {
    score += 8;
    reasons.push("Titulo com muita CAIXA ALTA.");
  }

  const normalized = combined.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const sensationalHits = SENSATIONAL_TERMS.filter((term) =>
    normalized.includes(term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())
  ).length;
  if (sensationalHits > 0) {
    score += Math.min(12, sensationalHits * 5);
    reasons.push("Palavras sensacionalistas no texto.");
  }

  if (text && text.length < 400) {
    score += 6;
    reasons.push("Texto muito curto para uma noticia completa.");
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol && parsed.protocol !== "https:") {
      score += 4;
      reasons.push("Pagina sem HTTPS.");
    }
    const tld = parsed.hostname.split(".").pop() || "";
    if (SUSPICIOUS_TLDS.includes(tld.toLowerCase())) {
      score += 5;
      reasons.push("Dominio com TLD incomum.");
    }
  } catch (err) {
    // Aqui eu ignoro erros de URL para nao interromper a heuristica.
  }

  return { score: Math.min(30, score), reasons };
}

function normalizeDomain(input) {
  try {
    const domain = new URL(input).hostname || "";
    return domain.replace(/^www\./i, "").toLowerCase();
  } catch (err) {
    return String(input || "").replace(/^www\./i, "").toLowerCase();
  }
}

function getSourceGroup(domain) {
  const groups = config.sourceGroups || {};
  const entries = Object.entries(groups);
  for (const [group, domains] of entries) {
    for (const base of domains) {
      if (domain === base || domain.endsWith(`.${base}`)) {
        return group;
      }
    }
  }
  return null;
}

function getSourceStats(sources) {
  const groupsSeen = new Set();
  let agencyCount = 0;
  let officialCount = 0;
  let factcheckCount = 0;

  for (const source of sources || []) {
    const domain = normalizeDomain(source.domain || source.url || "");
    if (!domain) continue;
    const group = getSourceGroup(domain);
    if (group === "agency") {
      agencyCount += 1;
    } else if (group === "official") {
      officialCount += 1;
    } else if (group === "factcheck") {
      factcheckCount += 1;
    } else if (group) {
      groupsSeen.add(group);
    }
  }

  return {
    groupCount: groupsSeen.size,
    agencyCount,
    officialCount,
    factcheckCount,
    hasHighTrust: agencyCount + officialCount + factcheckCount > 0
  };
}

function filterSourcesList(sources, targetUrl, options = {}) {
  const dedupeByDomain = options.dedupeByDomain !== false;
  const targetDomain = normalizeDomain(targetUrl || "");
  const seen = new Set();
  const filtered = [];

  for (const src of sources || []) {
    const domain = normalizeDomain(src.url || src.domain || "");
    if (!domain) continue;
    if (targetDomain && domain === targetDomain) continue;
    const key = dedupeByDomain ? domain : src.url || domain;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push({
      ...src,
      domain
    });
    if (filtered.length >= config.maxSources) break;
  }

  return filtered;
}

function resultsToSources(results) {
  return (results || [])
    .map((item) => {
      const url = item.url || "";
      const domain = item.domain || normalizeDomain(url);
      if (!url && !domain) return null;
      return {
        url,
        domain,
        title: item.title || "",
        snippet: item.snippet || "",
        publishedAt: item.publishedAt || ""
      };
    })
    .filter(Boolean);
}

function sortSourcesByDate(sources) {
  const list = Array.isArray(sources) ? sources.slice() : [];
  return list.sort((a, b) => {
    const aTime = Date.parse(a.publishedAt || "") || 0;
    const bTime = Date.parse(b.publishedAt || "") || 0;
    return bTime - aTime;
  });
}

function computeVerdictFromSources({ sources, heurScore, heurReasons, allowHeuristicFallback }) {
  const sourcesCount = sources.length;
  const sourceStats = getSourceStats(sources);
  const groupCount = sourceStats.groupCount;
  const hasHighTrust = sourceStats.hasHighTrust;

  let verdict = "indicios mistos";
  let confidence = 0.5;
  let baseScore = 45;
  const reasons = [];

  if (sourcesCount >= 3) {
    verdict = "confirmada por multiplas fontes";
    if (hasHighTrust || groupCount >= 2) {
      confidence = 0.88;
      baseScore = 12;
      if (hasHighTrust) {
        reasons.push("Inclui agencia internacional ou orgao oficial.");
      }
      if (groupCount >= 2) {
        reasons.push("Fontes com linhas editoriais diferentes.");
      }
    } else {
      confidence = 0.82;
      baseScore = 16;
      reasons.push(`Encontramos ${sourcesCount} fontes confiaveis que corroboram.`);
    }
  } else if (sourcesCount === 2) {
    verdict = "confirmada por fontes";
    if (hasHighTrust) {
      confidence = 0.82;
      baseScore = 16;
      reasons.push("Inclui agencia internacional ou orgao oficial.");
    } else if (groupCount >= 2) {
      confidence = 0.76;
      baseScore = 20;
      reasons.push("Fontes com linhas editoriais diferentes.");
    } else {
      confidence = 0.7;
      baseScore = 26;
      reasons.push("2 fontes confiaveis sustentam o conteudo.");
    }
  } else if (sourcesCount === 1) {
    if (hasHighTrust) {
      verdict = "confirmada por fonte confiavel";
      confidence = 0.76;
      baseScore = 18;
      reasons.push("Fonte de alta confianca (agencia, orgao oficial ou checagem).");
    } else {
      verdict = "provavelmente verdadeira";
      confidence = 0.62;
      baseScore = 28;
      reasons.push("1 fonte confiavel encontrada; noticia pode ser recente, acompanhe.");
    }
  } else if (!allowHeuristicFallback) {
    verdict = "nao verificavel";
    confidence = 0.4;
    baseScore = 45;
    reasons.push("Nenhuma fonte confiavel encontrada para este assunto.");
  } else {
    if (heurScore <= 5) {
      verdict = "provavelmente verdadeira";
      confidence = 0.6;
      baseScore = 18;
      reasons.push("Texto com linguagem neutra e pouca carga emocional.");
    } else if (heurScore <= 12) {
      verdict = "provavelmente verdadeira";
      confidence = 0.56;
      baseScore = 26;
      reasons.push("Poucos sinais de exagero; leitura parece consistente.");
    } else if (heurScore <= 20) {
      verdict = "indicios mistos";
      confidence = 0.5;
      baseScore = 42;
      reasons.push("Ha sinais mistos no texto; leitura exige cautela.");
    } else {
      verdict = "verificacao recomendada";
      confidence = 0.52;
      baseScore = 58;
      reasons.push("Sinais de exagero e falta de clareza; confirme com outras fontes.");
    }
  }

  if (allowHeuristicFallback && heurReasons.length && reasons.length < 2) {
    reasons.push(heurReasons[0]);
  }

  const finalScore = Math.max(
    0,
    Math.min(100, Math.round(baseScore + (allowHeuristicFallback ? heurScore * 0.2 : 0)))
  );

  return { verdict, confidence, reasons, score: finalScore };
}

function normalizeTitle(title) {
  const clean = String(title || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const splitDash = clean.split(" - ")[0].trim();
  const splitPipe = splitDash.split(" | ")[0].trim();
  return splitPipe || clean;
}

function pickSearchSentence(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.split(/[.!?]\s+/);
  const candidate = sentences.find((sentence) => sentence.trim().length >= 60);
  const choice = candidate ? candidate.trim() : clean.slice(0, 180);
  return choice.length > 200 ? choice.slice(0, 200) : choice;
}

function buildSearchSeeds({ title, text, url }) {
  const seeds = [];
  const titleMain = normalizeTitle(title);
  if (titleMain.length >= 8) seeds.push(titleMain);

  const fullTitle = String(title || "").replace(/\s+/g, " ").trim();
  if (fullTitle && fullTitle !== titleMain && fullTitle.length >= 8) {
    seeds.push(fullTitle);
  }

  const sentence = pickSearchSentence(text);
  if (sentence.length >= 40) seeds.push(sentence);

  const cleanUrl = String(url || "").trim();
  if (seeds.length === 0 && cleanUrl) seeds.push(cleanUrl);
  if (seeds.length === 0) seeds.push("noticia recente");

  const unique = [];
  const seen = new Set();
  for (const seed of seeds) {
    const key = seed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(seed);
    if (unique.length >= 3) break;
  }

  return unique;
}

async function collectEvidence(seeds, preferSerper = true, options = {}) {
  const { fetchPages = true } = options;
  // Aqui eu ativo a Serper somente quando a chave existe e a busca esta habilitada.
  const searchEnabled = Boolean(config.searchEnabled && hasSerperKey());
  const rssEnabled = true;
  let searchUsed = false;
  let searchOk = null;
  let searchProvider = null;
  let evidence = [];

  const trySerper = async () => {
    if (!searchEnabled) return false;
    searchUsed = true;
    const search = await searchEvidence(seeds);
    if (!search.ok) {
      searchOk = searchOk ?? false;
      return false;
    }
    searchOk = true;
    if (search.results && search.results.length > 0) {
      if (fetchPages) {
        const fetched = await fetchEvidencePages(search.results);
        evidence = fetched.length > 0 ? fetched : resultsToSources(search.results);
      } else {
        evidence = resultsToSources(search.results);
      }
    }
    if (evidence.length > 0) {
      searchProvider = "serper";
    }
    return evidence.length > 0;
  };

  const tryRss = async () => {
    const rss = await searchNewsRss(seeds);
    if (rss.attempted) {
      searchUsed = true;
    }
    if (rss.ok) {
      searchOk = true;
    } else {
      searchOk = searchOk ?? false;
    }
    if (rss.results && rss.results.length > 0) {
      evidence = resultsToSources(rss.results);
      searchProvider = "rss";
      return true;
    }
    if (rss.attempted && !searchProvider) {
      searchProvider = "rss";
    }
    return false;
  };

  if (preferSerper && searchEnabled) {
    await trySerper();
  }

  if (evidence.length === 0) {
    await tryRss();
  }

  if (!preferSerper && evidence.length === 0) {
    await trySerper();
  }

  return {
    evidence,
    searchUsed,
    searchOk,
    searchProvider,
    searchEnabled: searchEnabled || rssEnabled
  };
}

export async function verifyContent({ title, text, url }) {
  const key = cacheKey(title, text, url);
  const cached = getCached(key);
  if (cached) return cached;

  const { score: heurScore, reasons: heurReasons } = heuristicScoreDetails({ title, text, url });

  const seeds = buildSearchSeeds({ title, text, url });
  const searchData = await collectEvidence(seeds, true, { fetchPages: true });
  const filteredSources = filterSourcesList(searchData.evidence, url);
  const verdictMeta = computeVerdictFromSources({
    sources: filteredSources,
    heurScore,
    heurReasons,
    allowHeuristicFallback: true
  });

  const result = {
    ok: true,
    result: {
      mode: "search_only",
      verdict: verdictMeta.verdict,
      confidence: verdictMeta.confidence,
      reasons: verdictMeta.reasons,
      claims: [],
      sources: filteredSources,
      highlights: [],
      score: verdictMeta.score,
      debug: {
        search_used: searchData.searchUsed,
        search_enabled: searchData.searchEnabled,
        search_ok: searchData.searchOk,
        search_provider: searchData.searchProvider || "",
        fetched_sources: searchData.evidence.length,
        heuristic_used: true
      }
    }
  };

  setCached(key, result);
  return result;
}

export async function verifyQuery({ query }) {
  const key = cacheKeyForQuery(query);
  const cached = getCached(key);
  if (cached) return cached;

  const cleanQuery = String(query || "").trim();
  const seedSet = new Set();
  if (cleanQuery) seedSet.add(cleanQuery);
  buildSearchSeeds({ title: cleanQuery, text: "", url: "" }).forEach((seed) => seedSet.add(seed));
  const seeds = Array.from(seedSet).slice(0, 3);
  const searchData = await collectEvidence(seeds, false, { fetchPages: false });
  const orderedSources = sortSourcesByDate(searchData.evidence);
  const filteredSources = filterSourcesList(orderedSources, "", { dedupeByDomain: false });

  const result = {
    ok: true,
    result: {
      mode: "search_only",
      verdict: "noticias recentes",
      confidence: null,
      reasons: ["Mostrando as ultimas noticias sobre o tema pesquisado."],
      claims: [],
      sources: filteredSources,
      highlights: [],
      score: 0,
      debug: {
        search_used: searchData.searchUsed,
        search_enabled: searchData.searchEnabled,
        search_ok: searchData.searchOk,
        search_provider: searchData.searchProvider || "",
        fetched_sources: searchData.evidence.length,
        heuristic_used: false,
        query_mode: true
      }
    }
  };

  setCached(key, result);
  return result;
}
