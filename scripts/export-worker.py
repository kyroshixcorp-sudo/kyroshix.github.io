#!/usr/bin/env python3
"""Prepare a small Worker update while retaining the current static assets."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from zipfile import ZipFile

DEFAULT_FILES = [
    # Homepage Spatial WebUI, alias /spatial-ui.html e assets do módulo.
    'index.html', 'spatial-ui.html', 'spatial.css', 'spatial.js', 'legacy.html',
    # Páginas estáticas continuam acessíveis pelos links do rodapé.
    'sobre.html', 'contato.html', 'privacidade.html', 'termos.html', 'direitos-autorais.html',
    # Módulos mantidos para o app legado e para os testes existentes.
    'app.js', 'experience.css', 'atelier.css', 'listening-room.js',
    'music-player.js', 'video-player.js', 'platform.js', 'router.js', 'theme.js',
    'themes.css', 'auth.js', 'auth-controller.js', 'firebase-client.js',
    'access-policy.js', 'account.css', 'brand-red.css', 'data-client.js', 'drm.js',
]
TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path, help='Public ZIP from export-pages.py')
parser.add_argument('output', type=Path, help='Generated deployment directory')
parser.add_argument('--files', nargs='+', default=DEFAULT_FILES)
parser.add_argument('--kv-data-id', default='', help='ID do namespace KV KX_DATA (catálogo, códigos, chat, assinaturas)')
parser.add_argument('--kv-metrics-id', default='', help='ID do namespace KV KX_METRICS (plays e ouvintes)')
args = parser.parse_args()
files = {}
with ZipFile(args.archive) as archive:
    app_routes = []
    for line in archive.read('_redirects').decode('utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) != 3 or parts[1:] != ['/index.html', '200']:
            parser.error('Only application document proxies are accepted')
        route = parts[0]
        if not route.startswith('/') or route == '/*' or '..' in route or '?' in route:
            parser.error(f'Invalid application route: {route}')
        app_routes.append(route)
    for name in args.files:
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or path.suffix not in TYPES:
            parser.error(f'Only public HTML, JS and CSS paths are accepted: {name}')
        data = archive.read(name)
        files['/' + path.as_posix()] = {
            'body': data.decode('utf-8'), 'type': TYPES[path.suffix],
            'etag': '"' + hashlib.sha256(data).hexdigest() + '"',
            'size': len(data),
        }
args.output.mkdir(parents=True, exist_ok=True)
shutil.copyfile(Path(__file__).resolve().parents[1] / 'cloudflare/worker.mjs',
                args.output / 'worker.mjs')
(args.output / 'patches.mjs').write_text(
    'export const FILES = ' + json.dumps(files, ensure_ascii=True) + ';\n'
    + 'export const APP_ROUTES = ' + json.dumps(app_routes) + ';\n',
    encoding='utf-8')
# As rotas /api/* precisam passar pelo Worker (run_worker_first), senão os
# assets estáticos responderiam 404 antes do script ser executado.
API_ROUTES = [
    '/api/metrics', '/api/metrics/play', '/api/metrics/presence',
    '/api/auth/code', '/api/auth/verify', '/api/admin/code', '/api/admin/verify',
    '/api/billing/checkout', '/api/billing/confirm', '/api/billing/status', '/api/billing/webhook',
    '/api/catalog', '/api/videos', '/api/admin/videos', '/api/profile', '/api/chat',
]
routes = sorted(set(files) | set(app_routes) | set(API_ROUTES) | {'/'})
bindings = [{'name': 'ASSETS', 'type': 'assets'}]
for binding, kv_id in (('KX_DATA', args.kv_data_id), ('KX_METRICS', args.kv_metrics_id)):
    if kv_id:
        bindings.append({'name': binding, 'type': 'kv_namespace', 'namespace_id': kv_id})
metadata = {
    'main_module': 'worker.mjs', 'compatibility_date': '2026-10-07',
    'keep_assets': True,
    'assets': {'config': {'run_worker_first': routes}},
    'bindings': bindings,
    'annotations': {
        'workers/message': 'KYROSHIX Spatial UI: glass homepage on Cloudflare',
        'workers/tag': 'kyroshix-spatial-home',
    },
}
(args.output / 'metadata.json').write_text(
    json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'output': str(args.output), 'routes': routes,
                  'text_bytes': sum(f['size'] for f in files.values())}))

