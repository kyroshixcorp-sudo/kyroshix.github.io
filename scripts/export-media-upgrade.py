#!/usr/bin/env python3
"""Export only the additive media migration and its activation guides."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('output',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
args.output.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(args.output,'w',compression=ZIP_DEFLATED) as z:
 for source,name in [('backend/09-media-upgrade.sql','09-media-upgrade.sql'),('docs/atualizacao-glass.md','LEIA-PRIMEIRO.md'),('docs/widevine-glass.md','widevine.md')]:z.write(root/source,name)
print(f'{args.output}: {args.output.stat().st_size} bytes; 3 files')
