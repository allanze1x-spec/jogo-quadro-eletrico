/* ============================================================================
   sim.js — "motor de simulação" do quadro elétrico.
   Constrói os nós elétricos (union-find) a partir dos fios montados e do
   estado dos contatos, e resolve bobinas / lâmpadas / motor por ponto fixo.

   O retorno do comando NÃO é neutro: o esquema alimenta as bobinas e as
   lâmpadas entre duas FASES (L2 pelo polo 2 do Q2 e L1 pelo polo 1). Por isso
   a regra de "carga energizada" aqui é: dois bornes em potenciais DIFERENTES
   (fase-fase, ou fase-neutro caso exista um neutro na montagem).
   ========================================================================== */

/* ---------------- utilidades ---------------- */
const keyPart = k => k.split(':')[0];
const keyTerm = k => k.split(':')[1];

/** Aceita "Q1:1" ou "Q1:*" */
function matchTerm(key, pattern) {
  if (pattern === key) return true;
  if (pattern.endsWith(':*')) return keyPart(key) === pattern.slice(0, -2);
  return false;
}

/** true se {a,b} casa com a missão (em qualquer ordem) */
function missionMatches(m, a, b) {
  return (matchTerm(a, m.a) && matchTerm(b, m.b)) ||
         (matchTerm(a, m.b) && matchTerm(b, m.a));
}

/* ---------------- union-find ---------------- */
function makeDSU() {
  const parent = {};
  const find = k => {
    if (parent[k] === undefined) parent[k] = k;
    while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; }
    return k;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  return { find, union };
}

/* Todos os terminais existentes: "PART:TERM" */
const ALL_TERMS = [];
PARTS.forEach(p => p.terms.forEach(t => ALL_TERMS.push(p.id + ':' + t.id)));
const ALL_TERM_SET = new Set(ALL_TERMS);

const PART_BY_ID = {};
PARTS.forEach(p => { PART_BY_ID[p.id] = p; });

/* ---------------- construção da rede ---------------- */
function buildNets(state, wires, coils) {
  const dsu = makeDSU();

  // garante que existam todos os terminais
  ALL_TERMS.forEach(t => dsu.find(t));

  // relé térmico: os contatos de potência conduzem (são só um caminho em série)
  INTERNAL.F1_power.forEach(([a, b]) => dsu.union(a, b));

  // barra de retorno: um único ponto elétrico
  const ret = INTERNAL.RET;
  ret.forEach(t => dsu.union(ret[0], t));

  // Q1 — chave seccionadora tripolar
  if (state.q1) [['1', '2'], ['3', '4'], ['5', '6']].forEach(([a, b]) => dsu.union('Q1:' + a, 'Q1:' + b));

  // Q2 — disjuntor do comando (bipolar)
  if (state.q2) [['1', '2'], ['3', '4']].forEach(([a, b]) => dsu.union('Q2:' + a, 'Q2:' + b));

  // contatores K1 / K2
  //  13-14 = NA da auto-retenção · 23-24 = NA da sinalização da marcha
  //  11-12 = NF do intertravamento · 21-22 = NF da sinalização (motor parado)
  ['K1', 'K2'].forEach(k => {
    if (coils[k]) {
      [['1', '2'], ['3', '4'], ['5', '6'], ['13', '14'], ['23', '24']]
        .forEach(([a, b]) => dsu.union(k + ':' + a, k + ':' + b));
    } else {
      dsu.union(k + ':11', k + ':12');   // NF de intertravamento fechado (K desligado)
      dsu.union(k + ':21', k + ':22');   // NF da sinalização fechado (K desligado)
    }
  });

  // botão de parada S0 (NF — abre quando apertado)
  if (!state.pressed.S0) dsu.union('S0:11', 'S0:12');

  // botões NA (fecham quando apertados)
  if (state.pressed.S1) dsu.union('S1:13', 'S1:14');
  if (state.pressed.S2) dsu.union('S2:13', 'S2:14');

  // relé térmico — contatos auxiliares
  if (state.f1Tripped) dsu.union('F1:97', 'F1:98');  // NA fecha → lâmpada de falha
  else dsu.union('F1:95', 'F1:96');                  // NF fechado → comando vivo

  // fios montados pelo jogador
  wires.forEach(w => {
    if (ALL_TERM_SET.has(w.a) && ALL_TERM_SET.has(w.b)) dsu.union(w.a, w.b);
  });

  // agrupa
  const nets = new Map();
  ALL_TERMS.forEach(t => {
    const r = dsu.find(t);
    let n = nets.get(r);
    if (!n) { n = { root: r, terms: [], phases: new Set(), hasN: false, hasLive: false }; nets.set(r, n); }
    n.terms.push(t);
    if (t === 'ENT:L1') n.phases.add(1);
    if (t === 'ENT:L2') n.phases.add(2);
    if (t === 'ENT:L3') n.phases.add(3);
    if (t === 'ENT:N') n.hasN = true;
  });

  const netOf = {};
  nets.forEach(n => n.terms.forEach(t => { netOf[t] = n; }));

  return { dsu, nets, netOf };
}

/* ---------------- simulação completa ---------------- */
function solve(state, wires, prev) {
  // parte do estado anterior: é isso que dá a histerese dos contatores
  // (auto-retenção pelo contato 13-14 e intertravamento pelo NF 11-12)
  let coils = { K1: !!(prev && prev.K1), K2: !!(prev && prev.K2) };
  let net = buildNets(state, wires, coils);

  // ponto fixo: bobina energizada fecha os contatos, que podem energizar outra bobina
  for (let i = 0; i < 10; i++) {
    const next = {
      K1: coilOn(net, 'K1'),
      K2: coilOn(net, 'K2'),
    };
    if (next.K1 === coils.K1 && next.K2 === coils.K2) break;
    coils = next;
    net = buildNets(state, wires, coils);
  }

  const res = { coils, net, faults: [], motor: { state: 'parado', dir: 0 }, lamps: {}, diagnostics: [] };

  // curto-circuito: duas fases no mesmo nó, ou fase direto no neutro
  net.nets.forEach(n => {
    if (n.phases.size >= 2) res.faults.push({ type: 'curto-fase-fase', net: n });
    else if (n.phases.size === 1 && n.hasN) res.faults.push({ type: 'curto-fase-neutro', net: n });
  });
  res.short = res.faults.length > 0;

  // lâmpadas
  ['H1', 'H2', 'H3', 'H4'].forEach(h => {
    res.lamps[h] = energized(net, h + ':X1', h + ':X2');
  });

  // motor
  const { u, v, w } = motorPhases(net);
  const powered = [u, v, w].filter(p => p !== null).length;
  if (powered === 0) res.motor.state = 'parado';
  else if (powered < 3) res.motor.state = 'falta-fase';
  else {
    const forward = ((v - u + 3) % 3 === 1) && ((w - v + 3) % 3 === 1);
    const reverse = ((u - v + 3) % 3 === 1) && ((v - w + 3) % 3 === 1);
    if (forward) { res.motor.state = 'girando'; res.motor.dir = 1; }
    else if (reverse) { res.motor.state = 'girando'; res.motor.dir = -1; }
    else { res.motor.state = 'falta-fase'; }
  }

  res.netOf = net.netOf;
  return res;
}

function coilOn(net, k) {
  return energized(net, k + ':A1', k + ':A2');
}

/**
 * Uma carga (bobina, lâmpada) está energizada quando os seus dois bornes estão
 * em nós DIFERENTES com potenciais ativos e diferentes entre si.
 * No esquema isso é fase-fase (L1 x L2 pelo Q2 bipolar); o neutro também vale
 * caso a montagem tenha um.
 */
function energized(net, ka, kb) {
  const a = net.netOf[ka], b = net.netOf[kb];
  if (!a || !b || a === b) return false;
  const pa = [...a.phases], pb = [...b.phases];
  const liveA = pa.length > 0 || a.hasN;
  const liveB = pb.length > 0 || b.hasN;
  if (!liveA || !liveB) return false;
  if (a.hasN && b.hasN) return false;                       // dois neutros = sem tensão
  if (pa.length && pb.length && pa.length === pb.length &&
      pa.every(p => pb.includes(p))) return false;          // mesma fase dos dois lados
  return true;
}

/** fase (1,2,3) presente em cada borne do motor — null se não houver */
function motorPhases(net) {
  const one = n => {
    if (!n || n.phases.size !== 1) return null;
    return [...n.phases][0];
  };
  return {
    u: one(net.netOf['M1:U']),
    v: one(net.netOf['M1:V']),
    w: one(net.netOf['M1:W']),
  };
}

/* ---------------- cor do cabo pelo potencial do nó ---------------- */
const WIRE_COLORS = {
  L1: '#d8342a', L2: '#1d1d1f', L3: '#2f6fe4',
  N: '#8b98a8', none: '#4b5563',
};

function wireColor(net, key) {
  const n = net.netOf[key];
  if (!n) return WIRE_COLORS.none;
  if (n.phases.size === 1) return WIRE_COLORS['L' + [...n.phases][0]];
  if (n.phases.size === 0 && n.hasN) return WIRE_COLORS.N;
  return WIRE_COLORS.none;
}

const PHASE_NAME = { 1: 'L1', 2: 'L2', 3: 'L3' };
