// Gera js/data.js (territórios, vizinhos, continentes), js/geo.js (formas) e war-bots-standalone.html
// Cada país é um território. Países muito pequenos são anexados ao vizinho de maior fronteira
// (ou ao território mais próximo, se for ilha). Uso: npm install && npm run mapa
import {createRequire} from "module";
import fs from "fs";
import {geoNaturalEarth1, geoCentroid} from "d3-geo";
import {feature, neighbors} from "topojson-client";
import pc from "polygon-clipping";

const PEQUENO = 16;                       // px² no mapa de 1000 px (~26 mil km²): abaixo disso o país é anexado
const MAR_GRAUS = 4.5, MAR_K = 3, ILHA_GRAUS = 14;  // ligações por mar: distância máx., nº por território, alcance de ilhas

const CONT = { // chave: [nome, matiz, países (nomes do Natural Earth)]
  na:["América do Norte",48,"Canada|United States of America|Mexico|Greenland|Guatemala|Belize|Honduras|El Salvador|Nicaragua|Costa Rica|Panama|Cuba|Jamaica|Haiti|Dominican Rep.|Puerto Rico|Bahamas|Trinidad and Tobago"],
  sa:["América do Sul",350,"Colombia|Venezuela|Guyana|Suriname|Ecuador|Peru|Bolivia|Brazil|Argentina|Chile|Uruguay|Paraguay|Falkland Is."],
  eu:["Europa",212,"Iceland|United Kingdom|Ireland|Norway|Sweden|Finland|Denmark|Germany|Poland|Czechia|Slovakia|Netherlands|Belgium|Luxembourg|Lithuania|Latvia|Estonia|Austria|Hungary|France|Spain|Portugal|Switzerland|Italy|Slovenia|Croatia|Bosnia and Herz.|Serbia|Montenegro|Kosovo|North Macedonia|Macedonia|Albania|Greece|Bulgaria|Romania|Ukraine|Belarus|Moldova|Russia|Malta|Andorra"],
  af:["África",24,"Morocco|W. Sahara|Algeria|Tunisia|Libya|Egypt|Mauritania|Mali|Niger|Chad|Senegal|Gambia|Guinea|Guinea-Bissau|Sierra Leone|Liberia|Côte d'Ivoire|Burkina Faso|Ghana|Togo|Benin|Nigeria|Cameroon|Central African Rep.|Eq. Guinea|Gabon|Congo|Dem. Rep. Congo|Angola|Zambia|Malawi|Mozambique|Zimbabwe|Botswana|Namibia|South Africa|Lesotho|eSwatini|Madagascar|Sudan|S. Sudan|Ethiopia|Eritrea|Djibouti|Somalia|Somaliland|Kenya|Uganda|Rwanda|Burundi|Tanzania"],
  as:["Ásia",145,"Turkey|Cyprus|N. Cyprus|Syria|Lebanon|Israel|Palestine|Jordan|Iraq|Iran|Saudi Arabia|Yemen|Oman|United Arab Emirates|Qatar|Kuwait|Georgia|Armenia|Azerbaijan|Kazakhstan|Uzbekistan|Turkmenistan|Kyrgyzstan|Tajikistan|Afghanistan|Pakistan|India|Bangladesh|Nepal|Bhutan|Sri Lanka|China|Mongolia|Japan|North Korea|South Korea|Taiwan|Myanmar|Thailand|Laos|Vietnam|Cambodia|Malaysia|Brunei|Indonesia|Philippines|Timor-Leste"],
  oc:["Oceania",280,"Australia|New Zealand|Papua New Guinea|Fiji|Solomon Is.|Vanuatu|New Caledonia"]
};
const NOME_PT = {Somaliland:"Somalilândia", Kosovo:"Kosovo", "N. Cyprus":"Chipre do Norte"};
const IGN = new Set(["Antarctica","Fr. S. Antarctic Lands","Heard I. and McDonald Is.","S. Geo. and the Is."]);

const req = createRequire(import.meta.url);
const mundo = req("world-atlas/countries-50m.json");
const cadastro = {}; for (const p of req("world-countries")) cadastro[p.ccn3] = p;
const contDe = {}; for (const [k, [, , s]] of Object.entries(CONT)) for (const n of s.split("|")) contDe[n] = k;

// ---------- projeção e geometria ----------
const proj = geoNaturalEarth1().fitExtent([[2,2],[998,520]], {type:"Sphere"});
const num = v => String(+v.toFixed(1));
const anel = r => { const o = []; let ux, uy; for (const p of r) { const [x, y] = proj(p); if (o.length && Math.hypot(x-ux, y-uy) < 0.55) continue; o.push([x, y]); ux = x; uy = y; } return o; };
const area = r => { let s = 0; for (let i = 0; i < r.length; i++) { const [a,b] = r[i], [c,d] = r[(i+1) % r.length]; s += a*d - c*b; } return s/2; };
const cam = (g, min = 1.5) => { let d = ""; for (const poly of g) for (const r of poly) { const a = anel(r); if (a.length < 3 || Math.abs(area(a)) < min) continue; d += "M" + a.map(p => num(p[0]) + " " + num(p[1])).join("L") + "Z"; } return d; };
// anéis que cruzam o antimeridiano (±180°) são desdobrados e cortados, senão viram faixas horizontais
const desdobra = r => { const o = [r[0].slice()]; for (let i = 1; i < r.length; i++) { let [x, y] = r[i]; const px = o[i-1][0]; while (x - px > 180) x -= 360; while (x - px < -180) x += 360; o.push([x, y]); } return o; };
const desloca = (g, d) => g.map(poly => poly.map(r => r.map(([x, y]) => [x + d, y])));
const multi = g => {
  let m = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map(poly => poly.map(desdobra));
  let mn = 1e9, mx = -1e9;
  for (const poly of m) for (const r of poly) for (const p of r) { if (p[0] < mn) mn = p[0]; if (p[0] > mx) mx = p[0]; }
  if (mn < -180 || mx > 180) {
    const R = (a, b) => [[[a,-90],[b,-90],[b,90],[a,90],[a,-90]]];
    m = [...pc.intersection(m, R(-180,180)), ...desloca(pc.intersection(m, R(180,540)), -360), ...desloca(pc.intersection(m, R(-540,-180)), 360)];
  }
  return m;
};
const areaGeo = g => { let t = 0; for (const poly of g) poly.forEach((r, k) => { const a = Math.abs(area(anel(r))); t += k ? -a : a; }); return t; };

// ---------- distâncias na esfera ----------
const rad = d => d * Math.PI / 180;
const prep = pts => pts.map(([x, y]) => { const f = rad(y); return [rad(x), Math.sin(f), Math.cos(f), x, y]; });
const vec = ([l, s, c]) => [c * Math.cos(l), c * Math.sin(l), s];
const cosd = (P, Q) => { let m = -2; for (const [l1,s1,c1] of P) for (const [l2,s2,c2] of Q) { const v = s1*s2 + c1*c2*Math.cos(l1-l2); if (v > m) m = v; } return Math.acos(Math.min(1, m)); };
const resumo = P => { let x = 0, y = 0, z = 0; for (const p of P) { const v = vec(p); x += v[0]; y += v[1]; z += v[2]; } const n = Math.hypot(x,y,z) || 1; const c = [x/n, y/n, z/n]; let r = 0; for (const p of P) { const v = vec(p); r = Math.max(r, Math.acos(Math.min(1, c[0]*v[0] + c[1]*v[1] + c[2]*v[2]))); } return {P, c, r}; };
const ang = (a, b) => Math.acos(Math.min(1, Math.max(-1, a.c[0]*b.c[0] + a.c[1]*b.c[1] + a.c[2]*b.c[2])));
const limite = (a, b) => ang(a, b) - a.r - b.r;   // cota inferior barata da distância
const dist = (a, b) => cosd(a.P, b.P);
// menor distância + as coordenadas (graus) dos dois pontos mais próximos
const melhor = (a, b) => { let m = -2, pa, pb; for (const p of a.P) for (const q of b.P) { const v = p[1]*q[1] + p[2]*q[2]*Math.cos(p[0]-q[0]); if (v > m) { m = v; pa = p; pb = q; } } return {d: Math.acos(Math.min(1, m)), p: [pa[3], pa[4], pb[3], pb[4]]}; };
const amostra = g => { let tot = 0; for (const poly of g) for (const r of poly) tot += r.length; const passo = Math.max(1, Math.ceil(tot / 200)); const pts = []; for (const poly of g) { const r = poly[0]; pts.push(r[0]); for (let k = 0; k < r.length; k += passo) pts.push(r[k]); } return pts; };
const reamostra = (pts, n = 200) => pts.length <= n ? pts : pts.filter((_, i) => i % Math.ceil(pts.length / n) === 0);

// ---------- países ----------
const geoms = mundo.objects.countries.geometries;
const feats = feature(mundo, mundo.objects.countries).features;
const nb = neighbors(geoms);
const F = feats.map((f, i) => { const g = multi(f.geometry); const n = f.properties.name; return {i, n, g, ar: areaGeo(g), ign: IGN.has(n)}; });
const S0 = F.map(f => f.ign ? null : resumo(prep(amostra(f.g))));

const arcsDe = g => { const s = new Set(); const rec = a => typeof a === "number" ? s.add(a < 0 ? ~a : a) : a.forEach(rec); rec(g.arcs); return s; };
const A = geoms.map(arcsDe), arcLen = mundo.arcs.map(a => a.length);
const borda = (i, j) => { let t = 0; for (const a of A[i]) if (A[j].has(a)) t += arcLen[a]; return t; };

const grandes = F.filter(f => !f.ign && f.ar >= PEQUENO).map(f => f.i), ehGrande = new Set(grandes);
const maisProximoGrande = i => { let best = Infinity, h = -1; for (const [lb, j] of grandes.map(j => [limite(S0[i], S0[j]), j]).sort((a, b) => a[0] - b[0])) { if (lb >= best) break; const d = dist(S0[i], S0[j]); if (d < best) { best = d; h = j; } } return h; };
const host = F.map(f => {
  if (f.ign) return -1; if (ehGrande.has(f.i)) return f.i;
  const c = nb[f.i].filter(j => ehGrande.has(j));
  return c.length ? c.reduce((a, b) => borda(f.i, b) > borda(f.i, a) ? b : a) : maisProximoGrande(f.i);
});
const contDoHost = h => { if (contDe[F[h].n]) return contDe[F[h].n]; let best = 9, k; for (const f of F) if (!f.ign && contDe[f.n]) { const d = ang(S0[h], S0[f.i]); if (d < best) { best = d; k = contDe[f.n]; } } console.log("continente por proximidade:", F[h].n, "→", k); return k; };

// ---------- territórios ----------
const T = grandes.map(h => {
  const membros = F.filter(f => host[f.i] === h).map(f => f.i);
  const c = cadastro[feats[h].id], n = F[h].n;
  let u; try { u = pc.union(...membros.map(m => F[m].g)); } catch (e) { console.warn("união falhou:", n); u = membros.flatMap(m => F[m].g); }
  let mel = null, ma = 0; for (const poly of u) { const a = anel(poly[0]); const ar = Math.abs(area(a)); if (ar > ma) { ma = ar; mel = a; } }
  let cx = 0, cy = 0, Ar = 0; for (let i = 0; i < mel.length; i++) { const [a,b] = mel[i], [c2,d] = mel[(i+1) % mel.length]; const k = a*d - c2*b; Ar += k; cx += (a+c2)*k; cy += (b+d)*k; }
  const nomePt = f => NOME_PT[F[f].n] || cadastro[feats[f].id]?.translations?.por?.common || F[f].n;
  return {
    h, id: (c ? c.cca3 : n.replace(/\W+/g, "")).toLowerCase(), nome: nomePt(h), cont: contDoHost(h),
    inclui: membros.filter(m => m !== h).map(nomePt),
    d: cam(u, 3), p: membros.filter(m => m !== h).map(m => cam(F[m].g)).filter(Boolean),
    cx: +(cx/(3*Ar)).toFixed(1), cy: +(cy/(3*Ar)).toFixed(1), a: Math.round(membros.reduce((s, m) => s + F[m].ar, 0)),
    S: resumo(prep(reamostra(membros.flatMap(m => amostra(F[m].g)))))
  };
});
const m = T.length, idx = {}; T.forEach((t, k) => idx[t.h] = k);
const key = (a, b) => a < b ? a + "|" + b : b + "|" + a;

// fronteiras por terra (arcos compartilhados no mapa real)
const terra = new Set();
for (const f of F) { if (f.ign) continue; for (const j of nb[f.i]) { if (F[j].ign) continue; const a = idx[host[f.i]], b = idx[host[j]]; if (a !== b) terra.add(key(a, b)); } }
const grau = new Array(m).fill(0); for (const k of terra) k.split("|").forEach(x => grau[+x]++);

// ligações por mar: os K territórios mais próximos (até MAR_GRAUS; ilhas sem fronteira alcançam ILHA_GRAUS)
// só vale ligação por mar se o caminho entre os pontos mais próximos não atravessa outro território
const POLYS = [];
for (const f of F) { if (f.ign) continue; const k = idx[host[f.i]]; for (const poly of f.g) { const r = poly[0]; let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of r) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } POLYS.push({k, a, b, c, d, r}); } }
const dentro = (x, y, r) => { let s = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s; } return s; };
const bloqueado = (a, b, [x1, y1, x2, y2]) => {
  let dx = x2 - x1; if (Math.abs(dx) > 180) dx -= Math.sign(dx) * 360;
  for (const t of [0.25, 0.5, 0.75]) {
    let x = x1 + dx * t; if (x > 180) x -= 360; if (x < -180) x += 360; const y = y1 + (y2 - y1) * t;
    for (const P of POLYS) if (P.k !== a && P.k !== b && x >= P.a && x <= P.c && y >= P.b && y <= P.d && dentro(x, y, P.r)) return true;
  }
  return false;
};
const pontos = new Map(), cand = Array.from({length: m}, () => []);
for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) {
  if (terra.has(key(a, b)) || limite(T[a].S, T[b].S) > rad(ILHA_GRAUS)) continue;
  const r = melhor(T[a].S, T[b].S); if (bloqueado(a, b, r.p)) continue;
  pontos.set(key(a, b), r.p); cand[a].push([r.d, b]); cand[b].push([r.d, a]);
}
const mar = new Set();
for (let t = 0; t < m; t++) { let k = 0; for (const [d, o] of cand[t].sort((x, y) => x[0] - y[0])) { if (k >= MAR_K) break; if (d <= rad(MAR_GRAUS) || grau[t] === 0) { mar.add(key(t, o)); k++; } } }
// garante que o mundo seja um grafo conectado
const pai = [...Array(m).keys()], raiz = x => pai[x] === x ? x : (pai[x] = raiz(pai[x]));
for (const k of [...terra, ...mar]) { const [a, b] = k.split("|").map(Number); pai[raiz(a)] = raiz(b); }
for (;;) {
  const ls = []; for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) if (raiz(a) !== raiz(b)) ls.push([limite(T[a].S, T[b].S), a, b]);
  if (!ls.length) break;
  let best = Infinity, any = Infinity, par, parAny, n = 0;
  for (const [lb, a, b] of ls.sort((x, y) => x[0] - y[0])) {
    if (lb >= (best < Infinity ? best : any) && n > 0 || n > 300) break; n++;
    const r = melhor(T[a].S, T[b].S);
    if (r.d < any) { any = r.d; parAny = [a, b, r.p]; }
    if (!bloqueado(a, b, r.p) && r.d < best) { best = r.d; par = [a, b, r.p]; }
  }
  const [a, b, p] = par || parAny;
  mar.add(key(a, b)); pontos.set(key(a, b), p); pai[raiz(a)] = raiz(b); console.log("ligação extra por mar:", T[a].nome, "↔", T[b].nome);
}

// ---------- saída ----------
const viz = T.map(() => []);
for (const k of [...terra, ...mar]) { const [a, b] = k.split("|").map(Number); viz[a].push(T[b].id); viz[b].push(T[a].id); }
const conts = {}; for (const [k, [nome, h]] of Object.entries(CONT)) { const n = T.filter(t => t.cont === k).length; conts[k] = {nome, h, bonus: Math.max(2, Math.round(n / 4))}; }
const territorios = {}; T.forEach((t, k) => { territorios[t.id] = {id: t.id, nome: t.nome, continente: t.cont, vizinhos: viz[k].sort(), ...(t.inclui.length ? {inclui: t.inclui} : {})}; });
const marPares = [...mar].map(k => k.split("|").map(x => T[+x].id));
const marPts = [...mar].map(k => { const [x1, y1, x2, y2] = pontos.get(k); return [...proj([x1, y1]), ...proj([x2, y2])].map(v => +v.toFixed(1)); });

const rel = f => new URL(f, import.meta.url);

// ---------- js/data.js (ESM) ----------
fs.writeFileSync(rel("data.js"),
`// Gerado por gerar.mjs — não edite à mão.
// vizinhos = fronteiras por terra + ligações por mar; MAR lista só as ligações por mar.
export const CONTINENTES = ${JSON.stringify(conts)};
export const TERRITORIOS = {\n${Object.values(territorios).map(t => "  " + t.id + ":" + JSON.stringify(t)).join(",\n")}\n};
export const MAR = ${JSON.stringify(marPares)};
export const WAR = { CONTINENTES, TERRITORIOS, MAR };
`);

// ---------- js/geo.js (ESM) ----------
const yt = proj([0, 84])[1], yb = proj([0, -58])[1];
let grade = "";
for (let lo = -180; lo <= 180; lo += 30) grade += "M" + [...Array(25)].map((_, i) => { const p = proj([lo, -58 + i*5.9]); return num(p[0]) + " " + num(p[1]); }).join("L");
for (let la = -30; la <= 60; la += 30) grade += "M" + [...Array(61)].map((_, i) => { const p = proj([-180 + i*6, la]); return num(p[0]) + " " + num(p[1]); }).join("L");
const geo = {viewBox: [0, +(yt-6).toFixed(1), 1000, +(yb-yt+12).toFixed(1)], grade, mar: marPts, t: {}};
for (const t of T) geo.t[t.id] = {d: t.d, ...(t.p.length ? {p: t.p} : {}), cx: t.cx, cy: t.cy, a: t.a};
fs.writeFileSync(rel("geo.js"), `// Gerado por tools/gerar.mjs — não edite à mão.\nexport const GEO = ${JSON.stringify(geo)};\n`);

// ---------- war-bots-standalone.html (tudo inline, sem módulos) ----------
const lê = f => fs.readFileSync(rel(f), "utf8");
// tira import/export para reaproveitar o mesmo código num <script> clássico
const stripEsm = s => s
  .replace(/^import\s+[^\n]*;\s*$/gm, "")
  .replace(/^export\s+(const|let|var|function|class)\s+/gm, "$1 ")
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, "");

let sa = lê("index.html")
  .replace('<link rel="stylesheet" href="./css/style.css">', () => `<style>\n${lê("css/style.css")}\n</style>`)
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>\s*/g, "");

const inline = ["js/data.js", "js/geo.js", "js/map.js"].map(f => stripEsm(lê(f))).join("\n\n");
sa = sa.replace("</body>", () => `<script>\n(() => {\n${inline}\n})();\n</script>\n</body>`);
fs.writeFileSync(rel("war-bots-standalone.html"), sa);

console.log(`${m} territórios (${F.filter(f => !f.ign).length - m} países anexados), ${terra.size} fronteiras por terra, ${mar.size} ligações por mar`);
console.log(Object.entries(conts).map(([k, c]) => `${c.nome}: ${T.filter(t => t.cont === k).length} (bônus ${c.bonus})`).join(" | "));
