# Publicar a atualização no Worker releases

A versão 4.5 também pode ser publicada como um módulo do Worker, preservando
os assets estáticos existentes. O módulo entrega os arquivos públicos de interface
e encaminha caminhos como `/inicio` e `/track/remember` para a página principal.
Imagens, MP3 e configurações JSON de conta continuam no armazenamento estático.
Os caminhos listados em `metadata.json` passam pelo Worker e contam como
invocações no plano da Cloudflare. As mídias continuam sendo servidas diretamente
pelo serviço de assets. As rotas de páginas são geradas do `_redirects` do ZIP,
sem substituir requisições de mídia ou configuração.

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
