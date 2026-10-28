# KYROSHIX Records — Spatial WebUI

Guia da homepage atual (`/`). A página é independente do SPA antigo, não tem build e roda como arquivos estáticos no Worker da Cloudflare.

## Arquivos

| Arquivo | Função |
| --- | --- |
| `dist/index.html` | Shell semântico da homepage: sprite de ícones, topbar, três colunas, mini player, nav mobile e os quatro `<dialog>` (conta, planos, player, bastidores). |
| `dist/spatial-ui.html` | Alias idêntico ao `index.html`. Mantido para compatibilidade com links antigos. |
| `dist/spatial.css` | Layout glassmorphism, breakpoints, player, formulários, comentários, stories e painel de inteligência. |
| `dist/spatial.js` | Módulo ES com catálogo de seis faixas, player, métricas, comentários, contas/planos e insights. |
| `dist/legacy.html` | SPA anterior, apenas para rollback e testes. Fora da navegação pública. |
| `cloudflare/worker.mjs` | Rotas de documentos, assets estáticos e os endpoints opcionais de métricas. |

Ao gerar o patch do Worker, `scripts/export-worker.py` já inclui `index.html`, `spatial-ui.html`, `spatial.css` e `spatial.js`. `scripts/export-pages.py` copia todo o `dist/`, então os dois novos arquivos entram no ZIP completo automaticamente. `_headers` marca `/*.js` e `/*.css` com `Cache-Control: no-cache`, evitando CSS/JS velhos em cache.

## Layout e breakpoints

- **Acima de 1280 px:** grid de três colunas (`236px / 1fr / 316px`), todas alinhadas no topo. O painel de inteligência fica na terceira coluna.
- **1280 px a 901 px:** duas colunas; o painel de inteligência vira um painel lateral fixo aberto pelo botão de gráfico na topbar. O scrim fecha o painel ao clicar fora.
- **900 px a 641 px:** uma coluna; a navegação lateral vira uma faixa horizontal de atalhos acima do conteúdo.
- **Até 640 px:** navegação inferior fixa, mini player acima dela, topbar compacta sem navegação duplicada e player expandido em coluna única.

O `.shell` deliberadamente **não** cria stacking context: o painel fixo (`z-index: 60`) precisa ficar acima do scrim (`z-index: 55`). Os filhos recebem `z-index: 2` para ficarem acima do fundo. Não reintroduza `z-index` no `.shell` sem mover o scrim junto.

O campo "Pergunte sobre sua audiência" usa `position: sticky; bottom` dentro do painel, então continua acessível mesmo quando o conteúdo exige rolagem.

## Contas, planos e comentários

Tudo é local ao navegador, em `localStorage`:

| Chave | Conteúdo |
| --- | --- |
| `kx.accounts.v2` | Contas com `id`, `name`, `email`, `salt`, `hash`, `plan`, `planSince`, `createdAt`. |
| `kx.session.v2` | ID da conta logada. |
| `kx.comments.v2` | Comentários por faixa, respostas, curtidas e exemplos. |
| `kx.metrics.v2` | Reproduções, curtidas, reposts e comentários medidos neste navegador. |
| `kx.presence.v2` | Sessões de audição recentes (janela de 30 s). |

A senha passa por PBKDF2-SHA256 com 120 mil iterações e salt aleatório (Web Crypto). Se o navegador não oferecer `crypto.subtle`, há um fallback determinístico — nesse caso a proteção é apenas ofuscante, não criptográfica. Não há servidor de autenticação: qualquer pessoa com acesso ao navegador pode ler e alterar esses dados.

O checkout **não cobra nada**. Ele valida nome, 16 dígitos, validade `MM/AA` e CVC, e grava o plano escolhido. Os dados do cartão não são enviados, não são salvos e não devem ser reais. Para billing de produção é necessário: provedor de pagamento, chaves como secrets do Worker, criação de sessão/checkout no servidor, verificação de assinatura de webhooks e persistência da assinatura em banco/KV autoritativo. Nunca confie no plano vindo do `localStorage` para liberar conteúdo protegido.

Comentários de exemplo são marcados com **EXEMPLO**. Publicar, responder, curtir e excluir (somente o autor) exigem conta e persistem no navegador.

## Métricas reais

Não existem números fictícios na interface. O fluxo:

1. O evento `play` do `<audio>` chama `bumpPlay()`, que incrementa o contador da faixa e faz `POST /api/metrics/play`.
2. Um heartbeat a cada 12 s registra a sessão e faz `POST /api/metrics/presence` (janela de 30 s).
3. O front consulta `GET /api/metrics`. Se a resposta for `ok: true`, usa os números agregados do servidor; se for `ok: false` (sem KV) ou falhar, usa os contadores locais medidos neste navegador.

O Worker lê/escreve duas chaves no namespace KV `KX_METRICS`: `kx:metrics:v1` (reproduções por faixa e total) e `kx:presence:v1` (sessões ativas). **Sem o binding, a agregação entre dispositivos não acontece** — a página continua correta, mas mostra apenas a audiência real do próprio navegador. KV é eventualmente consistente: picos de escrita na mesma chave podem perder incrementos. Para produção com volume alto, use Durable Objects ou um serviço de analytics.

Os endpoints são públicos e não têm autenticação nem proteção contra fraude: qualquer cliente pode enviar `play` ou `presence` com um ID arbitrário e inflar os números. Eles servem para medir audiência de uma demonstração, não para faturamento ou relatórios oficiais. Se precisar de números auditáveis, valide a origem, deduplique por sessão autenticada e grave os eventos em um pipeline de analytics.

### Ativar o KV no Worker de produção

```sh
npx wrangler kv namespace create KX_METRICS
```

Depois adicione o binding ao Worker `releases` (painel da Cloudflare ou `wrangler.jsonc` equivalente usado naquele Worker):

```jsonc
"kv_namespaces": [
  { "binding": "KX_METRICS", "id": "<id retornado pelo comando acima>" }
]
```

O `wrangler.jsonc` deste repositório é **apenas de preview/staging** (`kyroshix-preview`) e publica só assets estáticos — ele não executa `cloudflare/worker.mjs`. Por isso a API de métricas não existe no preview do Workers Builds; a página cai no fallback local. Para ter a API também no preview, publique um Worker script separado (com o mesmo handler de métricas) e vincule o KV a ele. Não adicione `main` ao `wrangler.jsonc` atual sem antes validar o build do preview.

## Publicação

1. Gere o ZIP completo: `python3 scripts/export-pages.py dist.zip --origin https://releases.kyroshixcorp.workers.dev`.
2. Gere o patch do Worker: `python3 scripts/export-worker.py dist.zip cloudflare/deploy`.
3. Publique **primeiro o ZIP** (assets) e depois o módulo com `keep_assets: true`, ou então publique somente o ZIP completo. Um upload de módulo com `keep_assets: true` **não cria arquivos novos**: `spatial.css` e `spatial.js` precisam entrar pelo ZIP.
4. Confira no navegador: `GET /spatial.css` e `GET /spatial.js` devem responder `200` com os content types corretos.

`npm run test:worker` valida as rotas de documento, os dois novos arquivos, HEAD/ETag e as respostas dos endpoints de métricas sem KV. O teste visual de layout e interação (11 larguras de 1920 px a 360 px, conta, planos, comentários, player e insights) roda com Chromium em `.test-artifacts/spatial-webui.cjs`.

## Limites conhecidos

- Contas e planos não são autenticação de produção; são locais e demonstrativos.
- Os números de "curtidas" e "reposts" exibidos nas faixas são valores editoriais do catálogo, não métricas de audiência. As métricas de audiência (plays, ouvintes, comentários) são medidas.
- As duas primeiras capas são referências visuais de terceiros, indicadas na interface; o áudio é do catálogo KYROSHIX.
- O painel "Sentiment Rate" é um indicador derivado de interações locais (curtidas, reposts, comentários, plays), não uma análise de sentimento de texto.
