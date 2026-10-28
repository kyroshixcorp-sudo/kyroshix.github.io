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

## 2. Arquivos novos/alterados

| Arquivo | Papel |
| --- | --- |
| `dist/index.html`, `dist/spatial-ui.html` | shell com topbar, 3 colunas, mini player, nav mobile, diálogos de conta/código/planos/player/bastidores |
| `dist/spatial.css` | layout glass, breakpoints, novas seções, compactação mobile e ícones centralizados |
| `dist/spatial.js` | catálogo, player, métricas, contas, planos Stripe, comentários, chat, perfil, admin, vídeos, anúncios |
| `dist/app-config.json` | **configuração pública** (sem segredos): dono, flags, poll, lista de vídeos, publisher ID |
| `cloudflare/worker.mjs` | `/api/metrics`, `/api/auth/*`, `/api/admin/*`, `/api/billing/*`, `/api/catalog`, `/api/videos`, `/api/chat`, `/api/profile` |
| `scripts/export-worker.py` | inclui as rotas `/api/*` em `run_worker_first` e aceita `--kv-data-id` / `--kv-metrics-id` |
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
2. **Settings → Authorized domains**: adicione `releases.kyroshixcorp.workers.dev` e o domínio de preview.
3. `app-config.json` → `"auth": { "google": true }`.

O botão "Continuar com Google" usa `signInWithPopup`. Se o provedor ou o domínio não estiverem autorizados, a mensagem de erro do Firebase aparece no diálogo — não há fallback falso.

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
- Os IDs dos vídeos ficam em `app-config.json` (`youtube.videos`) ou no KV, editáveis pelo dono.

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

A bateria Chromium em `.test-artifacts/spatial-v2.cjs` cobre **103 verificações**: layout em 12 larguras (1920 → 360 px), ícones compactos, página de planos sem cartão falso, Google/código, perfil, vídeos com consentimento, chat, painel do dono, edição de catálogo, play real, seek na waveform, gating de EQ e comentários reais.

## 6. Limites honestos

- **Não há como "ligar a monetização" por código.** AdSense depende de aprovação do Google e tráfego.
- **Não há como enviar e-mail sem provedor.** Resend (ou equivalente) precisa de chave e domínio verificado.
- **Não há como cobrar sem Stripe/Mercado Pago.** O código do checkout e do webhook está pronto; a conta e os preços são seus.
- **Chat e catálogo são "quase tempo real"** (polling de 4 s sobre KV, que é eventualmente consistente). Para presença/typing em tempo real de verdade, use Durable Objects com WebSocket.
- **Contas locais não são autenticação de produção.** O plano e o perfil no `localStorage` podem ser alterados pelo próprio visitante; o Worker é a única fonte de verdade para pagamentos e publicação.
- As capas são servidas de `assets/covers.webp` (sprite) e `assets/hero.webp`. Faixas novas exigem URL `https` de imagem; o Worker valida isso antes de publicar.
