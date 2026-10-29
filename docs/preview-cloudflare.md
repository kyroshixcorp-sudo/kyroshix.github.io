# Preview (staging) na Cloudflare

O `wrangler.jsonc` publica o Worker `kyroshix-preview` com assets de `dist/`, separado de `releases`. Rotas `/api/*` explícitas passam primeiro pelo Worker; as demais usam os assets e fallback SPA. O preview é **somente leitura**: autenticação por código, pagamentos e gravações retornam `not_configured`, mesmo que alguém adicione segredos ou bindings acidentalmente. Os contadores continuam locais sem `KX_METRICS`.

O endpoint `/api/videos/sync` pode consultar o feed público do canal ou, se o feed falhar e `YOUTUBE_API_KEY` estiver configurada, a YouTube Data API para a playlist oficial. O resultado no preview é temporário, não sincronizado entre dispositivos nem gravado em KV. Sem chave válida ou com a API indisponível, a WebUI avisa e conserva a lista publicada em `app-config.json`. A consulta à API deve ser validada com uma chave real.

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

`/api/health`, `/api/drm/status` e os endpoints de leitura respondem JSON. O preview não processa cobrança, códigos de acesso nem edição compartilhada. **Não é um ambiente de teste de pagamentos reais.** Para testes de produção são necessários autenticação server-side, políticas seguras, bindings e um provedor configurado.

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

O resultado local não prova a causa de uma falha remota; consulte o log do build no dashboard antes de concluir se é falha de configuração ou infraestrutura. O Worker do preview tem seu próprio módulo e não altera `releases`.

## Rollback

O preview é independente: apagar o Worker `kyroshix-preview` ou voltar o branch
não afeta a produção.
