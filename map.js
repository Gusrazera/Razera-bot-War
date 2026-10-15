(() => {
  const {CONTINENTES:C, TERRITORIOS:T} = WAR;
  const NS = "http://www.w3.org/2000/svg", W = 1000;
  const svg = document.getElementById("map"), info = document.getElementById("info");
  const el = (tag, attrs = {}, pai = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    pai.appendChild(e); return e;
  };
  const lista = Object.values(T);

  // Verificação rápida no console: Risk/War clássico = 42 territórios e 83 fronteiras
  const fronteiras = lista.reduce((s, t) => s + t.vizinhos.length, 0) / 2;
  console.log(`${lista.length} territórios, ${fronteiras} fronteiras`);

  // Continentes: casco convexo dos territórios, desenhado com traço grosso
  const hull = pts => {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
    const meia = p => { const h = []; for (const q of p){ while (h.length > 1 && cr(h[h.length-2], h[h.length-1], q) <= 0) h.pop(); h.push(q);} return h; };
    const baixo = meia(pts), cima = meia(pts.reverse());
    return baixo.slice(0, -1).concat(cima.slice(0, -1));
  };
  for (const c in C){
    const pts = hull(lista.filter(t => t.continente === c).map(t => [t.x, t.y]));
    el("polygon", {points: pts.map(p => p.join(",")).join(" "), class: "halo", fill: C[c].cor, stroke: C[c].cor});
  }

  // Fronteiras (tracejadas = ligação por mar / entre continentes)
  const elos = {};
  for (const a of lista) for (const id of a.vizinhos){
    const b = T[id]; if (a.id > b.id) continue;
    const mar = a.continente !== b.continente ? " mar" : "";
    const mk = (x1,y1,x2,y2) => el("line", {x1,y1,x2,y2, class: "elo" + mar});
    const ls = Math.abs(a.x - b.x) > W / 2
      ? [mk(a.x,a.y,0,a.y), mk(b.x,b.y,W,b.y)]   // Alasca ↔ Vladivostok dá a volta no mapa
      : [mk(a.x,a.y,b.x,b.y)];
    (elos[a.id] ||= []).push(...ls); (elos[b.id] ||= []).push(...ls);
  }

  // Territórios
  const nos = {};
  for (const t of lista){
    const g = el("g", {class: "terr", tabindex: 0, role: "button", "aria-label": t.nome});
    el("circle", {cx: t.x, cy: t.y, r: 15, fill: C[t.continente].cor}, g);
    const tx = el("text", {x: t.x, y: t.y + 28}, g); tx.textContent = t.nome;
    nos[t.id] = g;
    const on = () => mostrar(t), off = () => limpar();
    g.addEventListener("pointerenter", on); g.addEventListener("pointerleave", off);
    g.addEventListener("focus", on); g.addEventListener("blur", off);
    g.addEventListener("click", on);
  }

  function limpar(){
    svg.querySelectorAll(".sel,.viz").forEach(e => e.classList.remove("sel", "viz"));
    svg.querySelectorAll(".ativo").forEach(e => e.classList.remove("ativo"));
  }
  function mostrar(t){
    limpar();
    nos[t.id].classList.add("sel");
    t.vizinhos.forEach(v => nos[v].classList.add("viz"));
    (elos[t.id] || []).forEach(l => l.classList.add("ativo"));
    const c = C[t.continente];
    info.textContent = `${t.nome} · ${c.nome} · faz fronteira com ${t.vizinhos.map(v => T[v].nome).join(", ") || "ninguém"}.`;
  }

  // Legenda
  const leg = document.getElementById("legend");
  for (const c in C){
    const n = lista.filter(t => t.continente === c).length;
    const li = document.createElement("li");
    li.innerHTML = `<i style="background:${C[c].cor}"></i>${C[c].nome} <span>${n} territórios, bônus +${C[c].bonus}</span>`;
    leg.appendChild(li);
  }
})();
