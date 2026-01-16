import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import analisarRoute from "./routes/analisar.js";
import { config, isAllowedOrigin } from "./config.js";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use((req, res, next) => {
  const { title = "", text = "", url = "" } = req.body || {};
  if (req.path === "/api/analisar") {
    console.info("[analisar]", {
      title_len: title.length,
      text_len: text.length,
      domain: (() => {
        try {
          return new URL(url).hostname;
        } catch (err) {
          return "";
        }
      })()
    });
  }
  next();
});

app.use("/api", analisarRoute);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  res.status(500).json({
    mode: "search_only",
    verdict: "nao verificavel",
    confidence: 0.4,
    score: 45,
    reasons: ["Erro interno no servidor."],
    claims: [],
    sources: [],
    highlights: [],
    debug: { search_used: false, fetched_sources: 0 }
  });
});

app.listen(config.port, () => {
  console.log(`Servidor rodando em http://localhost:${config.port}`);
});
