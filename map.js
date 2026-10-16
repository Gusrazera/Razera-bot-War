import { CONTINENTES as C, TERRITORIOS as T, MAR } from './data.js';
import { GEO } from './geo.js';

const NS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("map"), info = document.getElementById("info");
const el = (tag, attrs = {}, pai = svg) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  pai.appendChild(e); return e;
};
const lista = Object.values(T), V0 = GEO.viewBox.slice(), W = V0[2];
const chave = (a, b) => a < b ? a + "|" + b : b + "|" + a;
const marSet = new Set(MAR.map(([a, b]) => chave(a, b)));

el("path", {d: GEO.grade, class: "grade"});

// Cor: matiz do continente + 5 tons, escolhidos para vizinhos por terra nunca ficarem iguais
const tons = [30, 39, 48, 57, 66], idx = {};
for (const t of lista){
  const usados = new Set(t.vizinhos.filter(v => !marSet.has(chave(t.id, v)) && idx[v] !== undefined).map(v => idx[v]));
  idx[t.id] = Math.max(0, tons.findIndex((_, i) => !usados.has(i)));
}

// Territórios
const gs = {};
for (const t of lista){
  const geo = GEO.t[t.id];
  const g = el("g", {class: "terr", tabindex: 0, role: "button", "aria-label": t.nome});
  g.style.setProperty("--f", `hsl(${C[t.continente].h} 42% ${tons[idx[t.id]]}%)`);
  el("path", {d: geo.d, class: "pais"}, g);
  (geo.p || []).forEach(d => el("path", {d, class: "membro"}, g));  // países pequenos anexados
  gs[t.id] = g;
  g.addEventListener("pointerenter", () => mostrar(t)); g.addEventListener("pointerleave", limpar);
  g.addEventListener("focus", () => mostrar(t));        g.addEventListener("blur", limpar);
  g.addEventListener("click", () => { if (!moveu) mostrar(t); });
}

// Ligações por mar: salto curto entre os dois pontos de costa mais próximos
const elos = {};
MAR.forEach(([a, b], i) => {
  const [x1, y1, x2, y2] = GEO.mar[i];
  const mk = (p, q, r, s) => el("line", {x1: p, y1: q, x2: r, y2: s, class: "elo"});
  const ls = Math.abs(x1 - x2) > W / 2
    ? [mk(x1, y1, x1 < x2 ? V0[0] : W, y1), mk(x2, y2, x1 < x2 ? W : V0[0], y2)]   // dá a volta no mapa
    : [mk(x1, y1, x2, y2)];
  (elos[a] ||= []).push(...ls); (elos[b] ||= []).push(...ls);
});
const realce = el("path", {id: "realce"});

// Rótulos: grandes sempre; médios e pequenos aparecem conforme o zoom
const rank = {}; lista.slice().sort((p, q) => GEO.t[q.id].a - GEO.t[p.id].a).forEach((t, i) => rank[t.id] = i);
for (const t of lista){
  const {cx, cy} = GEO.t[t.id], i = rank[t.id];
  const r = el("g", {class: "rotulo " + (i < 35 ? "t0" : i < 90 ? "t1" : "t2")});
  el("circle", {cx, cy}, r);
  el("text", {x: cx, y: cy + 10}, r).textContent = t.nome;
}

function limpar(){
  svg.querySelectorAll(".sel,.viz,.ativo").forEach(e => e.classList.remove("sel", "viz", "ativo"));
  realce.removeAttribute("d");
}
function mostrar(t){
  limpar();
  gs[t.id].classList.add("sel");
  const terra = [], mar = [];
  for (const v of t.vizinhos){ gs[v].classList.add("viz"); (marSet.has(chave(t.id, v)) ? mar : terra).push(T[v].nome); }
  (elos[t.id] || []).forEach(l => l.classList.add("ativo"));
  realce.setAttribute("d", GEO.t[t.id].d);
  info.textContent = `${t.nome} · ${C[t.continente].nome}` +
    (t.inclui ? ` · inclui ${t.inclui.join(", ")}` : "") +
    ` · por terra: ${terra.join(", ") || "nenhum"}` + (mar.length ? ` · por mar: ${mar.join(", ")}` : "") + ".";
}

// Zoom e arrastar
let V = V0.slice(), moveu = false, arr = null;
const aplica = () => {
  svg.setAttribute("viewBox", V.map(n => +n.toFixed(2)).join(" "));
  const z = W / V[2]; svg.style.setProperty("--z", z); svg.dataset.n = z < 2.2 ? 0 : z < 4.5 ? 1 : 2;
};
const limita = () => { V[0] = Math.min(Math.max(V[0], V0[0]), V0[0] + W - V[2]); V[1] = Math.min(Math.max(V[1], V0[1]), V0[1] + V0[3] - V[3]); };
const zoom = (f, cx = V[0] + V[2] / 2, cy = V[1] + V[3] / 2) => {
  const nw = Math.min(W, Math.max(W / 14, V[2] / f)), k = nw / V[2];
  V = [cx - (cx - V[0]) * k, cy - (cy - V[1]) * k, nw, V[3] * k]; limita(); aplica();
};
const ponto = e => { const r = svg.getBoundingClientRect(); return [V[0] + (e.clientX - r.left) / r.width * V[2], V[1] + (e.clientY - r.top) / r.height * V[3]]; };
svg.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8, ...ponto(e)); }, {passive: false});
svg.addEventListener("pointerdown", e => { moveu = false; arr = {x: e.clientX, y: e.clientY, V: V.slice()}; });
window.addEventListener("pointermove", e => {
  if (!arr) return;
  const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
  if (!moveu && Math.abs(dx) + Math.abs(dy) < 5) return;
  moveu = true; const r = svg.getBoundingClientRect();
  V[0] = arr.V[0] - dx / r.width * V[2]; V[1] = arr.V[1] - dy / r.height * V[3]; limita(); aplica();
});
window.addEventListener("pointerup", () => { arr = null; });
document.getElementById("zmais").onclick = () => zoom(1.5);
document.getElementById("zmenos").onclick = () => zoom(1 / 1.5);
document.getElementById("zreset").onclick = () => { V = V0.slice(); aplica(); };
document.getElementById("mar").onchange = e => svg.classList.toggle("com-mar", e.target.checked);
aplica();

// Legenda
const leg = document.getElementById("legend");
for (const c in C){
  const n = lista.filter(t => t.continente === c).length;
  const li = document.createElement("li");
  li.innerHTML = `<i style="background:hsl(${C[c].h} 42% 48%)"></i>${C[c].nome} <span>${n} territórios, bônus +${C[c].bonus}</span>`;
  leg.appendChild(li);
}
console.log(`${lista.length} territórios, ${lista.reduce((s, t) => s + t.vizinhos.length, 0) / 2} ligações`);
