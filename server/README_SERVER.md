# Servidor de Verificacao - Detector de Fake News (BR)

Servidor local em Node.js que verifica alegacoes usando OpenAI + busca web via Serper.

## Requisitos
- Node.js 18+
- Chaves opcionais: `SERPER_API_KEY` e `OPENAI_API_KEY`
- Token opcional: `API_TOKEN` (para proteger o endpoint)

## Como rodar
```bash
cd server
npm install
npm run dev
```

Servidor em: `http://localhost:8787`

## Endpoint
`POST /api/analisar`

Request:
```json
{
  "title": "Titulo",
  "text": "Texto",
  "url": "https://exemplo.com",
  "sensitivity": "media"
}
```

Response:
```json
{
  "mode": "verify",
  "verdict": "provavelmente verdadeira",
  "confidence": 0.72,
  "score": 15,
  "reasons": ["..."],
  "claims": [],
  "sources": [],
  "highlights": [],
  "debug": {"search_used": true, "fetched_sources": 2}
}
```

## Observacoes
- Se faltar `SERPER_API_KEY`, o servidor retorna `mode: heuristic_fallback`.
- Nao loga conteudo completo do usuario (somente tamanhos e dominio).
- O CORS aceita `localhost` e `chrome-extension://*`.
- Se `API_TOKEN` estiver definido, envie `X-API-Token` nas requisicoes.
