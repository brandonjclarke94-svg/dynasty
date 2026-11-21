#!/usr/bin/env python3
"""Build the public website from the board: index.html (the page) and data.json (a snapshot of the board's storage).
Usage: python3 make_site.py <page.html | -> <dir with board/*.json from ArtifactData list out_dir> <site dir>
   Pass - as the page to refresh only data.json (the scheduled update does this)."""
import json, os, sys
page, dbdir, site = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(site, exist_ok=True)
import hashlib
if page != '-':
  body = open(page, encoding='utf-8').read()
  # Guard: index.html may have been edited directly (e.g. a redesign merged on GitHub). Refuse to overwrite a page whose
  # body isn't the one this script last wrote, unless --force; fold such edits into the source page first.
  import hashlib
  ip, hp = os.path.join(site, 'index.html'), os.path.join(site, '.page_hash')
  if os.path.exists(ip) and os.path.exists(hp) and '--force' not in sys.argv:
    cur = open(ip, encoding='utf-8').read(); i = cur.find('</head><body>'); j = cur.rfind('</body></html>')
    curb = cur[i+len('</head><body>'):j] if i >= 0 and j >= 0 else cur
    if hashlib.sha256(curb.encode()).hexdigest() != open(hp).read().strip():
      raise SystemExit('index.html was changed outside make_site.py (e.g. a redesign). Merge those changes into the page source first, or pass --force.')
  html = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="description" content="Dynasty fantasy football rankings built from real game logs: values for any league format, picks, trade calculator.">'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>' + body + '</body></html>')
  open(os.path.join(site, 'index.html'), 'w', encoding='utf-8').write(html)
  open(os.path.join(site, '.page_hash'), 'w').write(hashlib.sha256(body.encode()).hexdigest())
data = {}
for k in ['QB', 'RB', 'WR', 'TE', 'meta', 'adj', 'defaults', 'classes', 'injuries', 'outlook', 'ecr0', 'slmap']:
    p = os.path.join(dbdir, k + '.json')
    if os.path.exists(p):
        j = json.load(open(p, encoding='utf-8')); data[k] = j.get('data', j) if isinstance(j, dict) and 'data' in j and 'id' in j else j
json.dump(data, open(os.path.join(site, 'data.json'), 'w', encoding='utf-8'), separators=(',', ':'))
# comparable-players library (large, rarely changes): stored in parts comps1..N, published as one file loaded after the board
parts = []
for i in range(1, 9):
    cp = os.path.join(dbdir, 'comps%d.json' % i)
    if os.path.exists(cp):
        j = json.load(open(cp, encoding='utf-8')); parts.append(j.get('data', j) if isinstance(j, dict) and 'data' in j and 'id' in j else j)
parts = [p for p in parts if p.get('v') == 2]
if parts and len(parts) == parts[0].get('of') and len({p.get('built') for p in parts}) == 1:
    parts.sort(key=lambda p: p['part']); names, rows = [], []
    for p in parts:
        off = len(names); names += p.get('names', []); rows += [r[:8] + [r[8] + off] + r[9:] for r in p.get('rows', [])]
    json.dump({'v': 2, 'R': parts[0].get('R'), 'names': names, 'rows': rows}, open(os.path.join(site, 'comps.json'), 'w', encoding='utf-8'), separators=(',', ':'))
open(os.path.join(site, '.nojekyll'), 'w').write('')
print('site built:', {k: len(json.dumps(v)) for k, v in data.items()})
