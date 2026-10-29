// Fallback versionado para o Worker de preview (wrangler.jsonc).
//
// Em produção, scripts/export-worker.py GERA este arquivo com FILES e
// APP_ROUTES reais (HTML/JS embutidos + rotas de documento). No preview,
// usamos listas vazias: o Worker trata somente as rotas /api/* e delega
// todo o resto para o binding ASSETS, que serve dist/ com SPA fallback.
//
// NÃO apague: sem este arquivo o import em worker.mjs falha no build do preview.
export const FILES = {};
export const APP_ROUTES = [];
