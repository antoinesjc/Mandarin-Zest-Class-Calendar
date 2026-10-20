// Builds radicals.json for the radical game: for each of the 214 Kangxi radicals,
// which common characters (simplified + traditional) contain it anywhere.
const fs = require('fs');
const OpenCC = require('opencc-js');
const N = parseInt(process.argv[2] || '4000', 10);
const OUT = process.argv[3];

const load = f => { const m = require('./node_modules/hanzi/lib/data/' + f); return typeof m === 'string' ? m : Object.values(m)[0]; };
const decompTxt = load('cjk-decomp.txt.js'), freqTxt = load('frequency_with_script_variants_removed.txt.js');

// decomposition graph
const D = {};
decompTxt.split('\n').forEach(l => {
  const m = l.match(/^([^:]+):([a-z\/]+)\((.*)\)$/);
  if (!m) return;
  const parts = m[3] ? m[3].split(',') : [];
  D[m[1]] = { type: m[2], parts };
});
const memo = {};
let ATOMS = new Set();
function comps(c, depth = 0) {
  if (depth > 0 && ATOMS.has(c)) return new Set([c]);
  if (memo[c]) return memo[c];
  const out = new Set([c]);
  const d = D[c];
  // small radicals are atoms: 甘 is not "grass + one", 开 is not "grass"
  if (d && depth < 12) {
    d.parts.forEach((p, i) => {
      // 阝 on the left = 阜 (mound), on the right = 邑 (city)
      if (p === '阝' && d.type[0] === 'a') out.add(i === 0 ? '阝L' : '阝R');
      comps(p, depth + 1).forEach(x => out.add(x));
    });
  }
  memo[c] = out;
  return out;
}

const DICT = JSON.parse(fs.readFileSync(process.env.DICT || __dirname + '/../../../writing-sheets/dict.json', 'utf8'));
// radicals
const R = fs.readFileSync(__dirname + '/radicals.txt', 'utf8').trim().split('\n').map(l => {
  const [n, ch, py, en, varStr] = l.split('|');
  const vars = [];
  const cps = Array.from(varStr || '');
  for (let i = 0; i < cps.length; i++) {
    if (cps[i + 1] === 'L' || cps[i + 1] === 'R') { vars.push(cps[i] + cps[i + 1]); i++; } else vars.push(cps[i]);
  }
  return { n: +n, ch, py, en, vars };
});

R.forEach(r => { ATOMS.add(r.ch); r.vars.forEach(v => ATOMS.add(v)); });

// common characters: top N simplified by frequency, plus their traditional (Taiwan) forms
const freq = freqTxt.split('\n').map(l => l.split('\t')).filter(a => a.length > 5 && a[1]);
const pinyin = {};
const S = [];
freq.slice(0, N).forEach(a => { if (Array.from(a[1]).length === 1) { S.push(a[1]); pinyin[a[1]] = a[4].split('/')[0]; } });
const s2t = OpenCC.Converter({ from: 'cn', to: 'tw' }), t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
const T = [];
const seenT = new Set();
S.forEach(c => { const t = s2t(c); if (Array.from(t).length === 1 && !seenT.has(t)) { seenT.add(t); T.push(t); if (!pinyin[t]) pinyin[t] = pinyin[c]; } });
const Sset = new Set(S), Tset = new Set(T);

// tone numbers -> marks
function mark(p) {
  const m = p.match(/^([a-zü:v]+)([1-5])$/i); if (!m) return p.replace(/[0-9]/g, '');
  let s = m[1].replace(/u:|v/g, 'ü'), t = +m[2];
  if (t === 5) return s;
  const M = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  let idx = s.search(/[ae]/); if (idx < 0) idx = s.indexOf('ou'); if (idx < 0) { for (let k = s.length - 1; k >= 0; k--) if (M[s[k]]) { idx = k; break; } }
  if (idx < 0) return s;
  return s.slice(0, idx) + M[s[idx]][t - 1] + s.slice(idx + 1);
}

const all = [...S, ...T.filter(c => !Sset.has(c))];
const out = { v: 1, n: N, radicals: [], s: S.join(''), t: T.join(''), py: {} };
const stats = [];
R.forEach(r => {
  const forms = new Set([r.ch, ...r.vars]);
  const hit = all.filter(c => { const cs = comps(c); for (const f of forms) if (cs.has(f)) return true; return false; });
  const sHits = S.filter(c => hit.includes(c)), tHits = T.filter(c => hit.includes(c));
  out.radicals.push({ n: r.n, ch: r.ch, py: r.py, en: r.en, vars: r.vars.filter(v => !/[LR]$/.test(v)).join(''), c: hit.join('') });
  // hints: characters whose dictionary radical is this one first, then the others, by frequency
  const isMain = c => { const d = DICT[c] || DICT[t2s(c)]; return d && forms.has(d[2]); };
  const order = list => list.filter(isMain).concat(list.filter(c => !isMain(c)));
  const hs = order(sHits).slice(0, 10), ht = order(tHits).slice(0, 10);
  const last = out.radicals[out.radicals.length - 1];
  last.hs = hs.join(''); last.ht = ht.join('');
  hs.concat(ht).forEach(c => { const d = DICT[c] || DICT[t2s(c)]; out.py[c] = (d && d[0] ? d[0].split(/[\/,\s]/)[0] : '') || mark(pinyin[c] || ''); });
  stats.push([r.n, r.ch, sHits.length, tHits.length, sHits.slice(0, 8).join(''), tHits.slice(0, 8).join('')]);
});
// pinyin for every character in the lists (shown under correct answers)
all.forEach(c => { if (out.py[c] === undefined) { const d = DICT[c] || DICT[t2s(c)]; const p = (d && d[0] ? d[0].split(/[\/,\s]/)[0] : '') || mark(pinyin[c] || ''); if (p) out.py[c] = p; } });
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out));
stats.forEach(s => console.log(s.join('\t')));
console.error('S', S.length, 'T', T.length, 'bytes', JSON.stringify(out).length);
