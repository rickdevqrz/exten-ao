# Detector de Fake News (BR)

## Introducao
Eu criei esta extensao para estudar como noticias falsas se espalham e como pequenos sinais no texto podem indicar conteudo enganoso. O objetivo nao e apontar uma verdade absoluta; eu queria criar uma ferramenta simples que ajudasse o usuario a refletir antes de compartilhar.

## O que a extensao faz (e o que nao faz)
- Eu analiso o texto da pagina localmente e gero um indice de suspeita com base em sinais objetivos.
- Eu mostro um veredito curto, um motivo principal e um resumo do nivel, sempre junto das fontes quando a verificacao externa esta ativa.
- Eu permito pesquisar um assunto e listar noticias recentes para o usuario escolher a materia.
- Eu nao determino verdade absoluta, nao substituo checagem jornalistica e nao garanto acerto em 100% dos casos.
- Eu nao desbloqueio paywall nem consigo analisar paginas sem texto principal claro.

## Decisoes tecnicas
- Eu preferi heuristicas simples e transparentes porque queria entender exatamente por que um conteudo foi considerado suspeito.
- Eu separei a analise local da verificacao por fontes para manter velocidade e privacidade na extensao.
- Eu optei por um servidor externo para buscar fontes, porque o navegador tem limitacoes de rede e eu preciso proteger chaves de API.
- Eu priorizei fontes confiaveis e uma allowlist porque queria reduzir ruido e dar mais peso a veiculos reconhecidos.

## Limitacoes assumidas
- Eu sei que noticias muito recentes podem aparecer com poucas fontes confiaveis.
- Eu sei que satira, opiniao e humor podem gerar falsos positivos.
- Eu sei que textos curtos ou com pouco contexto podem distorcer o indice.
- Eu assumo que a heuristica nao entende intencao; ela apenas soma sinais.

## Etica e responsabilidade
Eu nao coleto dados pessoais, nao rastreio usuarios e nao censuro conteudo. Eu deixei o sistema transparente de proposito para que o usuario entenda o motivo do resultado e tome sua propria decisao.

## Tutorial completo (extensao + servidor)
### 1) Baixar o codigo
- Eu baixo o ZIP do projeto ou clono o repositorio.

### 2) Preparar o servidor local (opcional, mas recomendado)
- Eu instalo o Node.js 18+.
- Eu entro na pasta `server`.
- Eu copio `server/.env.example` para `server/.env`.
- Eu preencho `SERPER_API_KEY` se eu quiser resultados melhores; sem isso eu ainda tenho RSS.
- Eu mantenho `AI_ENABLED=false` e `OPENAI_API_KEY` vazio se eu nao quiser usar IA.
- Eu rodo:
```bash
cd server
npm install
npm run dev
```
- Eu testo `http://localhost:8787/health` e espero `{ "ok": true }`.

### 3) Instalar a extensao no Chrome
- Eu abro `chrome://extensions`.
- Eu ativo o **Modo do desenvolvedor**.
- Eu clico em **Carregar sem compactacao**.
- Eu seleciono a pasta deste projeto.

### 4) Conectar a extensao ao servidor
- Eu abro as **Opcoes** da extensao.
- Eu ativo **Usar verificacao com fontes (Serper/RSS)**.
- Eu preencho a URL `http://localhost:8787/api/analisar`.
- Eu salvo as configuracoes.

### 5) Testar tudo
- Eu abro uma noticia em um site comum.
- Eu clico no icone da extensao.
- Eu uso **Analisar** e verifico o veredito, o motivo e as fontes.

## Como eu testo
1. Eu abro uma noticia em um site comum.
2. Eu clico no icone da extensao.
3. Eu uso **Analisar** para gerar o indice.
4. Eu confiro o veredito, o motivo e as fontes retornadas.

## Configuracoes
Eu deixei uma pagina de configuracoes com ajustes basicos:
- Eu controlo a sensibilidade (baixa, media, alta).
- Eu ativo a verificacao com fontes (Serper/RSS) quando quero checar noticias na web.
- Eu aponto a URL da API quando uso o servidor local.
- Eu mudo o tema da interface quando preciso.
- Eu ligo a atualizacao automatica quando quero recarregar analises recentes.

## Servidor opcional (verificacao com fontes)
Eu mantenho um servidor Node.js local para buscar fontes confiaveis. Quando ele esta ativo, eu envio `title`, `text` e `url`, e recebo o score com as fontes.

Quando eu envio dados para o servidor, eu uso este formato:
```json
{
  "title": "Titulo da pagina",
  "text": "Texto principal",
  "url": "https://exemplo.com",
  "sensitivity": "media"
}
```

Se eu nao configurar chaves externas, a extensao continua funcionando com a heuristica local.

## Como eu protejo minhas chaves
- Eu guardo minhas chaves em `server/.env`.
- Eu publico apenas `server/.env.example`, sem valores reais.
- Eu mantenho `.env` e `node_modules` no `.gitignore` para nao subir nada sensivel.
- Eu reviso `git status` antes de publicar.

## Como eu publico no GitHub
- Eu inicio o repositorio com `git init`.
- Eu adiciono os arquivos com `git add .`.
- Eu crio o commit com `git commit -m "Initial commit"`.
- Eu crio o repositorio no GitHub e conecto com `git remote add origin URL_DO_REPO`.
- Eu envio o codigo com `git push -u origin main`.

## Proximos passos
- Eu gostaria de melhorar a deduplicacao de fontes e a explicacao dos motivos.
- Eu quero testar modelos de ranking de confiabilidade por veiculo.
- Eu pretendo estudar melhor satira e contexto para reduzir falsos positivos.
- Eu pretendo usar IA no futuro para melhorar desempenho e acertividade, com cuidado para manter transparencia.
- Eu pretendo publicar a extensao na Chrome Web Store quando eu considerar o projeto finalizado.
