#!/usr/bin/env python3
"""Test helper: snapshot one Sleeper user's dynasty leagues (the same public API calls the page makes) so the League
tools can be checked against a real league offline. Runs only by hand in GitHub Actions; the result goes to a throwaway branch
(test-snapshot), never to main. Usage: python3 tools/sleeper_snapshot.py <username> <out.json>"""
import json, sys, time, urllib.request
user, outF = sys.argv[1], sys.argv[2]
def get(path):
    url = 'https://api.sleeper.app/v1/' + path
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'dynasty-value-board'}), timeout=30) as r: return json.load(r)
        except Exception as e: print('retry', path, e); time.sleep(2)
    return None
out = {}
def keep(path):
    out[path] = get(path); return out[path]
st = keep('state/nfl'); season = st['season']; u = keep('user/' + user); uid = u['user_id']
for yr in (season, str(int(season) - 1)):
    for L in keep(f'user/{uid}/leagues/nfl/{yr}') or []:
        lid = L['league_id']
        keep(f'league/{lid}'); keep(f'league/{lid}/rosters'); keep(f'league/{lid}/users'); keep(f'league/{lid}/traded_picks')
        for w in range(0, 19): keep(f'league/{lid}/transactions/{w}')
        prev = L.get('previous_league_id')
        if prev and prev != '0':
            keep(f'league/{prev}'); keep(f'league/{prev}/rosters'); keep(f'league/{prev}/users'); keep(f'league/{prev}/traded_picks')
            for w in range(0, 19): keep(f'league/{prev}/transactions/{w}')
json.dump(out, open(outF, 'w'))
print(len(out), 'calls saved')
