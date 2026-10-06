#!/usr/bin/env python3
"""Export only public static files for Cloudflare Pages Direct Upload."""
import argparse
import re
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument('output', type=Path)
parser.add_argument('--origin', default='')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'dist'
origin = args.origin.rstrip('/')
if origin:
    url = urlsplit(origin)
    if url.scheme != 'https' or not url.netloc or url.path or url.query or url.fragment or url.username:
        parser.error('--origin must be an HTTPS origin without a path or credentials')
files = sorted(p for p in root.rglob('*') if p.is_file())
assert len(files) + 2 <= 1000, 'Direct Upload file limit exceeded'
args.output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(args.output, 'w', compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for file in files:
        name = file.relative_to(root).as_posix()
        assert not file.is_symlink(), f'Symlinks are not supported: {name}'
        data = file.read_bytes()
        assert len(data) <= 25 * 1024 * 1024, f'Asset exceeds 25 MiB: {name}'
        if name == 'index.html':
            html = data.decode('utf-8')
            html = html.replace('<meta name="robots" content="noindex,nofollow">', '<meta name="robots" content="index,follow">')
            html = re.sub(r'<meta property="og:(?:image|url)"[^>]*>', '', html)
            if origin:
                html = html.replace('</head>', f'<meta property="og:url" content="{origin}/"><meta property="og:image" content="{origin}/assets/hero.webp"></head>')
            data = html.encode('utf-8')
            assert b'chatgpt.site' not in data
        archive.writestr(name, data)
    archive.writestr('_headers', '''/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin-allow-popups

/
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/*.js
  Cache-Control: no-cache

/*.css
  Cache-Control: no-cache

/auth-config.json
  Cache-Control: no-store

/community-config.json
  Cache-Control: no-store

/video-config.json
  Cache-Control: no-store
''')
    archive.writestr('robots.txt', 'User-agent: *\nAllow: /\n')
with ZipFile(args.output) as archive:
    assert archive.testzip() is None, 'ZIP integrity failed'
    assert 'index.html' in archive.namelist()
    assert all(not n.startswith(('.git/', '.openai/')) for n in archive.namelist())
print(f'{args.output}: {args.output.stat().st_size} bytes; {len(files) + 2} files; verify Firebase providers and authorized domain before announcing live login.')
