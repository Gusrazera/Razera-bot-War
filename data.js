// Dados do mapa. Sem módulos ES, para abrir direto do index.html (file://).
// Também funciona em Node: const WAR = require('./js/data.js')

const CONTINENTES = {
  na:{nome:"América do Norte",bonus:5,cor:"#e0a03c"},
  sa:{nome:"América do Sul",  bonus:2,cor:"#d9534f"},
  eu:{nome:"Europa",          bonus:5,cor:"#4f8cd9"},
  af:{nome:"África",          bonus:3,cor:"#b5835a"},
  as:{nome:"Ásia",            bonus:7,cor:"#4fb26b"},
  oc:{nome:"Oceania",         bonus:2,cor:"#a56fd1"}
};

// id: [nome, continente, x, y, "vizinhos (basta listar cada fronteira uma vez)"]
const DEF = {
  // América do Norte
  alasca:["Alasca","na",70,90,"mackenzie,vancouver,vladivostok"],
  mackenzie:["Mackenzie","na",150,80,"vancouver,ottawa,groenlandia"],
  groenlandia:["Groenlândia","na",300,50,"ottawa,labrador,islandia"],
  vancouver:["Vancouver","na",140,140,"ottawa,california"],
  ottawa:["Ottawa","na",215,140,"labrador,california,novayork"],
  labrador:["Labrador","na",285,140,"novayork"],
  california:["Califórnia","na",150,200,"novayork,mexico"],
  novayork:["Nova York","na",230,205,"mexico"],
  mexico:["México","na",175,265,"colombia"],
  // América do Sul
  colombia:["Colômbia","sa",235,325,"peru,brasil"],
  peru:["Peru","sa",225,390,"brasil,argentina"],
  brasil:["Brasil","sa",295,375,"argentina,argelia"],
  argentina:["Argentina","sa",255,450,""],
  // Europa
  islandia:["Islândia","eu",390,95,"inglaterra,suecia"],
  inglaterra:["Inglaterra","eu",385,150,"suecia,alemanha,portugal"],
  suecia:["Suécia","eu",470,100,"alemanha,moscou"],
  alemanha:["Alemanha","eu",470,155,"moscou,italia,portugal"],
  portugal:["Portugal","eu",410,215,"italia,argelia"],
  italia:["Itália","eu",490,210,"moscou,oriente,egito,argelia"],
  moscou:["Moscou","eu",560,140,"omsk,aral,oriente"],
  // África
  argelia:["Argélia","af",440,300,"egito,sudao,congo"],
  egito:["Egito","af",520,285,"oriente,sudao"],
  sudao:["Sudão","af",550,350,"congo,africadosul,madagascar,oriente"],
  congo:["Congo","af",495,380,"africadosul"],
  africadosul:["África do Sul","af",500,450,"madagascar"],
  madagascar:["Madagascar","af",580,445,""],
  // Ásia
  omsk:["Omsk","as",640,110,"dudinka,china,aral"],
  dudinka:["Dudinka","as",710,70,"iacutia,tchita,mongolia,china"],
  iacutia:["Iacútia","as",790,60,"tchita,vladivostok"],
  vladivostok:["Vladivostok","as",870,75,"tchita,mongolia,japao"],
  tchita:["Tchita","as",770,115,"mongolia"],
  mongolia:["Mongólia","as",790,170,"japao,china"],
  japao:["Japão","as",885,170,""],
  aral:["Aral","as",640,190,"china,india,oriente"],
  china:["China","as",730,215,"india,vietna"],
  oriente:["Oriente Médio","as",595,260,"india"],
  india:["Índia","as",680,275,"vietna"],
  vietna:["Vietnã","as",755,285,"sumatra"],
  // Oceania
  sumatra:["Sumatra","oc",770,360,"novaguine,perth"],
  novaguine:["Nova Guiné","oc",860,350,"sydney,perth"],
  perth:["Perth","oc",800,440,"sydney"],
  sydney:["Sydney","oc",880,435,""]
};

const TERRITORIOS = {};
for (const id in DEF){
  const [nome,continente,x,y] = DEF[id];
  TERRITORIOS[id] = {id,nome,continente,x,y,vizinhos:[]};
}
for (const id in DEF){
  for (const v of DEF[id][4].split(",").filter(Boolean)){
    if (!TERRITORIOS[v]) throw new Error(`Vizinho inexistente: ${id} -> ${v}`);
    if (!TERRITORIOS[id].vizinhos.includes(v)) TERRITORIOS[id].vizinhos.push(v);
    if (!TERRITORIOS[v].vizinhos.includes(id)) TERRITORIOS[v].vizinhos.push(id);
  }
}

const WAR = {CONTINENTES, TERRITORIOS};
if (typeof module !== "undefined") module.exports = WAR;
