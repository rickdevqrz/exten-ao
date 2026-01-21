# Detector de Fake News (BR) - Extensão para análise de notícias

Extensão do Chrome para análise de notícias em português. Ela calcula um índice de suspeita com heurísticas locais e, se ativado, consulta fontes confiáveis via um servidor para apoiar o veredito.

## Motivação
Este é um projeto pessoal e educacional. A ideia é estudar desinformação e entender quais sinais objetivos aparecem em textos suspeitos, sem prometer uma resposta definitiva.

## Principais funcionalidades
- Análise local do texto da página e índice de suspeita.
- Veredito curto, motivo principal e resumo do nível.
- Consulta de fontes via servidor (Serper/RSS) quando ativado.
- Pesquisa de assuntos e listagem de notícias recentes.
- Compartilhamento habilitado apenas para níveis 1 a 3 (WhatsApp, Telegram, Twitter e Instagram).
- Tema da interface e atualização automática configurável.

## Limitações importantes
- O resultado não é verdade absoluta e pode errar.
- Notícias muito recentes podem ter poucas fontes.
- Conteúdo satírico/opinativo pode gerar falsos positivos.
- Páginas com pouco texto ou paywall podem falhar.
- As fontes são restritas a uma allowlist de veículos.

## Privacidade e uso de dados
- A análise local acontece no navegador.
- Se a verificação com fontes estiver ativada, a extensão envia título, texto, URL e sensibilidade para o servidor.
- O servidor não armazena conteúdo; apenas processa a requisição e retorna o resultado.
- Não há rastreamento de usuários.

## Instalação (Chrome - modo desenvolvedor)

### Opção A: instalar apenas a extensão (mais simples)
1) Baixar a extensão  
- Pegue a última release em:  
  `https://github.com/rickdevqrz/exten-ao/releases/latest`  
- Baixe o `.zip` e extraia em uma pasta.

2) Carregar no Chrome  
- Abra `chrome://extensions`.  
- Ative **Modo do desenvolvedor**.  
- Clique em **Carregar sem compactação**.  
- Selecione a pasta extraída.

3) (Opcional) Ativar verificação com fontes  
- Abra **Opções** da extensão.  
- Ative **Verificação com fontes (Serper/RSS)**.  
- A release já vem configurada com:  
  `https://veredicto.up.railway.app/api/analisar`

### Opção B: clonar o repositório (para servidor local e ajustes)
1) Clonar o projeto:
```bash
git clone https://github.com/rickdevqrz/exten-ao.git
cd exten-ao
```
2) Instalar a extensão no Chrome (mesmos passos da Opção A).
3) Configurar e rodar o servidor local (veja a seção abaixo).

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

5) Aponte a extensão para o servidor:
- Em **Opções**, ative **Verificação com fontes (Serper/RSS)**.
- URL: `http://localhost:8787/api/analisar`
- Se definiu `API_TOKEN`, preencha o Token da API.

## Uso básico
1) Abra uma notícia.
2) Clique no ícone da extensão.
3) Clique em **Analisar**.
4) Leia o veredito, motivos e fontes.
5) Compartilhe apenas se o nível for 1, 2 ou 3.

## Estrutura do projeto (breve)
- `manifest.json` - configuração da extensão.
- `popup.html`, `css/popup.css`, `js/popup.js` - interface principal.
- `js/content.js` - leitura do texto da página.
- `js/background.js` - comunicação com a API.
- `options.html`, `css/options.css`, `js/options.js` - página de configurações.
- `server/` - servidor opcional para busca de fontes.

## Aviso legal
Este projeto não substitui checagem jornalística. Ele apenas auxilia o usuário a refletir antes de compartilhar.

## Prints (opcional)
Sugestão: adicione capturas da tela do popup e da tela de opções para facilitar o entendimento.

## Nota do autor
Tive ajuda de IA como assistente em partes do desenvolvimento e também fiz alterações manuais no código.

## Licença
Sem licença definida no momento.
