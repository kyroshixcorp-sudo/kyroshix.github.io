# Publicar a atualização no Worker releases

A homepage Spatial UI também pode ser publicada como um módulo do Worker,
preservando os assets estáticos existentes. O módulo entrega os arquivos públicos
de interface (incluindo `index.html`, `spatial-ui.html`, `spatial.css`,
`spatial.js` e `legacy.html`) e
encaminha caminhos como `/inicio` e `/track/remember` para a página principal.
As regras vêm de `cloudflare/_redirects`, que `export-pages.py` injeta no ZIP
(como `_redirects`) para gerar `APP_ROUTES`. Assim o arquivo não fica em `dist/`
e não interfere no preview do Wrangler.
Imagens, MP3 e configurações JSON de conta continuam no armazenamento estático.
Os caminhos listados em `metadata.json` passam pelo Worker e contam como
invocações no plano da Cloudflare. As mídias continuam sendo servidas diretamente
pelo serviço de assets. As rotas de páginas são geradas do `_redirects` do ZIP,
sem substituir requisições de mídia ou configuração.

**Atenção aos novos assets:** `/assets/spatial-room.jpg`, `/spatial.css` e
`/spatial.js` foram adicionados ao `dist/`. O upload somente do módulo
(`metadata.json` + `worker.mjs` + `patches.mjs`) usa `keep_assets: true` e
**não adiciona arquivos novos**. Publique o ZIP completo gerado por
`export-pages.py` antes (ou em vez disso) para enviar imagem, CSS e JS. Sem a
imagem, a homepage continua funcionando com gradientes de fallback; sem
`spatial.css`/`spatial.js`, a página fica sem estilo e sem interação.

**Métricas agregadas (opcional).** `cloudflare/worker.mjs` expõe
`GET /api/metrics`, `POST /api/metrics/play` e `POST /api/metrics/presence`.
Eles exigem o namespace KV `KX_METRICS` vinculado ao Worker `releases`. Sem o
binding, as rotas respondem `ok:false` e a Spatial WebUI usa os contadores reais
medidos no próprio navegador. Consulte [spatial-webui.md](spatial-webui.md).

```sh
python3 scripts/export-pages.py ../exports/KYROSHIX-Cloudflare-Pages.zip --origin https://releases.kyroshixcorp.workers.dev
python3 scripts/export-worker.py ../exports/KYROSHIX-Cloudflare-Pages.zip ../exports/worker-release
```

Envie `metadata.json`, `worker.mjs` e `patches.mjs` como multipart/form-data ao
endpoint de upload do Worker `releases`. O metadado `keep_assets: true` preserva
as mídias. Não use este método em um Worker vazio. Não substitua as configurações
de contas ao publicar somente uma atualização visual.

Uma próxima publicação pelo ZIP completo pode substituir esse módulo e voltar
à entrega inteiramente estática. Mantenha os arquivos de `dist/` no GitHub como
fonte da aplicação. Os módulos de publicação são gerados do ZIP público.

Documentação oficial:

- https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
