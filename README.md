# Detector de Fake News (BR)

## Visao geral
Extensao para Chrome que analisa o texto da pagina, gera um indice de suspeita e apresenta um veredito curto com motivo principal. A verificacao por fontes pode usar servidor publico ou servidor proprio.

## Contexto atual
O Brasil vive um momento de alta polarizacao politica e grande circulacao de desinformacao, principalmente em redes sociais e aplicativos de mensagem. Este projeto existe para ajudar o usuario a olhar para sinais objetivos e buscar fontes confiaveis antes de compartilhar.

## O que faz
- Analisa texto localmente e gera um indice de suspeita.
- Mostra veredito, motivo principal e resumo do nivel.
- Consulta fontes externas por servidor publico ou proprio.
- Permite pesquisar assuntos e listar noticias recentes.
- Permite compartilhar noticias nos niveis 1 a 3 (WhatsApp, Telegram, Twitter, Instagram).

## O que nao faz
- Nao define verdade absoluta.
- Nao substitui checagem jornalistica.
- Nao desbloqueia paywall.
- Pode falhar em paginas sem texto claro.

## Decisoes tecnicas
- Heuristicas transparentes foram escolhidas para facilitar a explicacao do resultado.
- A analise local e separada da verificacao por fontes para manter velocidade e privacidade.
- O servidor externo (publico ou proprio) protege chaves e faz consultas na web.
- Uma allowlist prioriza veiculos confiaveis e reduz ruido.

## Limitacoes conhecidas
- Noticias muito recentes podem aparecer com poucas fontes.
- Conteudo satirico ou opinativo pode gerar falsos positivos.
- Textos curtos podem distorcer o indice.

## Privacidade e etica
- Nao coleta dados pessoais.
- Nao rastreia usuarios.
- Nao censura conteudo.
- Mantem o resultado explicavel para o usuario decidir.

## Tutoriais (duas opcoes)
### Opcao A: usar servidor publico (mais simples)
1) Baixar a extensao  
- Acesse a ultima release:  
  `https://github.com/rickdevqrz/exten-ao/releases/latest`  
- Baixe `extensao-release.rar` (ou `.zip`).  
- Extraia os arquivos em uma pasta.  

2) Instalar no Chrome  
- Abra `chrome://extensions`.  
- Ative o **Modo do desenvolvedor**.  
- Clique em **Carregar sem compactacao**.  
- Selecione a pasta extraida.  

3) Testar  
- Abra uma noticia em um site comum.  
- Clique no icone da extensao.  
- Use **Analisar** e verifique veredito, motivo e fontes.  

Observacao  
- A extensao ja vem configurada para:  
  `https://veredicto.up.railway.app/api/analisar`  
- Se o servidor estiver fora do ar, a extensao continua funcionando com heuristica local.  
- A verificacao com fontes vem desativada por padrao; ative em **Opcoes** quando quiser usar o servidor.  

### Opcao B: usar servidor proprio (local ou hospedado)
1) Baixar o codigo  
- Clone o repositorio ou baixe o ZIP.  

2) Iniciar o servidor local  
- Entre na pasta `server`.  
- Copie `server/.env.example` para `server/.env`.  
- Preencha `SERPER_API_KEY` se quiser resultados melhores (opcional).  
- Rode:  
```bash
cd server
npm install
npm run dev
```
- Teste: `http://localhost:8787/health`  

3) Instalar a extensao  
- Use a release ou a pasta do projeto.  

4) Apontar para o seu servidor  
- Em **Opcoes**, ative **Verificacao com fontes (Serper/RSS)**.  
- Informe a URL do seu servidor, por exemplo:  
  `http://localhost:8787/api/analisar`  
- Se voce definiu `API_TOKEN` no servidor, preencha o Token da API na extensao.  

## Configuracoes
Disponiveis em **Opcoes**:
- Sensibilidade (baixa, media, alta).
- Verificacao com fontes (Serper/RSS).
- URL da API para servidor proprio (padrao: `https://veredicto.up.railway.app/api/analisar`).
- Token da API (quando o servidor exigir).
- Tema da interface.
- Atualizacao automatica do resultado.
  
Compartilhamento:
- Disponivel apenas para noticias nos niveis 1, 2 e 3.
- Redes suportadas: WhatsApp, Telegram, Twitter e Instagram.

## Servidor proprio (detalhes)
O servidor proprio e opcional e serve para controle total.

```bash
cd server
npm install
npm run dev
```

Formato de request esperado:
```json
{
  "title": "Titulo da pagina",
  "text": "Texto principal",
  "url": "https://exemplo.com",
  "sensitivity": "media"
}
```

Variaveis extras (opcionais):
- `API_TOKEN`: protege o endpoint com `X-API-Token`.
- `FETCH_URL_ENABLED`: ativa/desativa o fetch de URL pelo servidor.

## Protecao de chaves
- Guarde chaves em `server/.env`.
- Publique apenas `server/.env.example`.
- Mantenha `.env` e `node_modules` no `.gitignore`.

## Nota do autor
Tive ajuda de IA como assistente em partes do desenvolvimento. Ainda assim, eu conduzi as decisoes principais: definir criterios, ajustar a logica, validar resultados e refinar a experiencia.

## Publicar no GitHub (opcional)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin URL_DO_REPO
git push -u origin main
```

## Proximos passos
- Melhorar deduplicacao de fontes e explicacao dos motivos.
- Testar ranking de confiabilidade por veiculo.
- Refinar satira e contexto para reduzir falsos positivos.
- Usar IA em futuras atualizacoes para melhorar acuracia e manter transparencia.
- Publicar na Chrome Web Store quando o projeto estiver finalizado.
