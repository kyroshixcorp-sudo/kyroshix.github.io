# Preview (staging) na Cloudflare

O arquivo `wrangler.jsonc` publica `dist/` como assets estáticos em um Worker
separado, `kyroshix-preview`. O Worker de produção `releases` não é alterado.
A raiz `/` entrega a homepage Spatial UI (`dist/index.html`); as rotas legíveis
(`/inicio`, `/track/...`) caem no `not_found_handling: single-page-application`
e recebem a mesma página. `cloudflare/_redirects` documenta os rewrites equivalentes
para o Worker de produção.

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

## Firebase

Para login Google no preview, adicione o domínio do preview em Firebase
Authentication → Settings → Authorized domains. Sem isso, a escuta pública
funciona e o login Google falha com `auth/unauthorized-domain`.

## Rollback

O preview é independente: apagar o Worker `kyroshix-preview` ou voltar o branch
não afeta a produção.
