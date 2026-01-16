import express from "express";
import { verifyContent, verifyQuery } from "../services/verify.js";
import { fetchArticle } from "../services/article.js";
import { config } from "../config.js";

const router = express.Router();

function mapStatus(status) {
  if (status === "nao encontrada") return "nao encontrada";
  return status;
}

function mapVerdict(verdict) {
  if (verdict === "nao verificavel") return "nao verificavel";
  return verdict;
}

function buildDebug(overrides = {}) {
  const searchEnabled = Boolean(config.searchEnabled && config.serperApiKey);
  const rssEnabled = true;
  return {
    search_used: false,
    search_enabled: searchEnabled || rssEnabled,
    search_ok: null,
    search_provider: "",
    fetched_sources: 0,
    heuristic_used: true,
    ...overrides
  };
}

router.post("/analisar", async (req, res) => {
  const {
    title = "",
    text = "",
    url = "",
    query = "",
    fetch_url: fetchUrlFlag = false,
    fetchUrl = false
  } = req.body || {};
  const trimmedQuery = String(query || "").trim();
  const shouldFetchUrl = Boolean(fetchUrlFlag || fetchUrl);
  let finalTitle = title;
  let finalText = text;
  let finalUrl = url;
  let finalMeta = null;
  let finalDomain = "";

  if ((!finalText || finalText.length < 10) && trimmedQuery) {
    try {
      const result = await verifyQuery({ query: trimmedQuery });
      if (!result.ok) {
        console.warn("[analisar] falha pipeline", result.error);
        return res.json({
          mode: "search_only",
          verdict: "nao verificavel",
          confidence: 0.4,
          score: 45,
          reasons: ["Nao foi possivel concluir a analise no momento."],
          claims: [],
          sources: [],
          highlights: [],
          debug: buildDebug({ search_used: true, search_provider: "rss", heuristic_used: false })
        });
      }

      const mappedClaims = (result.result.claims || []).map((claim) => ({
        ...claim,
        status: mapStatus(claim.status)
      }));

      return res.json({
        mode: result.result.mode || "search_only",
        verdict: mapVerdict(result.result.verdict),
        confidence: result.result.confidence,
        score: result.result.score,
        reasons: result.result.reasons || [],
        claims: mappedClaims,
        sources: result.result.sources || [],
        highlights: result.result.highlights || [],
        debug: result.result.debug || buildDebug({ search_used: true, heuristic_used: false })
      });
    } catch (err) {
      console.error("[analisar] erro inesperado", err && err.message ? err.message : err);
      return res.status(500).json({
        mode: "search_only",
        verdict: "nao verificavel",
        confidence: 0.4,
        score: 45,
        reasons: ["Erro inesperado no servidor."],
        claims: [],
        sources: [],
        highlights: [],
        debug: buildDebug({ heuristic_used: false })
      });
    }
  }

  if ((!finalText || finalText.length < 10) && shouldFetchUrl && finalUrl) {
    const article = await fetchArticle(finalUrl);
    if (article && article.text) {
      finalTitle = article.title || finalTitle;
      finalText = article.text;
      finalUrl = article.url || finalUrl;
      finalMeta = article.meta || null;
      finalDomain = article.domain || "";
    } else {
      return res.json({
        mode: "search_only",
        verdict: "nao verificavel",
        confidence: 0.4,
        score: 45,
        reasons: ["Nao foi possivel acessar a noticia."],
        claims: [],
        sources: [],
        highlights: [],
        debug: buildDebug()
      });
    }
  }

  if (!finalText || finalText.length < 10) {
    return res.json({
      mode: "search_only",
      verdict: "nao verificavel",
      confidence: 0.4,
      score: 45,
      reasons: ["Texto insuficiente para verificacao."],
      claims: [],
      sources: [],
      highlights: [],
      debug: buildDebug()
    });
  }

  try {
    const result = await verifyContent({ title: finalTitle, text: finalText, url: finalUrl });
    if (!result.ok) {
      console.warn("[analisar] falha pipeline", result.error);
      return res.json({
        mode: "search_only",
        verdict: "nao verificavel",
        confidence: 0.4,
        score: 45,
        reasons: ["Nao foi possivel concluir a analise no momento."],
        claims: [],
        sources: [],
        highlights: [],
        debug: buildDebug({ search_used: true })
      });
    }

    const mappedClaims = (result.result.claims || []).map((claim) => ({
      ...claim,
      status: mapStatus(claim.status)
    }));

    if (!finalDomain && finalUrl) {
      try {
        finalDomain = new URL(finalUrl).hostname;
      } catch (err) {
        finalDomain = "";
      }
    }

    res.json({
      title: finalTitle,
      url: finalUrl,
      domain: finalDomain,
      meta: finalMeta,
      mode: result.result.mode || "search_only",
      verdict: mapVerdict(result.result.verdict),
      confidence: result.result.confidence,
      score: result.result.score,
      reasons: result.result.reasons || [],
      claims: mappedClaims,
      sources: result.result.sources || [],
      highlights: result.result.highlights || [],
      debug: result.result.debug || buildDebug({ search_used: true })
    });
  } catch (err) {
    console.error("[analisar] erro inesperado", err && err.message ? err.message : err);
    res.status(500).json({
      mode: "search_only",
      verdict: "nao verificavel",
      confidence: 0.4,
      score: 45,
      reasons: ["Erro inesperado no servidor."],
      claims: [],
      sources: [],
      highlights: [],
      debug: buildDebug()
    });
  }
});

export default router;
