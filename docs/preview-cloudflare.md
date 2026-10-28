# Preview (staging) na Cloudflare

O arquivo `wrangler.jsonc` publica `dist/` como assets estáticos em um Worker
separado, `kyroshix-preview`. O Worker de produção `releases` não é alterado.
A raiz `/` entrega a homepage Spatial UI (`dist/index.html`); as rotas legíveis
(`/inicio`, `/track/...`) caem no `not_found_handling: single-page-application`
e recebem a mesma página. `cloudflare/_redirects` documenta os rewrites equivalentes
para o Worker de produção.

Este preview publica **somente assets estáticos** (`wrangler.jsonc` não define
`main`). Portanto `/api/metrics` não existe aqui e a Spatial WebUI usa os
contadores reais medidos no navegador. Para agregação entre dispositivos, vincule
o KV `KX_METRICS` ao Worker de produção; veja
[spatial-webui.md](spatial-webui.md).

## Opção A — Workers Builds (recomendada, gratuita)

1. Cloudflare → Workers & Pages → Create → Import a repository →
   `kyroshixcorp-sudo/kyroshix.github.io`.
2. Nome do projeto: `kyroshix-preview` (o mesmo do `wrangler.jsonc`).
3. Build command: vazio. Deploy command: `npx wrangler deploy`.
   Non-production branch deploy command: `npx wrangler versions upload`.
4. Production branch do projeto de preview: `hops/brand-red-preview` (ou outro
   branch de staging). Nunca conecte este fluxo ao Worker `releases`.

## Opção B — manual

```sh
npx wrangler login
npx wrangler deploy        # cria/atualiza kyroshix-preview.<conta>.workers.dev
```

## Acesso restrito

URLs `*.workers.dev` são públicas por padrão. Para restringir, ative Cloudflare
Access no Worker `kyroshix-preview` (Settings → Domains & Routes → workers.dev →
Enable Cloudflare Access). O plano Zero Trust Free cobre até 50 usuários.
Sem essa proteção, trate a URL de preview como pública.

## Custos

Workers Free: 100.000 requisições/dia; requisições a assets estáticos não
contam como invocação quando não há script. Nada aqui exige plano pago.

## Rotas /api/* no preview

O `wrangler.jsonc` publica **somente assets**; o módulo `cloudflare/worker.mjs` roda no Worker `releases` (produção), não no `kyroshix-preview`. Por isso, no preview, uma chamada a `/api/health` ou `/api/billing/checkout` cai no `not_found_handling: single-page-application` e devolve `index.html` com status 200. A WebUI detecta esse HTML e mostra "Worker de APIs não publicado neste endereço" — contas, player e os 16 vídeos do catálogo oficial continuam funcionando localmente. Para exercitar Stripe, código por e-mail e sincronização, publique o Worker script em `releases` com `KX_DATA`/`KX_METRICS` e as rotas `/api/*` em `run_worker_first` (o `export-worker.py` já as inclui).

## Firebase

Para login Google no preview, adicione o domínio do preview em Firebase
Authentication → Settings → Authorized domains. Sem isso, a escuta pública
funciona e o login Google falha com `auth/unauthorized-domain`.
O hostname estável `kyroshix-preview.kyroshixcorp.workers.dev` já está
autorizado; previews por branch precisam do hostname exato. Consulte
[firebase-preview-domain.md](firebase-preview-domain.md) e o script
`npm run authorize:firebase`.

## Quando o Workers Builds falha sem logs

O check `Workers Builds: kyroshix-preview` é executado pela Cloudflare e o log
completo fica no dashboard (exige login na conta). O `gh` só devolve o Build ID.
Para separar problema de código de falha de infraestrutura:

```sh
npx wrangler deploy --dry-run          # valida wrangler.jsonc + 72 assets
npx wrangler versions upload --dry-run
python3 scripts/export-pages.py /tmp/site.zip
python3 scripts/export-worker.py /tmp/site.zip /tmp/worker
npm run test:worker
```

Se os comandos locais passam e o commit não alterou `dist/`, o bundle enviado é
idêntico ao build anterior — a falha é transitória. Reexecute o build no dashboard
(**Workers & Pages → kyroshix-preview → Deployments → Retry**) ou faça um novo
push no branch. Não é necessário alterar `wrangler.jsonc` nem `cloudflare/worker.mjs`:
o preview publica somente `assets.directory`, e o módulo Worker roda em `releases`.

## Rollback

O preview é independente: apagar o Worker `kyroshix-preview` ou voltar o branch
não afeta a produção.
