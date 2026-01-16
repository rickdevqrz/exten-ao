import dotenv from "dotenv";

dotenv.config();

const aiProvider =
  process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "ollama");
const aiEnabled = process.env.AI_ENABLED
  ? process.env.AI_ENABLED === "true"
  : Boolean(process.env.OPENAI_API_KEY || aiProvider === "ollama");

export const config = {
  port: Number(process.env.PORT || 8787),
  openaiEnabled: process.env.OPENAI_ENABLED
    ? process.env.OPENAI_ENABLED === "true"
    : Boolean(process.env.OPENAI_API_KEY),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  apiToken: process.env.API_TOKEN || "",
  aiEnabled,
  aiProvider,
  ollamaHost: process.env.OLLAMA_HOST || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.1:8b",
  searchEnabled: process.env.SEARCH_ENABLED
    ? process.env.SEARCH_ENABLED === "true"
    : true,
  fetchUrlEnabled: process.env.FETCH_URL_ENABLED
    ? process.env.FETCH_URL_ENABLED === "true"
    : true,
  allowlist: [
    "agenciabrasil.ebc.com.br",
    "apublica.org",
    "brasildefato.com.br",
    "cartacapital.com.br",
    "gazetadopovo.com.br",
    "g1.globo.com",
    "jovempan.com.br",
    "nexojornal.com.br",
    "oglobo.globo.com",
    "oantagonista.com.br",
    "r7.com",
    "revistaoeste.com",
    "uol.com.br",
    "valor.globo.com",
    "veja.abril.com.br",
    "veja.com",
    "folha.uol.com.br",
    "estadao.com.br",
    "bbc.com",
    "bbc.co.uk",
    "reuters.com",
    "apnews.com",
    "gov.br",
    "saude.gov.br",
    "stf.jus.br",
    "senado.leg.br",
    "camara.leg.br",
    "anvisa.gov.br",
    "ibge.gov.br",
    "aosfatos.org",
    "lupa.uol.com.br",
    "boatos.org",
    "redebrasilatual.com.br",
    "theintercept.com",
    "afp.com",
    "aljazeera.com",
    "asia.nikkei.com",
    "democracynow.org",
    "eldiario.es",
    "ft.com",
    "foxnews.com",
    "jacobin.com",
    "monde-diplomatique.fr",
    "mondediplo.com",
    "nationalreview.com",
    "nytimes.com",
    "nypost.com",
    "spectator.co.uk",
    "telegraph.co.uk",
    "telesurenglish.net",
    "telesur.net",
    "theguardian.com",
    "thenation.com",
    "washingtonexaminer.com",
    "welt.de",
    "wsj.com"
  ],
  sourceGroups: {
    right: [
      "gazetadopovo.com.br",
      "revistaoeste.com",
      "jovempan.com.br",
      "r7.com",
      "oantagonista.com.br",
      "veja.abril.com.br",
      "veja.com",
      "foxnews.com",
      "wsj.com",
      "telegraph.co.uk",
      "nationalreview.com",
      "spectator.co.uk",
      "nypost.com",
      "washingtonexaminer.com",
      "welt.de"
    ],
    center: [
      "g1.globo.com",
      "uol.com.br",
      "folha.uol.com.br",
      "estadao.com.br",
      "oglobo.globo.com",
      "valor.globo.com",
      "bbc.com",
      "bbc.co.uk",
      "aljazeera.com",
      "ft.com",
      "nytimes.com",
      "theguardian.com",
      "asia.nikkei.com",
      "nexojornal.com.br"
    ],
    left: [
      "brasildefato.com.br",
      "cartacapital.com.br",
      "theintercept.com",
      "redebrasilatual.com.br",
      "apublica.org",
      "democracynow.org",
      "jacobin.com",
      "eldiario.es",
      "monde-diplomatique.fr",
      "mondediplo.com",
      "thenation.com",
      "telesurenglish.net",
      "telesur.net"
    ],
    agency: ["reuters.com", "apnews.com", "afp.com", "agenciabrasil.ebc.com.br"],
    official: [
      "gov.br",
      "saude.gov.br",
      "stf.jus.br",
      "senado.leg.br",
      "camara.leg.br",
      "anvisa.gov.br",
      "ibge.gov.br"
    ],
    factcheck: ["aosfatos.org", "lupa.uol.com.br", "boatos.org"]
  },
  cacheTtlMs: 10 * 60 * 1000,
  fetchTimeoutMs: 7000,
  maxTextChars: 2500,
  maxResults: Number(process.env.MAX_SEARCH_RESULTS || 8),
  maxSources: Number(process.env.MAX_SOURCES || 5)
};

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin.startsWith("chrome-extension://")) return true;
  if (origin.startsWith("http://localhost")) return true;
  if (origin.startsWith("http://127.0.0.1")) return true;
  return false;
}
