// Backtest of the CURRENT page engine (rankAll from the page itself, comparable-players library cut to what was known
// at the time). Boards at the end of 2020-23 and week 8 of 2021-23; judged on what each player actually scored above
// replacement over the next two seasons, in the board's own format. Spearman rank correlation, all positions together
// (the cross-position order) and within each position.
// Usage: require('./bt_cur.js')(enginePage, btData, compsLib) -> run(cfgOverrides) -> {sf:{all,QB,...}, oneqb:{...}}
const fs = require('fs'), vm = require('vm');
module.exports = function(page, btFile, compsFile){
  const h = fs.readFileSync(page, 'utf8'), js = h.slice(h.lastIndexOf('<script>')+8);
  const eng = js.slice(0, js.indexOf('const {useState, useEffect, useMemo, useRef} = React;'));
  const ctx = {console, Math, Date, JSON, Object, Array, Number, String, isFinite, Set, Map}; vm.createContext(ctx);
  vm.runInContext(eng + '\nthis.E={rankAll, DEF, seasonPts, replacement};', ctx); const E = ctx.E;
  const wk1Thu = Y => { const d = new Date(Date.UTC(Y, 8, 1)).getUTCDay(); return Date.UTC(Y, 8, 1 + ((8 - d) % 7) + 3, 12); }; E.weekEnd = (Y, w) => wk1Thu(Y) + (5 + 7*(w-1))*864e5;
  const B = JSON.parse(fs.readFileSync(btFile)), LIB = JSON.parse(fs.readFileSync(compsFile));
  const YR = 365.25*864e5, POS = ['QB','RB','WR','TE'], H = 2;
  const cum = (wk, upto, from=1) => { let a = null; for(const [x,l] of Object.entries(wk||{})){ const w = +x; if(w>=from && w<=upto) a = a ? a.map((v,i)=>v+(+l[i]||0)) : l.map(v=>+v||0); } return a; };
  const Rc = {}; const seasonR = (y, c, key) => { const k = key+y; if(Rc[k]) return Rc[k]; const pts = [];
    for(const [pid,s] of Object.entries(B.S)){ const p = B.P[pid]; if(!p) continue; const l = E.seasonPts(s[y], p.pos, c); if(l && l.g>=4) pts.push({pos:p.pos, ppg:l.ppg}); }
    return Rc[k] = E.replacement(pts, c).R; };
  const vorp = (line, pos, y, c, key) => { const l = E.seasonPts(line, pos, c); if(!l) return 0; return Math.max(0, l.pts - seasonR(y, c, key)[pos]*l.g); };
  const ecrAt = (t) => { const out = {}; ['dynasty-op','dynasty-overall'].forEach((src,i)=>{ const E2 = B.E[src]; let best = null;
      for(const d of Object.keys(E2)){ const dt = Date.parse(d); if(Math.abs(dt-t)<=21*864e5 && (!best || Math.abs(dt-t)<Math.abs(Date.parse(best)-t))) best = d; }
      if(best) E2[best].forEach((g,j)=>{ out[g] = out[g] || [null,null,null]; if(out[g][i]==null) out[g][i] = j+1; }); }); return out; };
  const libUpTo = {}; const lib = y => libUpTo[y] || (libUpTo[y] = {v:2, R:LIB.R, names:LIB.names, rows:LIB.rows.filter(a=>a[1]<=y)});
  // one checkpoint's players as the page builds them, plus realized targets per format
  const cps = [];
  const mk = (Y, mid) => { const t = mid ? E.weekEnd(Y,8) : E.weekEnd(Y,18); const tE = mid ? E.weekEnd(Y,8) : Date.parse(`${Y+1}-08-25`); const ecr = ecrAt(tE); const P = [];
    for(const [pid,p] of Object.entries(B.P)){ if(p.dy && p.dy>Y) continue; if(!p.bd) continue; const s0 = B.S[pid]||{}, s = {};
      for(const y in s0) if(+y <= Y-(mid?1:0)) s[y] = s0[y]; if(mid){ const a = cum((B.W[Y]||{})[pid], 8); if(a) s[Y] = a; }
      if(![Y,Y-1,Y-2].some(y=>s[y]&&s[y][0]>0) && !(p.dy && p.dy>=Y-2 && p.dp)) continue;
      P.push({k:pid, n:p.n, pos:p.pos, age:(t-Date.parse(p.bd))/YR, ad:t, dp:p.dp||null, dy:p.dy||null, s, ecr:ecr[pid]||null, _s0:s0}); }
    cps.push({Y, mid, t, P, lib:lib(mid ? Y-4 : Y-3)}); };
  for(let Y=2020; Y<=2023; Y++) mk(Y, 0); for(let Y=2021; Y<=2023; Y++) mk(Y, 1);
  const tgt = (p, cp, c, key) => { const {Y, mid} = cp; let s = 0;
    if(mid){ const rest = cum((B.W[Y]||{})[p.k], 99, 9); s += rest ? vorp(rest, p.pos, Y, c, key) : 0; s += vorp(p._s0[Y+1], p.pos, Y+1, c, key); }
    else for(let j=1;j<=H;j++) s += vorp(p._s0[Y+j], p.pos, Y+j, c, key); return s; };
  const rk = a => { const idx = a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]), r = new Array(a.length); let i = 0; while(i<idx.length){ let j = i; while(j+1<idx.length && idx[j+1][0]===idx[i][0]) j++; for(let k=i;k<=j;k++) r[idx[k][1]] = (i+j)/2+1; i = j+1; } return r; };
  const pear = (x,y) => { const n = x.length, mx = x.reduce((a,b)=>a+b,0)/n, my = y.reduce((a,b)=>a+b,0)/n; let a=0,b=0,d=0; for(let i=0;i<n;i++){ a+=(x[i]-mx)*(y[i]-my); b+=(x[i]-mx)**2; d+=(y[i]-my)**2; } return a/Math.sqrt(b*d||1); };
  const sp = (x,y) => pear(rk(x), rk(y));
  const FMT = {sf:{sf:1, qb:1}, oneqb:{sf:0, qb:1}};
  return function run(over, opt={}){
    const out = {};
    for(const [fk, f] of Object.entries(FMT)){ const acc = {};
      for(const cp of cps){ const c = {...E.DEF, teams:12, qb:1, rb:2, wr:3, te:1, flex:1, ppr:1, tep:0, ...f, ...over};
        const M = E.rankAll(cp.P, {...c, __comps:cp.lib}, cp.t, {}); const by = {}; cp.P.forEach(p=>by[p.k] = p);
        const rows = M.rows.filter(r=>r.age==null || true).map(r=>({r, t:tgt(by[r.k], cp, c, fk)}));
        const em = f.sf ? 0 : 1, N = 250;
        const pool = new Set([...[...rows].sort((a,b)=>b.r.v-a.r.v).slice(0,N), ...[...rows].sort((a,b)=>b.t-a.t).slice(0,N), ...rows.filter(x=>x.r.ecr && x.r.ecr[em] && x.r.ecr[em]<=N)]);
        const Pl = [...pool]; const add = (k,x) => (acc[k] = acc[k]||[]).push(x);
        add('all', sp(Pl.map(x=>x.r.v), Pl.map(x=>x.t)));
        const Pe = Pl.filter(x=>x.r.ecr && x.r.ecr[em]); add('experts all', sp(Pe.map(x=>-x.r.ecr[em]), Pe.map(x=>x.t))); add('board on expert set', sp(Pe.map(x=>x.r.v), Pe.map(x=>x.t)));
        for(const q of POS){ const Q = Pl.filter(x=>x.r.pos===q); add(q, sp(Q.map(x=>x.r.v), Q.map(x=>x.t))); if(opt.pe){ const Qe = Q.filter(x=>x.r.ecr && x.r.ecr[em]); add('E'+q, sp(Qe.map(x=>-x.r.ecr[em]), Qe.map(x=>x.t))); add('B'+q, sp(Qe.map(x=>x.r.v), Qe.map(x=>x.t))); } }
        if(opt.mix){ const top = [...M.rows].sort((a,b)=>b.v-a.v).slice(0,150), m = {}; top.forEach(r=>m[r.pos]=(m[r.pos]||0)+1); add('mix', m); }
      }
      out[fk] = Object.fromEntries(Object.entries(acc).map(([k,a])=>[k, k==='mix' ? a : +(a.reduce((s,x)=>s+x,0)/a.length).toFixed(3)]));
    }
    return out;
  };
};
