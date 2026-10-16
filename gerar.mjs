const rel = f => new URL("../" + f, import.meta.url);
fs.writeFileSync(rel("js/data.js"),
`// Gerado por tools/gerar.mjs — não edite à mão.
// vizinhos = fronteiras por terra + ligações por mar; MAR lista só as ligações por mar.
export const CONTINENTES = ${JSON.stringify(conts)};
export const TERRITORIOS = {\n${Object.values(territorios).map(t => "  " + t.id + ":" + JSON.stringify(t)).join(",\n")}\n};
export const MAR = ${JSON.stringify(marPares)};
export const WAR = { CONTINENTES, TERRITORIOS, MAR };
`);
