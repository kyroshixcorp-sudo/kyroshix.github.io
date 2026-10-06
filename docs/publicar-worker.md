# Publicar a atualização no Worker releases

A versão 4.2 também pode ser publicada como um módulo do Worker, preservando
os assets estáticos existentes. O módulo entrega somente os seis arquivos de
texto alterados; imagens, MP3 e configurações de conta continuam no armazenamento
estático. As sete rotas listadas em `metadata.json` passam pelo Worker e contam
como invocações no plano da Cloudflare. As mídias continuam sendo servidas
diretamente pelo serviço de assets.

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
