#!/usr/bin/env python3
"""Export additive migrations and activation instructions, never site assets/secrets."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument('output', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
files = [(p, p.name) for p in sorted((root / 'backend').glob('0[3-7]-*.sql'))]
files.append((root / 'backend/08-exigir-codigo.sql', 'opcional/08-exigir-codigo.sql'))
for source, target in [('upgrade-plataforma.md', 'LEIA-PRIMEIRO.md'),
                       ('codigos-e-provedores.md', 'codigos-e-provedores.md'),
                       ('video-drm.md', 'video-drm.md')]:
    files.append((root / 'docs' / source, target))
core = (root / 'backend/functions/login-code/core.js').read_text()
entry = (root / 'backend/functions/login-code/index.ts').read_text().replace("import { createHandler } from './core.js';\n", '')
(root / 'backend/functions/login-code-dashboard.ts').write_text('// Generated from login-code/core.js + index.ts. Paste as index.ts in the Dashboard.\n' + core + '\n' + entry)
for p in sorted((root / 'backend/functions').rglob('*')):
    if p.is_file():
        files.append((p, 'functions/' + p.relative_to(root / 'backend/functions').as_posix()))
args.output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(args.output, 'w', compression=ZIP_DEFLATED) as archive:
    for source, target in files:
        archive.write(source, target)
with ZipFile(args.output) as archive:
    assert archive.testzip() is None
    assert not any(n.startswith(('01-', '02-')) for n in archive.namelist())
print(f'{args.output}: {args.output.stat().st_size} bytes; {len(files)} files')
