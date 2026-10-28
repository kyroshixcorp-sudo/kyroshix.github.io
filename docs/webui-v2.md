# Spatial WebUI v2 — configuração real

Guia da versão 2 da homepage. **Nada aqui é simulado:** cada serviço que depende de infraestrutura externa responde `not_configured` até você configurar as credenciais. O que funciona sem credenciais (player, catálogo local, perfil local, layout, métricas locais) funciona de verdade.

## 1. O que mudou em relação à v1

| Item | v1 | v2 |
| --- | --- | --- |
| Página de assinatura | diálogo estreito com cartão de mentira | página dedicada `/planos`, 3 colunas no desktop e 1 no mobile, sem campos de cartão no site |
| Cobrança | "demonstração", plano salvo no `localStorage` | Stripe Checkout no servidor + webhook com verificação de assinatura |
| Conta | só e-mail/senha local | e-mail/senha + **Google** (Firebase) + **código de 6 dígitos por e-mail** a cada acesso |
| Dono | inexistente | `kyroshixcorp@gmail.com` com Premium vitalício e painel de edição do catálogo, capas, descrições e vídeos |
| Catálogo | 6 faixas, 2 com capa gerada em CSS | **apenas 4 faixas com cover art publicada** |
| Comentários | exemplos fictícios com selo `EXEMPLO` | vazios no início, só mensagens reais de contas autenticadas |
| Chat | — | salas estilo Telegram/WhatsApp, mensagens no KV |
| Vídeos | — | página com embeds do YouTube sob consentimento e aviso honesto sobre DRM |
| AdSense | — | slots que só aparecem com publisher ID aprovado e plano gratuito |
| Perfil | — | nome, bio, avatar, cor de destaque e tema |
| Mobile | ícones de 19 px, 4 itens na nav | ícones de 16 px (14 px em 360 px), 5 itens, cards empilhados, zero overflow de 360 a 1920 px |

## 1.1 Diagnóstico: por que o dono/assinatura/vídeos falhavam (corrigido)

**Causa raiz comum.** No preview da Cloudflare, `wrangler.jsonc` usa apenas `assets` com
`not_found_handling: single-page-application`. Qualquer rota `/api/*` — que só existe no
módulo Worker — devolvia **o `index.html` com status 200**. O `api()` fazia
`response.json().catch(() => ({}))` e interpretava isso como uma resposta vazia, sem
`ok` e sem `reason`. Consequências:

| Sintoma | Causa | Correção |
| --- | --- | --- |
| Login com `kyroshixcorp@gmail.com` não ativava o dono | `isOwner()` exigia `plan === 'owner'`, que só era concedido depois de um código por e-mail impossível de enviar | O e-mail do dono recebe **Premium vitalício no próprio login/cadastro** (`createAccount`, `loginAccount`, `finalizeAccess` e normalização no boot). O painel abre em modo local com aviso; publicar no servidor continua exigindo token verificado |
| Benefícios não liberavam | `can()` dependia do plano | `plan: 'owner'` entra em todos os `BENEFITS` — EQ, download, HQ, velocidade, presets e sem anúncios |
| Assinatura "não funcionava" e o erro era genérico | `startCheckout` recebia `{}` e mostrava "Não foi possível iniciar o pagamento" | `api()` detecta HTML e classifica `worker_missing`; a página de planos mostra **Estado dos serviços** + checklist do que falta, vindo de `/api/health` |
| Vídeos não apareciam | `app-config.json` tinha `youtube.videos: []` e o frontend nunca consultava `/api/videos` | Catálogo com os **16 vídeos reais** da playlist oficial `PLHMuU4IdndW8`; `syncVideos()` mescla config + KV + edições locais |
| "Não sincroniza" | `/api/videos` era ignorado no boot | Novo `/api/videos/sync` lê o **feed Atom público do canal** (`UCGzRDl1ps7nPbgQybBv2J4Q`), sem chave de API, e grava no KV. Botão **Sincronizar** + polling |
| DRM "não aparece" | `video-config.json` com `drmEnabled:false` e nenhuma explicação no site | A página de vídeos lê o status e explica que **embed do YouTube não pode receber DRM**; `/api/drm/status` reporta os servidores de licença configurados |

**Regra importante:** nenhuma dessas correções simula pagamento ou e-mail. Quando o Worker
não está publicado, a interface diz isso explicitamente e mantém os dados locais.

## 2. Arquivos novos/alterados

| Arquivo | Papel |
| --- | --- |
| `dist/index.html`, `dist/spatial-ui.html` | shell com topbar, 3 colunas, mini player, nav mobile, diálogos de conta/código/planos/player/bastidores |
| `dist/spatial.css` | layout glass, breakpoints, novas seções, compactação mobile e ícones centralizados |
| `dist/spatial.js` | catálogo, player, métricas, contas, planos Stripe, comentários, chat, perfil, admin, vídeos, anúncios |
| `dist/app-config.json` | **configuração pública** (sem segredos): dono, flags, poll, lista de vídeos, publisher ID |
| `cloudflare/worker.mjs` | `/api/metrics`, `/api/auth/*`, `/api/admin/*`, `/api/billing/*`, `/api/catalog`, `/api/videos`, `/api/videos/sync`, `/api/chat`, `/api/profile`, `/api/health`, `/api/drm/status` |
| `scripts/export-worker.py` | inclui as rotas `/api/*` (incluindo health, sync e DRM) em `run_worker_first` e aceita `--kv-data-id` / `--kv-metrics-id` |
| `scripts/export-pages.py` | `app-config.json` com `Cache-Control: no-store` |
| `tests/worker.mjs` | cobre as novas rotas, recusa de webhook sem assinatura, escrita de catálogo sem token e chat no KV |

## 3. Configuração na Cloudflare (passo a passo)

### 3.1 Namespaces KV

```sh
npx wrangler kv namespace create KX_DATA
npx wrangler kv namespace create KX_METRICS
```

Anote os IDs. Ao gerar o módulo do Worker `releases`:

```sh
python3 scripts/export-pages.py exports/site.zip --origin https://releases.kyroshixcorp.workers.dev
python3 scripts/export-worker.py exports/site.zip exports/worker \
  --kv-data-id <ID_KX_DATA> --kv-metrics-id <ID_KX_METRICS>
```

Isso grava os bindings em `metadata.json`. Se você publicar pelo painel, adicione os dois bindings manualmente em **Settings → Variables → KV Namespace Bindings**.

- `KX_DATA`: códigos de acesso, tokens de dono, catálogo, vídeos, perfis, mensagens do chat e assinaturas.
- `KX_METRICS`: reproduções por faixa e presença (ouvintes simultâneos).

Sem `KX_DATA`, `/api/catalog`, `/api/chat` etc. respondem `not_configured` e a interface salva os dados **apenas neste navegador**, com aviso explícito. Sem `KX_METRICS`, as métricas continuam reais, mas locais.

### 3.2 Segredos (nunca no repositório, nunca no chat)

Configure em **Workers & Pages → releases → Settings → Variables → Secrets** ou com `wrangler secret put NAME`:

| Secret | Para que serve |
| --- | --- |
| `STRIPE_SECRET_KEY` | criar Checkout Sessions e confirmar pagamentos |
| `STRIPE_PRICE_PRO` | ID do preço recorrente do plano Pro (`price_...`) |
| `STRIPE_PRICE_STUDIO` | ID do preço recorrente do plano Studio |
| `STRIPE_WEBHOOK_SECRET` | verificar a assinatura `Stripe-Signature` (`whsec_...`) |
| `RESEND_API_KEY` | enviar os códigos de acesso por e-mail |
| `EMAIL_FROM` | remetente verificado, ex.: `KYROSHIX <noreply@seudominio.com>` |
| `ADMIN_EMAIL` | `kyroshixcorp@gmail.com` (padrão) |
| `DRM_LICENSE_WIDEVINE`, `DRM_LICENSE_PLAYREADY`, `DRM_LICENSE_FAIRPLAY` | URLs HTTPS do serviço de licenças, **apenas se** você tiver mídia HLS/DASH criptografada. Não se aplica a vídeos do YouTube. |

No Stripe, crie os dois produtos/preços recorrentes e configure o webhook apontando para `https://releases.kyroshixcorp.workers.dev/api/billing/webhook`, com os eventos `checkout.session.completed`, `customer.subscription.updated` e `customer.subscription.deleted`.

Depois de configurar, mude `dist/app-config.json`:

```json
"billing": { "provider": "stripe", "enabled": true },
"auth": { "google": true, "emailCode": true }
```

**Importante:** `enabled` é apenas uma flag de interface. A segurança está no Worker — ele valida o preço, a sessão, a assinatura do webhook e o token do dono. Nunca confie no plano gravado no navegador para liberar conteúdo protegido; use `/api/billing/status?email=...` no servidor.

### 3.3 Login com Google (Firebase)

O projeto já tem `dist/auth-config.json` com `apiKey`, `authDomain`, `projectId` e `appId` (são valores públicos). Falta apenas:

1. Firebase Console → **Authentication → Sign-in method → Google → Enable**.
2. **Settings → Authorized domains**: `releases.kyroshixcorp.workers.dev` e `kyroshix-preview.kyroshixcorp.workers.dev` já estão autorizados. Autorize também o hostname exato de cada preview por branch, por exemplo `arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev` — veja [firebase-preview-domain.md](firebase-preview-domain.md).
3. `app-config.json` → `"auth": { "google": true }`.

O botão "Continuar com Google" usa `signInWithPopup`. Se o domínio não estiver autorizado, a WebUI mostra o hostname exato que precisa ser adicionado no Firebase — não há fallback falso. Para aplicar a mudança sem entrar no Console, use `npm run authorize:firebase -- --apply` com seu `GOOGLE_OAUTH_TOKEN` (detalhes no guia).

### 3.4 Código de acesso por e-mail a cada login

Com `RESEND_API_KEY` + `EMAIL_FROM` configurados e `"auth.emailCode": true`:

- `POST /api/auth/code` gera 6 dígitos, guarda apenas o **hash** no KV (TTL 10 min) e envia por e-mail via Resend.
- `POST /api/auth/verify` confere o código e o remove (uso único).
- O dono usa `POST /api/admin/code` + `POST /api/admin/verify`; sucesso devolve um token de 8 h que autoriza escritas no catálogo.

Sem o provedor, o diálogo mostra **"Verificação por e-mail indisponível: configure RESEND_API_KEY"** e mantém a conta local — sem fingir que o e-mail foi enviado.

### 3.5 Conta do dono e edição em tempo real

1. Crie/entre com `kyroshixcorp@gmail.com`.
2. Abra **Painel do dono** → **Verificar acesso** → confirme o código recebido.
3. A conta recebe `plan: "owner"` (Premium vitalício) e o token de administrador.
4. No painel, edite título, artista, descrição e URL da capa de cada faixa; adicione ou remova músicas (toda faixa precisa de capa `https`); publique vídeos do YouTube pelo ID de 11 caracteres.
5. **Publicar alterações** grava no KV `KX_DATA`. Os visitantes recebem o novo catálogo por polling a cada 4 s (`realtime.pollMs`), sem recarregar a página.

Sem token verificado, o painel entra em **modo local**: você edita e visualiza no seu navegador, mas o Worker recusa a publicação (403). O aviso fica visível no topo do painel. Isso evita que qualquer visitante altere o site dos outros.

### 3.6 Google AdSense

Coloque seu publisher ID aprovado e o slot ID em `dist/app-config.json`:

```json
"ads": { "enabled": true, "publisherId": "ca-pub-0000000000000000", "slotId": "1234567890" }
```

`ads.js` só carrega o script do AdSense quando o ID é válido, e `spatial.js` só renderiza o slot para usuários sem plano Pro/Studio. **Código não gera receita:** é necessário ter conta AdSense aprovada, o domínio revisado pelo Google e tráfego real. Nunca prometa monetização antes da aprovação.

### 3.7 Vídeos do YouTube e DRM

- O embed usa `youtube-nocookie.com` e só é inserido depois do clique em **Assistir** (consentimento).
- **Não existe DRM sobre embed do YouTube.** O YouTube controla o player dele. DRM Widevine/PlayReady/FairPlay só se aplica a arquivos próprios empacotados em HLS/DASH com servidor de licenças — isso está implementado em `dist/drm.js` para mídia KYROSHIX e exige `video-config.json` com `drmEnabled` e um servidor de licenças HTTPS. Veja `docs/video-drm.md`.
- Os **16 vídeos reais** do canal `@KYROSHIXCORP` estão em `dist/app-config.json` (`youtube.videos`), com `trackId` ligando quatro deles às faixas do catálogo. São dados públicos da playlist oficial `PLHMuU4IdndW8`, não conteúdo inventado.
- `GET /api/videos/sync` busca `https://www.youtube.com/feeds/videos.xml?channel_id=UCGzRDl1ps7nPbgQybBv2J4Q` e atualiza o KV. É um feed público: não precisa de chave de API nem de OAuth. Se o YouTube recusar o feed, o endpoint responde `feed_error` e o site mantém o catálogo publicado.
- `GET /api/health` devolve apenas booleanos (`worker`, `stripe`, `email`, `kv`, `drm`, `metrics`) e o ID público do canal — nunca segredos. A página de planos usa isso para montar o checklist de configuração.
- `GET /api/drm/status` lê `DRM_LICENSE_WIDEVINE`, `DRM_LICENSE_PLAYREADY` e `DRM_LICENSE_FAIRPLAY` do Worker e informa se há servidor de licenças. Para ativar: mídia HLS/DASH já criptografada, essas variáveis com URLs HTTPS e `dist/video-config.json` com `drmEnabled: true`. Veja `docs/video-drm.md`.

## 4. Publicação

O upload apenas do módulo (`metadata.json` + `worker.mjs` + `patches.mjs`) usa `keep_assets: true` e **não cria arquivos novos**. Publique antes o ZIP completo para enviar `spatial.css`, `spatial.js`, `app-config.json`, `ads.js` e os assets. Confira no navegador:

```sh
curl -I https://releases.kyroshixcorp.workers.dev/spatial.js
curl -I https://releases.kyroshixcorp.workers.dev/app-config.json
curl    https://releases.kyroshixcorp.workers.dev/api/catalog
```

O `wrangler.jsonc` deste repositório continua sendo **apenas de preview** (`kyroshix-preview`, somente assets). Ele não executa `cloudflare/worker.mjs`; por isso, no preview do Workers Builds, as rotas `/api/*` não existem e a interface usa os dados locais. Para testar as APIs no preview, publique um Worker script separado com o mesmo `worker.mjs` e vincule os KVs.

## 5. Validação

```sh
npm run test:worker     # rotas, HEAD/ETag/405, /api/*, webhook, KV e chat
npm run test:access     # regressões de acesso
node --check dist/spatial.js
npx wrangler versions upload --dry-run
python3 scripts/export-pages.py /tmp/site.zip
python3 scripts/export-worker.py /tmp/site.zip /tmp/worker --kv-data-id ID --kv-metrics-id ID
```

A bateria Chromium em `.test-artifacts/spatial-v2.cjs` cobre **103 verificações** de layout e fluxos da v2. A bateria `.test-artifacts/spatial-fixes.cjs` cobre **46 verificações** das correções desta seção em **dois cenários** (Worker ativo e preview estático com SPA fallback): login do dono, Premium, benefícios, painel, diagnóstico de assinatura, 16 vídeos reais, consentimento, DRM, sincronização e ausência de erros de JS. `tests/worker.mjs` valida `/api/health`, `/api/drm/status`, o parser do feed Atom e a persistência no KV.

## 6. Limites honestos

- **Não há como "ligar a monetização" por código.** AdSense depende de aprovação do Google e tráfego.
- **Não há como enviar e-mail sem provedor.** Resend (ou equivalente) precisa de chave e domínio verificado.
- **Não há como cobrar sem Stripe/Mercado Pago.** O código do checkout e do webhook está pronto; a conta e os preços são seus.
- **Chat e catálogo são "quase tempo real"** (polling de 4 s sobre KV, que é eventualmente consistente). Para presença/typing em tempo real de verdade, use Durable Objects com WebSocket.
- **Contas locais não são autenticação de produção.** O plano e o perfil no `localStorage` podem ser alterados pelo próprio visitante; o Worker é a única fonte de verdade para pagamentos e publicação.
- As capas são servidas de `assets/covers.webp` (sprite) e `assets/hero.webp`. Faixas novas exigem URL `https` de imagem; o Worker valida isso antes de publicar.
