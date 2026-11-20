#!/usr/bin/env python3
"""Fetch FantasyCalc dynasty trade values (from real trades) for each league shape and save fc.json:
{at, v:{"<qbs>-<teams>-<ppr>": {sleeperId: value}}}. Runs in GitHub Actions (see .github/workflows/fantasycalc.yml)."""
import json, time, urllib.request
out = {'at': int(time.time() * 1000), 'src': 'FantasyCalc (fantasycalc.com), values from real dynasty trades', 'v': {}}
sample = None
for qbs in (1, 2):
    for teams in (10, 12, 14):
        for ppr in (0, 0.5, 1):
            url = f'https://api.fantasycalc.com/values/current?isDynasty=true&numQbs={qbs}&numTeams={teams}&ppr={ppr}'
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'dynasty-value-board'}), timeout=30) as r:
                        data = json.load(r); break
                except Exception as e:
                    print('retry', url, e); time.sleep(5); data = None
            if not data: continue
            if sample is None: sample = data[0]
            m = {}
            for x in data:
                p = x.get('player') or {}
                sid, val = p.get('sleeperId'), x.get('value')
                if sid and val and p.get('position') in ('QB', 'RB', 'WR', 'TE'): m[str(sid)] = int(val)
            out['v'][f'{qbs}-{teams}-{ppr}'] = m
            time.sleep(1)
print('sample item:', json.dumps(sample)[:600] if sample else None)
print({k: len(v) for k, v in out['v'].items()})
if out['v']: json.dump(out, open('fc.json', 'w'), separators=(',', ':'))
else: raise SystemExit('no values fetched')
