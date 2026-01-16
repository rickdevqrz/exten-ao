# Detector de Fake News (BR) - Extensao para analise de noticias

Extensao do Chrome para analise de noticias em portugues. Ela calcula um indice de suspeita com heuristicas locais e, se ativado, consulta fontes confiaveis via um servidor para apoiar o veredito.

## Motivacao
Este e um projeto pessoal e educacional. A ideia e estudar desinformacao e entender quais sinais objetivos aparecem em textos suspeitos, sem prometer uma resposta definitiva.

## Principais funcionalidades
- Analise local do texto da pagina e indice de suspeita.
- Veredito curto, motivo principal e resumo do nivel.
- Consulta de fontes via servidor (Serper/RSS) quando ativado.
- Pesquisa de assuntos e listagem de noticias recentes.
- Compartilhamento habilitado apenas para niveis 1 a 3 (WhatsApp, Telegram, Twitter e Instagram).
- Tema da interface e atualizacao automatica configuravel.

## Limitacoes importantes
- O resultado nao e verdade absoluta e pode errar.
- Noticias muito recentes podem ter poucas fontes.
- Conteudo satirico/opinativo pode gerar falsos positivos.
- Paginas com pouco texto ou paywall podem falhar.
- As fontes sao restritas a uma allowlist de veiculos.

## Privacidade e uso de dados
- A analise local acontece no navegador.
- Se a verificacao com fontes estiver ativada, a extensao envia titulo, texto, URL e sensibilidade para o servidor.
- O servidor nao armazena conteudo; apenas processa a requisicao e retorna o resultado.
- Nao ha rastreamento de usuarios.

## Instalacao (Chrome - modo desenvolvedor)
1) Baixar a extensao  
- Pegue a ultima release em:  
  `https://github.com/rickdevqrz/exten-ao/releases/latest`  
- Baixe o `.zip` e extraia em uma pasta.
  
Opcao alternativa (clonar o repositorio):
```bash
git clone https://github.com/rickdevqrz/exten-ao.git
cd exten-ao
```

2) Carregar no Chrome  
- Abra `chrome://extensions`.  
- Ative **Modo do desenvolvedor**.  
- Clique em **Carregar sem compactacao**.  
- Selecione a pasta extraida.

3) (Opcional) Ativar verificacao com fontes  
- Abra **Opcoes** da extensao.  
- Ative **Verificacao com fontes (Serper/RSS)**.  
- Use a URL padrao ou informe seu servidor.

## Servidor local (opcional)
Este modo permite rodar o servidor no seu PC e configurar credenciais de API.

Requisitos: Node.js 18+.

Passo a passo:
1) Copie `server/.env.example` para `server/.env`.
2) Configure no `.env` (opcional):
   - `SERPER_API_KEY` (melhora resultados).
   - `API_TOKEN` (protege o endpoint).
   - `FETCH_URL_ENABLED=true` ou `false` (ativa/desativa fetch de URL).
3) Rode o servidor:
```bash
cd server
npm install
npm run dev
```
4) Teste: `http://localhost:8787/health`

5) Aponte a extensao para o servidor:
- Em **Opcoes**, ative **Verificacao com fontes (Serper/RSS)**.
- URL: `http://localhost:8787/api/analisar`
- Se definiu `API_TOKEN`, preencha o Token da API.

## Uso basico
1) Abra uma noticia.
2) Clique no icone da extensao.
3) Clique em **Analisar**.
4) Leia veredito, motivos e fontes.
5) Compartilhe apenas se o nivel for 1, 2 ou 3.

## Estrutura do projeto (breve)
- `manifest.json` - configuracao da extensao.
- `popup.html`, `css/popup.css`, `js/popup.js` - interface principal.
- `js/content.js` - leitura do texto da pagina.
- `js/background.js` - comunicacao com a API.
- `options.html`, `css/options.css`, `js/options.js` - pagina de configuracoes.
- `server/` - servidor opcional para busca de fontes.

## Aviso legal
Este projeto nao substitui checagem jornalistica. Ele apenas auxilia o usuario a refletir antes de compartilhar.

## Prints (opcional)
Sugestao: adicione capturas da tela do popup e da tela de opcoes para facilitar o entendimento.

## Nota do autor
Tive ajuda de IA como assistente em partes do desenvolvimento e tambem fiz alteracoes manuais no codigo.

## Licenca
Sem licenca definida no momento.
