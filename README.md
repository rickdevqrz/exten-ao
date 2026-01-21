Detector de Fake News (BR) – Extensão para Análise de Notícias

Extensão do Chrome para análise de notícias em português. Ela calcula um índice de suspeita com heurísticas locais e, se ativado, consulta fontes confiáveis por meio de um servidor para apoiar o veredito.

Motivação

Este é um projeto pessoal e educacional. A ideia é estudar a desinformação e entender quais sinais objetivos aparecem em textos suspeitos, sem prometer uma resposta definitiva.

Principais funcionalidades

Análise local do texto da página e cálculo de índice de suspeita.

Veredito curto, motivo principal e resumo do nível.

Consulta de fontes via servidor (Serper/RSS), quando ativada.

Pesquisa de assuntos e listagem de notícias recentes.

Compartilhamento habilitado apenas para níveis 1 a 3 (WhatsApp, Telegram, Twitter e Instagram).

Tema da interface e atualização automatizada configuráveis.

Limitações importantes

O resultado não é uma verdade absoluta e pode errar.

Notícias muito recentes podem ter poucas fontes disponíveis.

Conteúdo satírico ou opinativo pode gerar falsos positivos.

Páginas com pouco texto ou com paywall podem falhar.

As fontes são restritas a uma allowlist de veículos.

Privacidade e uso de dados

A análise local acontece inteiramente no navegador.

Se a verificação com fontes estiver ativada, a extensão envia título, texto, URL e sensibilidade para o servidor.

O servidor não armazena conteúdo; apenas processa a requisição e retorna o resultado.

Não há rastreamento de usuários.

Instalação (Chrome – modo desenvolvedor)
Opção A: instalar apenas a extensão (mais simples)

Baixar a extensão

Pegue a última release em:
https://github.com/rickdevqrz/exten-ao/releases/latest

Baixe o arquivo .zip e extraia-o em uma pasta.

Carregar no Chrome

Abra chrome://extensions.

Ative o Modo do desenvolvedor.

Clique em Carregar sem compactação.

Selecione a pasta extraída.

(Opcional) Ativar verificação com fontes

Abra Opções da extensão.

Ative Verificação com fontes (Serper/RSS).

A release já vem configurada com:
https://veredicto.up.railway.app/api/analisar

Opção B: clonar o repositório (para servidor local e ajustes)

Clonar o projeto:

git clone https://github.com/rickdevqrz/exten-ao.git
cd exten-ao


Instalar a extensão no Chrome (mesmos passos da Opção A).

Configurar e rodar o servidor local (veja a seção abaixo).

Servidor local (opcional)

Este modo permite rodar o servidor no seu próprio computador e configurar credenciais de API.

Requisitos: Node.js 18+.

Passo a passo:

Copie server/.env.example para server/.env.

Configure no .env (opcional):

SERPER_API_KEY (melhora os resultados).

API_TOKEN (protege o endpoint).

FETCH_URL_ENABLED=true ou false (ativa ou desativa o fetch de URL).

Rode o servidor:

cd server
npm install
npm run dev


Teste: http://localhost:8787/health

Aponte a extensão para o servidor:

Em Opções, ative Verificação com fontes (Serper/RSS).

URL: http://localhost:8787/api/analisar

Se tiver definido API_TOKEN, preencha o campo Token da API.

Uso básico

Abra uma notícia.

Clique no ícone da extensão.

Clique em Analisar.

Leia o veredito, os motivos e as fontes.

Compartilhe apenas se o nível for 1, 2 ou 3.

Estrutura do projeto (breve)

manifest.json – configuração da extensão.

popup.html, css/popup.css, js/popup.js – interface principal.

js/content.js – leitura do texto da página.

js/background.js – comunicação com a API.

options.html, css/options.css, js/options.js – página de configurações.

server/ – servidor opcional para busca de fontes.

Aviso legal

Este projeto não substitui a checagem jornalística profissional. Ele apenas auxilia o usuário a refletir antes de compartilhar.

Prints (opcional)

Sugestão: adicione capturas de tela do popup e da página de opções para facilitar o entendimento.

Nota do autor

Tive ajuda de IA como assistente em partes do desenvolvimento e também fiz alterações manuais no código.

Licença

Sem licença definida no momento.
