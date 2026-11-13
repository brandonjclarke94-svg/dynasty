#!/usr/bin/env python3
"""Build the public website from the board: index.html (the page) and data.json (a snapshot of the board's storage).
Usage: python3 make_site.py <page.html> <dir with board/*.json from ArtifactData list out_dir> <site dir>"""
import json, os, sys
page, dbdir, site = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(site, exist_ok=True)
body = open(page, encoding='utf-8').read()
html = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="description" content="Dynasty fantasy football rankings built from real game logs: values for any league format, picks, trade calculator.">'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>' + body + '</body></html>')
open(os.path.join(site, 'index.html'), 'w', encoding='utf-8').write(html)
data = {}
for k in ['QB', 'RB', 'WR', 'TE', 'meta', 'adj', 'defaults', 'classes', 'injuries', 'outlook']:
    p = os.path.join(dbdir, k + '.json')
    if os.path.exists(p):
        j = json.load(open(p, encoding='utf-8')); data[k] = j.get('data', j) if isinstance(j, dict) and 'data' in j and 'id' in j else j
json.dump(data, open(os.path.join(site, 'data.json'), 'w', encoding='utf-8'), separators=(',', ':'))
open(os.path.join(site, '.nojekyll'), 'w').write('')
print('site built:', {k: len(json.dumps(v)) for k, v in data.items()})
