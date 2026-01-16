(() => {
  const HIGHLIGHT_CLASS = "dfn-highlight";
  const HIGHLIGHT_STYLE_ID = "dfn-highlight-style";
  const LAST_RESULT = { value: null };

  const SENSATIONAL_TERMS = [
    "URGENTE",
    "BOMBA",
    "CHOCANTE",
    "VOCE NAO VAI ACREDITAR",
    "REVELADO",
    "SEGREDO",
    "IMPERDIVEL",
    "MIDIA NAO MOSTRA",
    "COMPARTILHE",
    "VAI VIRALIZAR"
  ];

  const PROMISE_PATTERNS = [
    /cura milagrosa/i,
    /100%\s*garantido/i,
    /sem\s*prova/i,
    /cientistas\s+confirmam/i
  ];

  const SUSPICIOUS_TLDS = [
    "xyz",
    "top",
    "click",
    "info",
    "buzz",
    "work",
    "gq",
    "tk",
    "ml",
    "ga",
    "cf"
  ];

  function getDefaultOptions() {
    return {
      sensitivity: "media",
      useApi: true,
      apiUrl: "https://veredicto.up.railway.app/api/analisar"
    };
  }

  function getOptions() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(getDefaultOptions(), (items) => resolve(items));
    });
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function removeDiacritics(text) {
    return (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function buildAccentRegex(term) {
    const map = {
      A: "AÁÀÃÂ",
      E: "EÉÈÊ",
      I: "IÍÌÎ",
      O: "OÓÒÕÔ",
      U: "UÚÙÛ",
      C: "CÇ"
    };

    const base = removeDiacritics(term).toUpperCase();
    let pattern = "";

    for (const char of base) {
      if (char === " ") {
        pattern += "\\s+";
        continue;
      }

      if (map[char]) {
        const chars = map[char] + map[char].toLowerCase();
        pattern += `[${chars}]`;
        continue;
      }

      if (/[\w]/.test(char)) {
        pattern += char;
        continue;
      }

      pattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    return pattern;
  }

  function extractTitle() {
    const h1 = document.querySelector("h1");
    const title = normalizeText(document.title || (h1 ? h1.textContent : ""));
    return title || "(sem titulo)";
  }

  function extractMainText() {
    const candidates = [];
    const article = document.querySelectorAll("article");
    const main = document.querySelectorAll("main");
    article.forEach((el) => candidates.push(el));
    main.forEach((el) => candidates.push(el));

    let bestText = "";
    candidates.forEach((el) => {
      const text = normalizeText(el.innerText || "");
      if (text.length > bestText.length) {
        bestText = text;
      }
    });

    if (!bestText) {
      bestText = normalizeText(document.body ? document.body.innerText : "");
    }

    return bestText;
  }

  function findMetaContent(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const el =
        document.querySelector(`meta[name="${key}"]`) ||
        document.querySelector(`meta[property="${key}"]`) ||
        document.querySelector(`meta[itemprop="${key}"]`);
      if (el && el.getAttribute("content")) {
        return el.getAttribute("content").trim();
      }
    }
    return "";
  }

  function collectJsonLd() {
    const nodes = document.querySelectorAll('script[type="application/ld+json"]');
    const items = [];

    const addNode = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach((child) => addNode(child));
        return;
      }
      if (typeof node !== "object") return;
      if (node["@graph"]) {
        addNode(node["@graph"]);
      }
      items.push(node);
    };

    nodes.forEach((script) => {
      if (!script.textContent) return;
      try {
        const parsed = JSON.parse(script.textContent);
        addNode(parsed);
      } catch (err) {
        // Aqui eu ignoro JSON-LD invalido para nao interromper a coleta.
      }
    });

    return items;
  }

  function pickJsonLdArticle(items) {
    const types = ["NewsArticle", "Article", "ReportageNewsArticle"];
    return (items || []).find((item) => {
      const type = item["@type"];
      const list = Array.isArray(type) ? type : [type];
      return list.some((entry) => {
        const clean = String(entry || "").split("/").pop();
        return types.includes(clean);
      });
    });
  }

  function pickName(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.map((entry) => pickName(entry)).filter(Boolean).join(", ");
    }
    if (typeof value === "object" && value.name) return value.name;
    return "";
  }

  function countOutboundLinks() {
    const anchors = document.querySelectorAll("article a[href], main a[href]");
    const origin = window.location.hostname;
    let count = 0;
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.hostname && url.hostname !== origin) {
          count += 1;
        }
      } catch (err) {
        // Aqui eu ignoro URLs malformadas para seguir contando os links validos.
      }
    });
    return count;
  }

  function extractArticleMeta(text) {
    const jsonItems = collectJsonLd();
    const article = pickJsonLdArticle(jsonItems) || {};

    const author =
      pickName(article.author) ||
      findMetaContent(["article:author", "author", "byl", "parsely-author", "dc.creator"]);
    let publishedAt =
      article.datePublished ||
      article.dateCreated ||
      findMetaContent([
        "article:published_time",
        "article:published",
        "pubdate",
        "date",
        "parsely-pub-date"
      ]);
    const section =
      article.articleSection ||
      findMetaContent(["article:section", "section", "parsely-section"]);
    const siteName =
      pickName(article.publisher) ||
      findMetaContent(["og:site_name", "application-name", "twitter:site"]);
    const canonical = (document.querySelector('link[rel="canonical"]') || {}).href || "";
    const keywords =
      article.keywords || findMetaContent(["news_keywords", "keywords"]);

    if (!publishedAt) {
      const timeEl = document.querySelector("time[datetime]");
      if (timeEl && timeEl.getAttribute("datetime")) {
        publishedAt = timeEl.getAttribute("datetime");
      }
    }

    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const readingMinutes = wordCount ? Math.max(1, Math.round(wordCount / 200)) : 0;
    const outboundLinks = countOutboundLinks();

    return {
      author,
      publishedAt,
      section,
      siteName,
      canonical,
      keywords,
      wordCount,
      readingMinutes,
      outboundLinks
    };
  }

  function getDomainInfo(url) {
    try {
      const parsed = new URL(url);
      return {
        domain: parsed.hostname,
        protocol: parsed.protocol,
        tld: parsed.hostname.split(".").pop() || ""
      };
    } catch (err) {
      return { domain: "", protocol: "", tld: "" };
    }
  }

  function countMatches(text, regex) {
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  function analyzeTextHeuristic(data, sensitivity) {
    const title = data.title || "";
    const text = data.text || "";
    const combined = `${title} ${text}`.trim();

    let score = 0;
    const reasons = [];
    const highlights = [];

    const exclamations = countMatches(combined, /!{2,}/g);
    if (exclamations > 0) {
      score += Math.min(20, exclamations * 5);
      reasons.push("Excesso de exclamacoes (!!!) no texto.");
      highlights.push({ type: "regex", value: "!{2,}", flags: "g" });
    }

    const questions = countMatches(combined, /\?{2,}/g);
    if (questions > 0) {
      score += Math.min(15, questions * 4);
      reasons.push("Excesso de interrogoes (???) no texto.");
      highlights.push({ type: "regex", value: "\\?{2,}", flags: "g" });
    }

    const letters = title.match(/[A-Za-zÀ-ÿ]/g) || [];
    const upper = title.match(/[A-ZÀ-ß]/g) || [];
    const upperRatio = letters.length ? upper.length / letters.length : 0;
    if (title.length >= 8 && upperRatio > 0.6) {
      score += 15;
      reasons.push("Titulo com muitas letras em CAIXA ALTA.");
      highlights.push({ type: "term", value: title });
    }

    const normalizedUpper = removeDiacritics(combined).toUpperCase();
    const foundTerms = [];
    SENSATIONAL_TERMS.forEach((term) => {
      const normalizedTerm = removeDiacritics(term).toUpperCase();
      if (normalizedUpper.includes(normalizedTerm)) {
        foundTerms.push(term);
      }
    });
    if (foundTerms.length > 0) {
      score += Math.min(25, foundTerms.length * 7);
      reasons.push("Presenca de palavras sensacionalistas.");
      foundTerms.forEach((term) => {
        highlights.push({ type: "regex", value: buildAccentRegex(term), flags: "gi" });
      });
    }

    let promiseHits = 0;
    PROMISE_PATTERNS.forEach((regex) => {
      if (regex.test(combined)) {
        promiseHits += 1;
        highlights.push({ type: "regex", value: regex.source, flags: "gi" });
      }
    });
    if (promiseHits > 0) {
      score += Math.min(20, promiseHits * 6);
      reasons.push("Promessas fortes sem fonte clara (ex: cura milagrosa).");
    }

    const emojiCount = countMatches(combined, /[\u{1F300}-\u{1FAFF}]/gu);
    if (emojiCount >= 3) {
      score += Math.min(10, emojiCount * 2);
      reasons.push("Muitos emojis no texto.");
    }

    if (text.length > 0 && text.length < 400) {
      score += 12;
      reasons.push("Texto muito curto para uma noticia completa.");
    }

    const domainInfo = getDomainInfo(data.url || "");
    if (domainInfo.protocol && domainInfo.protocol !== "https:") {
      score += 5;
      reasons.push("Pagina sem HTTPS.");
    }

    if (domainInfo.tld && SUSPICIOUS_TLDS.includes(domainInfo.tld.toLowerCase())) {
      score += 8;
      reasons.push("Dominio com TLD incomum.");
    }

    const sensitivityFactor = sensitivity === "alta" ? 1.3 : sensitivity === "baixa" ? 0.7 : 1;
    score = Math.round(Math.min(100, score * sensitivityFactor));

    return {
      score,
      reasons,
      highlights
    };
  }

  async function analyzeText(data) {
    const options = await getOptions();
    const payload = {
      title: data.title,
      text: data.text,
      url: data.url,
      sensitivity: options.sensitivity
    };

    let apiAttempted = false;
    let apiError = null;

    if (options.useApi) {
      if (!options.apiUrl) {
        apiError = "API_URL_INVALID";
      } else {
        apiAttempted = true;
        try {
          const apiResponse = await chrome.runtime.sendMessage({
            type: "API_ANALYZE",
            payload,
            apiUrl: options.apiUrl
          });

          if (apiResponse && apiResponse.ok && apiResponse.result) {
            return {
              ...apiResponse.result,
              source: "api"
            };
          }

          apiError = (apiResponse && apiResponse.error) || "API_FAILED";
        } catch (err) {
          apiError = "API_FETCH_FAILED";
        }
      }
    }

    const heuristic = analyzeTextHeuristic(payload, options.sensitivity);
    return {
      ...heuristic,
      source: "heuristica",
      debug: {
        api_enabled: Boolean(options.useApi),
        api_url: options.apiUrl || "",
        api_attempted: apiAttempted,
        api_error: apiError
      }
    };
  }

  function ensureHighlightStyle() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        background: #ffe86c;
        color: #1a1a1a;
        padding: 0 2px;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function buildRegex(highlights) {
    if (!highlights || highlights.length === 0) return null;
    const parts = [];

    highlights.forEach((item) => {
      if (item.type === "term") {
        const term = item.value;
        if (!term || term.length < 2) return;
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        parts.push(escaped);
      } else if (item.type === "regex") {
        parts.push(item.value);
      }
    });

    if (parts.length === 0) return null;
    return new RegExp(`(${parts.join("|")})`, "gi");
  }

  function shouldSkipNode(node) {
    if (!node || !node.parentNode) return true;
    const parent = node.parentNode;
    if (parent.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = parent.tagName ? parent.tagName.toLowerCase() : "";
    const blocked = ["script", "style", "noscript", "input", "textarea", "code", "pre"];
    if (blocked.includes(tag)) return true;
    if (parent.classList && parent.classList.contains(HIGHLIGHT_CLASS)) return true;
    return false;
  }

  function applyHighlights(highlights) {
    removeHighlights();
    const regex = buildRegex(highlights);
    if (!regex) return 0;

    ensureHighlightStyle();
    let totalMatches = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach((node) => {
      const text = node.nodeValue;
      regex.lastIndex = 0;
      if (!regex.test(text)) return;

      regex.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const span = document.createElement("span");
        span.className = HIGHLIGHT_CLASS;
        span.textContent = match[0];
        fragment.appendChild(span);
        totalMatches += 1;
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    });

    return totalMatches;
  }

  function removeHighlights() {
    const highlighted = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    highlighted.forEach((el) => {
      const textNode = document.createTextNode(el.textContent || "");
      el.parentNode.replaceChild(textNode, el);
      if (el.parentNode && el.parentNode.normalize) {
        el.parentNode.normalize();
      }
    });
  }

  async function handleAnalyze() {
    const title = extractTitle();
    const text = extractMainText();
    const url = window.location.href;
    const domainInfo = getDomainInfo(url);
    const meta = extractArticleMeta(text);

    if (!text || text.length < 10) {
      return {
        ok: false,
        error: "no_text",
        result: {
          title,
          text,
          url,
          domain: domainInfo.domain,
          meta,
          score: 0,
          reasons: [],
          highlights: []
        }
      };
    }

    const analysis = await analyzeText({ title, text, url });
    const result = {
      title,
      text,
      url,
      domain: domainInfo.domain,
      meta,
      score: analysis.score,
      reasons: analysis.reasons,
      highlights: analysis.highlights,
      source: analysis.source,
      verdict: analysis.verdict,
      final_verdict: analysis.final_verdict || "",
      confidence: analysis.confidence,
      claims: analysis.claims,
      sources: analysis.sources,
      debug: analysis.debug
    };
    LAST_RESULT.value = result;

    return { ok: true, result };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === "ANALYZE") {
      handleAnalyze().then(sendResponse);
      return true;
    }

    if (message.type === "HIGHLIGHT_ON") {
      const highlights = message.highlights || (LAST_RESULT.value ? LAST_RESULT.value.highlights : []);
      const count = applyHighlights(highlights || []);
      sendResponse({ ok: true, count });
      return true;
    }

    if (message.type === "HIGHLIGHT_OFF") {
      removeHighlights();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
