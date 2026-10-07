#!/usr/bin/env python3
"""Prepare a small Worker update while retaining the current static assets."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from zipfile import ZipFile

DEFAULT_FILES = [
    'index.html', 'app.js', 'account.css', 'auth-controller.js', 'experience.css', 'atelier.css', 'listening-room.js',
    'music-player.js', 'video-player.js', 'platform.js', 'router.js', 'theme.js',
    'themes.css', 'auth.js', 'data-client.js', 'drm.js',
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
routes = sorted(set(files) | set(app_routes) | {'/'})
metadata = {
    'main_module': 'worker.mjs', 'compatibility_date': '2026-10-06',
    'keep_assets': True,
    'assets': {'config': {'run_worker_first': routes}},
    'bindings': [{'name': 'ASSETS', 'type': 'assets'}],
    'annotations': {
        'workers/message': 'KYROSHIX Releases 4.4: readable URLs and light/dark theme',
        'workers/tag': 'kyroshix-4.4',
    },
}
(args.output / 'metadata.json').write_text(
    json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'output': str(args.output), 'routes': routes,
                  'text_bytes': sum(f['size'] for f in files.values())}))
