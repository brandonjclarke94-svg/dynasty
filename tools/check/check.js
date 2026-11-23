// Pre-publish check suite for the Dynasty Value Board. Run before every engine change ships:
//   node tools/check/check.js <page.html> [--save] [--bt path/to/bt.json] [--cfg '{"mktw":0.75}']
// Uses the repo's data.json, comps.json and fc.json. Compares against tools/check/baseline.json:
//   FAIL  format rules broken (a QB worth more in 1QB than superflex, a TE worth less with TE premium than without)
//   FAIL  backtest accuracy down more than 0.005 in either format (needs the backtest data file; skipped if absent)
//   FAIL  broken numbers (NaN, negative values, empty board)
//   WARN  top-150 position mix off FantasyCalc by more than 8 at a position; agreement with FantasyCalc down by 0.02+
//   WARN  owner-reported cases (players the owner flagged) that point the wrong way
// --save writes the current numbers as the new baseline (only after a change is accepted).
const fs = require('fs'), vm = require('vm'), path = require('path');
const args = process.argv.slice(2), page = args[0], SAVE = args.includes('--save');
const opt = k => { const i = args.indexOf(k); return i>=0 ? args[i+1] : null; };
const ROOT = path.join(__dirname, '..', '..'), BT = opt('--bt') || process.env.DVB_BT || null, OVER = JSON.parse(opt('--cfg') || '{}');
const h = fs.readFileSync(page, 'utf8'), js = h.slice(h.lastIndexOf('<script>')+8);
const eng = js.slice(0, js.indexOf('const {useState, useEffect, useMemo, useRef} = React;'));
const ctx = {console, Math, Date, JSON, Object, Array, Number, String, isFinite, Set, Map}; vm.createContext(ctx);
vm.runInContext(eng + '\nthis.E={rankAll, DEF, normName, slIndex, fcRankMap:typeof fcRankMap!=="undefined"?fcRankMap:null};', ctx); const E = ctx.E;
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'))), COMPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'comps.json'))), FC = JSON.parse(fs.readFileSync(path.join(ROOT, 'fc.json')));
const now = Date.now(), OV = (D.injuries||{}).rows||{}, OL = (D.outlook||{}).rows||{}, adj = (D.adj||{}).rows||{}, cls = (D.classes||{}).years||{}, meta = D.meta||{};
const players = [];
for(const q of ['QB','RB','WR','TE']) for(const [k,e] of Object.entries((D[q]||{}).rows||{})){ if(e.nf || !e.s || e.age==null) continue;
  players.push({k, n:e.n, pos:q, team:e.team, age:e.age, ad:e.ad||now, dp:e.dp||null, dy:e.dy||null, inj:e.inj, rk:e.rk, s:e.s, ecr:e.ecr||null, ath:e.ath!=null?e.ath:null, comp:e.comp||null, px:e.px||null, fa:e.fa||null, rep:e.rep||null, ovr:OV[k]||null, moved:e.moved||null, out:OL[k]||null, sl:e.sl||null}); }
const Y = (D.prospects||{}).year, pros = ((D.prospects||{}).rows||[]).filter(x=>['QB','RB','WR','TE'].includes(x.pos)).map(x=>({k:'pro_'+E.normName(x.n), n:x.n, pos:x.pos, team:String(Y), age:x.age-((new Date(Y,8,1)-now)/(365.25*864e5)), ad:now, dp:x.pick, dy:Y, s:{}, pro:1}));
const base = {...E.DEF, ...((D.defaults||{}).cfg||{}), ...OVER};
const idx = E.slIndex(players, D.slmap);
const board = (c, ps=players) => { const cc = {...base, ...c}; return E.rankAll(ps, {...cc, __class:cls, __env:meta.env||null, __comps:COMPS, __ecrAt:meta.ecrAt||null, __fcRank:E.fcRankMap ? E.fcRankMap(FC, idx, cc) : null}, now, adj); };
const res = {}, fails = [], warns = [], t0 = Date.now();
const SF = board({sf:1, qb:1}), Q1 = board({sf:0, qb:1});

// 1. broken numbers
for(const [lab, M] of [['superflex', SF], ['1QB', Q1]]){ const bad = M.rows.filter(r=>!isFinite(r.v) || r.v<0); if(bad.length || M.rows.length<300) fails.push(`${lab}: ${bad.length} broken values, ${M.rows.length} players`); }

// 2. format rules
{ const A = board({sf:1, qb:1}, [...players, ...pros]), B = board({sf:0, qb:1}, [...players, ...pros]), rb = {}; B.rows.forEach(r=>rb[r.k] = r.rank);
  const bad = A.rows.filter(r=>r.pos==='QB' && r.rank<=300 && rb[r.k] < r.rank-2); res.qbFormat = bad.length;
  if(bad.length) fails.push(`QBs ranked higher in 1QB than superflex: ${bad.slice(0,6).map(r=>r.n+' SF#'+r.rank+' 1QB#'+rb[r.k]).join(', ')}`); }
{ const T0 = board({tep:0}), T1 = board({tep:1}), r0 = {}; T0.rows.forEach(r=>r0[r.k] = r.rank);
  const bad = T1.rows.filter(r=>r.pos==='TE' && r.rank<=200 && r.rank > r0[r.k]+2); res.teFormat = bad.length;
  if(bad.length) fails.push(`TEs ranked lower with TE premium than without: ${bad.slice(0,6).map(r=>r.n+' TEP#'+r.rank+' noTEP#'+r0[r.k]).join(', ')}`); }

// 3. position mix and agreement with FantasyCalc (public market from real trades)
for(const [lab, M, vk] of [['sf', SF, '2-12-1'], ['oneqb', Q1, '1-12-1']]){ const fv = {}; Object.entries((FC.v||{})[vk]||{}).forEach(([sid,v])=>{ const k = idx[sid]; if(k && !(fv[k]>v)) fv[k] = v; });
  const by = {}; M.rows.forEach(r=>by[r.k] = r);
  const mixOf = a => { const m = {QB:0, RB:0, WR:0, TE:0}; a.forEach(p=>m[p]++); return m; };
  const mb = mixOf(M.rows.filter(r=>!r.pick).sort((a,b)=>b.v-a.v).slice(0,150).map(r=>r.pos));
  const fk = Object.keys(fv).filter(k=>by[k]).sort((a,b)=>fv[b]-fv[a]).slice(0,150), mf = mixOf(fk.map(k=>by[k].pos));
  res['mix_'+lab] = {board:mb, fantasycalc:mf};
  for(const q of ['QB','RB','WR','TE']) if(Math.abs(mb[q]-mf[q])>8) warns.push(`${lab} top-150 ${q}s: board ${mb[q]}, FantasyCalc ${mf[q]}`);
  const top = Object.keys(fv).filter(k=>by[k]).sort((a,b)=>fv[b]-fv[a]).slice(0,200);
  res['fcAgree_'+lab] = +spear(top.map(k=>by[k].v), top.map(k=>fv[k])).toFixed(3); }

// 4. owner-reported cases (what he expects; a warning if the board disagrees, not a rule)
const CASES = [
  ['superflex, TE premium', {sf:1, qb:1, tep:1}, 'shedeursanders', '>', 'philmafah'],
  ['superflex, TE premium', {sf:1, qb:1, tep:1}, 'gregdulcich', '>', 'philmafah'],
  ['superflex', {sf:1, qb:1}, 'lamarjackson', '>', 'treybenson'],
  ['superflex', {sf:1, qb:1}, 'emmettjohnson', '>', 'calebdouglas'],
  ['1QB', {sf:0, qb:1}, 'emmettjohnson', '>', 'calebdouglas'] ];
res.cases = [];
for(const [lab, c, a, op, b] of CASES){ const M = board(c), ra = M.rows.find(r=>r.k===a), rb = M.rows.find(r=>r.k===b); if(!ra || !rb) continue;
  const ok = op==='>' ? ra.v > rb.v : ra.v < rb.v; res.cases.push(`${ok?'ok  ':'MISS'} ${lab}: ${ra.n} ${ra.v.toFixed(0)} ${op} ${rb.n} ${rb.v.toFixed(0)}`); if(!ok) warns.push(`owner case: ${lab} ${ra.n} should be ${op} ${rb.n}`); }

// 5. backtest (2020-23, current engine, comps cut to what was known then)
if(BT && fs.existsSync(BT)){ const run = require('./bt_cur.js')(page, BT, path.join(ROOT, 'comps.json')), r = run(OVER);
  res.bt = {sf:r.sf.all, sf_vsExperts:[r.sf['board on expert set'], r.sf['experts all']], oneqb:r.oneqb.all, oneqb_vsExperts:[r.oneqb['board on expert set'], r.oneqb['experts all']], pos_sf:{QB:r.sf.QB, RB:r.sf.RB, WR:r.sf.WR, TE:r.sf.TE}}; }
else res.bt = null;

// compare to baseline
const BF = path.join(__dirname, 'baseline.json'), bl = fs.existsSync(BF) ? JSON.parse(fs.readFileSync(BF)) : null;
if(bl){
  if(res.bt && bl.bt){ for(const f of ['sf','oneqb']) if(res.bt[f] < bl.bt[f]-0.005) fails.push(`backtest ${f} down: ${bl.bt[f]} -> ${res.bt[f]}`); }
  for(const f of ['sf','oneqb']) if(bl['fcAgree_'+f]!=null && res['fcAgree_'+f] < bl['fcAgree_'+f]-0.02) warns.push(`agreement with FantasyCalc (${f}) down: ${bl['fcAgree_'+f]} -> ${res['fcAgree_'+f]}`);
}
function spear(x, y){ const rk = a => { const s = a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]), r = []; s.forEach(([,i],j)=>r[i]=j); return r; }; const a = rk(x), b = rk(y), n = a.length, m = (n-1)/2; let s=0, sa=0, sb=0; for(let i=0;i<n;i++){ s+=(a[i]-m)*(b[i]-m); sa+=(a[i]-m)**2; sb+=(b[i]-m)**2; } return s/Math.sqrt(sa*sb||1); }

console.log(JSON.stringify(res, null, 1));
if(bl) console.log('baseline:', JSON.stringify({bt:bl.bt, fcAgree_sf:bl.fcAgree_sf, fcAgree_oneqb:bl.fcAgree_oneqb}));
warns.forEach(w=>console.log('WARN', w)); fails.forEach(f=>console.log('FAIL', f));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nPASS', `(${((Date.now()-t0)/1000).toFixed(0)}s)`);
if(SAVE && !fails.length){ fs.writeFileSync(BF, JSON.stringify({...res, at:new Date().toISOString(), cfg:OVER}, null, 1)); console.log('baseline saved'); }
process.exit(fails.length ? 1 : 0);
