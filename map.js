import { CONTINENTES, TERRITORIOS, MAR } from './data.js';
import { GEO } from './geo.js';

const C = CONTINENTES, T = TERRITORIOS;
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('map');
const el = (tag, attrs = {}, pai = svg) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  pai.appendChild(e); return e;
};
const lista = Object.values(T), W = GEO.viewBox[2], H = GEO.viewBox[3];
const chave = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const marSet = new Set(MAR.map(([a, b]) => chave(a, b)));

// Cor: matiz do continente + 5 tons, escolhidos para vizinhos por terra nunca ficarem iguais
const tons = [30, 39, 48, 57, 66], idx = {}, cor = {};
for (const t of lista) {
  const usados = new Set(t.vizinhos.filter(v => !marSet.has(chave(t.id, v)) && idx[v] !== undefined).map(v => idx[v]));
  idx[t.id] = Math.max(0, tons.findIndex((_, i) => !usados.has(i)));
  cor[t.id] = `hsl(${C[t.continente].h} 42% ${tons[idx[t.id]]}%)`;
}

// ---- Definições (desenhadas uma vez; as cópias do mundo só referenciam via <use>) ----
const defs = el('defs');
el('path', {id: 'grade', d: GEO.grade, class: 'grade'}, defs);
for (const t of lista) {
  const g = el('g', {id: 't-' + t.id}, defs), geo = GEO.t[t.id];
  el('path', {d: geo.d, class: 'pais'}, g);
  (geo.p || []).forEach(d => el('path', {d, class: 'membro'}, g));   // países pequenos anexados
}

// Ligações por mar: salto curto entre as costas (visíveis ao passar o mouse; tecla M mostra todas)
const gMar = el('g', {id: 'mar'}, defs), elos = {};
MAR.forEach(([a, b], i) => {
  const [x1, y1, x2o, y2] = GEO.mar[i], x2 = x2o - Math.round((x2o - x1) / W) * W;  // pelo caminho mais curto no mundo cíclico
  const l = el('line', {x1, y1, x2, y2, class: 'elo'}, gMar);
  (elos[a] ||= []).push(l); (elos[b] ||= []).push(l);
});
const realce = el('path', {id: 'realce'}, defs);

// Rótulos: dentro do território; a fonte é ajustada para a largura real do texto
const ctx = document.createElement('canvas').getContext('2d');
ctx.font = '100px Georgia, "Times New Roman", serif';
const gRot = el('g', {id: 'rotulos'}, defs), rotulos = [];
for (const t of lista) {
  const l = GEO.t[t.id].l; if (!l) continue;
  const real = Math.max(...l.t.map(s => ctx.measureText(s).width / 100)) * l.f;
  const f = real > l.w ? l.f * l.w / real : l.f;
  const tx = el('text', {x: l.x, y: l.y, class: 'rotulo'}, gRot);
  l.t.forEach((s, i) => {
    const ts = el('tspan', {x: l.x, dy: i ? '1.12em' : (0.35 - (l.t.length - 1) * 0.56).toFixed(2) + 'em'}, tx);
    ts.textContent = s;
  });
  tx.style.opacity = 0; rotulos.push({tx, f});
}
function atualizaRotulos() {
  const s = svg.clientWidth / V[2];                  // pixels de tela por unidade do mapa
  for (const r of rotulos) {
    const ver = r.f * s >= 7;                        // só aparece quando o texto fica legível
    r.tx.style.opacity = ver ? 1 : 0;
    if (ver) { const fe = Math.min(r.f, 24 / s); r.tx.setAttribute('font-size', +fe.toFixed(3)); r.tx.style.strokeWidth = +(fe * 0.16).toFixed(3); }
  }
}
let pend = false;
const agenda = () => { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; atualizaRotulos(); }); } };

// ---- Cópias do mundo lado a lado: a rotação horizontal é infinita ----
const usos = {}; let copias = [], marcados = [], kmaxAtual = -9;
const vmax = () => Math.max(W, H * svg.clientWidth / svg.clientHeight);
function limpar() {
  marcados.forEach(e => e.classList.remove('sel', 'viz', 'ativo')); marcados = [];
  realce.removeAttribute('d');
}
function mostrar(t) {
  limpar();
  const marca = (e, c) => { e.classList.add(c); marcados.push(e); };
  usos[t.id].forEach(u => marca(u, 'sel'));
  t.vizinhos.forEach(v => usos[v].forEach(u => marca(u, 'viz')));
  (elos[t.id] || []).forEach(l => marca(l, 'ativo'));
  realce.setAttribute('d', GEO.t[t.id].d);
}
let moveu = false;
function montaCopias() {
  copias.forEach(c => c.remove()); copias = []; limpar();
  for (const t of lista) usos[t.id] = [];
  kmaxAtual = Math.ceil(vmax() / W);
  for (let k = -1; k <= kmaxAtual; k++) {
    const c = el('g', {transform: `translate(${k * W} 0)`});
    el('use', {href: '#grade'}, c);
    for (const t of lista) {
      const u = el('use', {href: '#t-' + t.id, class: 'terr'}, c);
      u.style.setProperty('--f', cor[t.id]);
      el('title', {}, u).textContent = t.nome + (t.inclui ? ` (inclui ${t.inclui.join(', ')})` : '');
      u.addEventListener('pointerenter', () => mostrar(t));
      u.addEventListener('pointerleave', limpar);
      u.addEventListener('click', () => { if (!moveu) mostrar(t); });
      usos[t.id].push(u);
    }
    el('use', {href: '#mar'}, c); el('use', {href: '#realce'}, c);
    el('use', {href: '#rotulos', style: 'pointer-events:none'}, c);
    copias.push(c);
  }
}

// ---- Navegação: arrastar, roda, pinça, teclado ----
let V = [0, 0, W, H];
function aplica() {
  V[3] = V[2] * svg.clientHeight / svg.clientWidth;
  V[0] = ((V[0] % W) + W) % W;                                   // o mundo é cíclico em x
  V[1] = V[3] >= H ? -(V[3] - H) / 2 : Math.min(Math.max(V[1], 0), H - V[3]);
  svg.setAttribute('viewBox', V.map(n => +n.toFixed(3)).join(' '));
  agenda();
}
const usr = (px, py) => [V[0] + px / svg.clientWidth * V[2], V[1] + py / svg.clientHeight * V[3]];
function zoom(f, px = svg.clientWidth / 2, py = svg.clientHeight / 2) {
  const [ux, uy] = usr(px, py), w = Math.min(vmax(), Math.max(W / 40, V[2] / f)), k = w / V[2];
  V = [ux - (ux - V[0]) * k, uy - (uy - V[1]) * k, w, V[3] * k]; aplica();
}
svg.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY); }, {passive: false});
svg.addEventListener('dblclick', e => zoom(2, e.clientX, e.clientY));

const ptrs = new Map(); let arr = null, pinca = null;
const dois = () => { const [a, b] = [...ptrs.values()]; return {d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2}; };
svg.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, [e.clientX, e.clientY]); moveu = false; svg.classList.add('arrastando');
  if (ptrs.size === 1) arr = {x: e.clientX, y: e.clientY, V: V.slice()};
  else if (ptrs.size === 2) { arr = null; const p = dois(); pinca = {...p, V: V.slice(), u: usr(p.mx, p.my)}; }
});
window.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinca && ptrs.size === 2) {
    moveu = true; const p = dois(), w = Math.min(vmax(), Math.max(W / 40, pinca.V[2] * pinca.d / p.d));
    V[2] = w; V[0] = pinca.u[0] - p.mx / svg.clientWidth * w; V[1] = pinca.u[1] - p.my / svg.clientHeight * (w * svg.clientHeight / svg.clientWidth); aplica();
  } else if (arr) {
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    if (!moveu && Math.abs(dx) + Math.abs(dy) < 5) return;
    moveu = true;
    V[0] = arr.V[0] - dx / svg.clientWidth * V[2]; V[1] = arr.V[1] - dy / svg.clientHeight * V[3]; aplica();
  }
});
const solta = e => {
  ptrs.delete(e.pointerId); pinca = null;
  if (ptrs.size === 1) { const [x, y] = [...ptrs.values()][0]; arr = {x, y, V: V.slice()}; }
  else { arr = null; if (!ptrs.size) svg.classList.remove('arrastando'); }
};
window.addEventListener('pointerup', solta); window.addEventListener('pointercancel', solta);

addEventListener('keydown', e => {
  const p = V[2] * 0.1, k = e.key;
  if (k === '+' || k === '=') zoom(1.4); else if (k === '-' || k === '_') zoom(1 / 1.4);
  else if (k === 'ArrowLeft') { V[0] -= p; aplica(); } else if (k === 'ArrowRight') { V[0] += p; aplica(); }
  else if (k === 'ArrowUp') { V[1] -= p; aplica(); } else if (k === 'ArrowDown') { V[1] += p; aplica(); }
  else if (k === 'm' || k === 'M') svg.classList.toggle('com-mar');
  else if (k === '0') { V = [0, 0, vmax(), 0]; aplica(); }
});
addEventListener('resize', () => {
  V[2] = Math.min(V[2], vmax());
  if (Math.ceil(vmax() / W) !== kmaxAtual) montaCopias();
  aplica();
});

montaCopias();
V = [0, 0, vmax(), 0]; aplica();
