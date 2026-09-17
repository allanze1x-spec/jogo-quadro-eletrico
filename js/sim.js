/* ============================================================================
   sim.js — "motor de simulação" do quadro.
   Monta os nós elétricos (union-find) a partir dos fios montados, dos contatos
   internos (declarados em data.js) e do estado da bancada; resolve bobinas,
   lâmpadas, motor e o inversor por ponto fixo.

   Potenciais: cada projeto declara as suas FONTES (L1/L2/L3 e, quando existe,
   a fonte de 24 V do inversor). Uma carga (bobina, lâmpada) está energizada
   quando os dois bornes caem em nós DIFERENTES, ambos com potencial, e os
   potenciais não são iguais — é assim que funciona tanto o comando em 380 V
   (fase x fase, sem neutro, como no esquema) quanto o comando em 24 V do
   inversor (fonte interna: +24 V x COM).
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

/* ---------------- derivados do projeto ativo ---------------- */
/* (recalculados por simInit() sempre que applyProject() troca a missão) */
let ALL_TERMS = [], ALL_TERM_SET = new Set(), PART_BY_ID = {};

function simInit() {
  ALL_TERMS = [];
  PARTS.forEach(p => p.terms.forEach(t => ALL_TERMS.push(p.id + ':' + t.id)));
  ALL_TERM_SET = new Set(ALL_TERMS);
  PART_BY_ID = {};
  PARTS.forEach(p => { PART_BY_ID[p.id] = p; });
}

/** índice da fonte (L1/L2/L3/V24/V0) que alimenta um terminal, ou null */
function sourceOf(key) {
  for (const s in SOURCES) if (SOURCES[s].includes(key)) return s;
  return null;
}

const setsEqual = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

/* ---------------- construção da rede ---------------- */
function buildNets(state, wires, coils) {
  const dsu = makeDSU();

  ALL_TERMS.forEach(t => dsu.find(t));

  // partes internas fixas (ex.: contatos de potência do relé térmico)
  (INTERNAL.statics || []).forEach(([a, b]) => dsu.union(a, b));
  // barra de retorno: todos os bornes são o mesmo ponto elétrico
  (INTERNAL.buses || []).forEach(bus => bus.forEach(t => dsu.union(bus[0], t)));

  /* contatos que dependem da bancada / das bobinas.
     O contexto carrega os dois jeitos de ler a bancada usados em data.js:
     direto (s.q1, s.pressed.S0) e agrupado (c.coils.K1). */
  const ctx = Object.assign({}, state, { state, coils, net: null });
  RULES.forEach(r => {
    if (r.when(ctx)) (r.close || []).forEach(([a, b]) => dsu.union(a, b));
  });

  // fios montados pelo jogador
  wires.forEach(w => {
    if (ALL_TERM_SET.has(w.a) && ALL_TERM_SET.has(w.b)) dsu.union(w.a, w.b);
  });

  let nets = groupNets(dsu);
  let netOf = toNetOf(nets);
  let dev = null;

  /* ---- inversor de frequência: relé de saída e caminho de potência ---- */
  if (VFD) {
    // o inversor lê as entradas digitais e as fases na rede já montada
    dev = vfdInfo({ nets, netOf }, coils, state);
    if (dev.fault) dsu.union(VFD.relay.c, VFD.relay.na);
    else dsu.union(VFD.relay.c, VFD.relay.nf);
    if (dev.run) {
      const [r, s, t] = VFD.power.in, [u, v, w] = VFD.power.out;
      const map = dev.rev ? [[r, w], [s, v], [t, u]] : [[r, u], [s, v], [t, w]];
      map.forEach(([x, y]) => dsu.union(x, y));
    }
    nets = groupNets(dsu);                          // reagrupa com o inversor dentro
    netOf = toNetOf(nets);
    dev = vfdInfo({ nets, netOf }, coils, state);   // estado final (para o painel)
  }

  return { dsu, nets, netOf, dev };
}

/** índice terminal → nó, para consultar potencial de um borne */
function toNetOf(nets) {
  const netOf = {};
  nets.forEach(n => n.terms.forEach(t => { netOf[t] = n; }));
  return netOf;
}

/** agrupa os terminais em nós e marca as fontes presentes em cada nó */
function groupNets(dsu) {
  const nets = new Map();
  ALL_TERMS.forEach(t => {
    const r = dsu.find(t);
    let n = nets.get(r);
    if (!n) { n = { root: r, terms: [], phases: new Set(), srcs: new Set() }; nets.set(r, n); }
    n.terms.push(t);
    const s = sourceOf(t);
    if (s) {
      n.srcs.add(s);
      if (s === 'L1') n.phases.add(1);
      if (s === 'L2') n.phases.add(2);
      if (s === 'L3') n.phases.add(3);
    }
  });
  return nets;
}

/* ---------------- simulação completa ---------------- */
function solve(state, wires, prev) {
  const ids = COILS.map(c => c.id);
  let coils = {};
  ids.forEach(id => { coils[id] = !!(prev && prev[id]); });

  let net = buildNets(state, wires, coils);
  // ponto fixo: bobina energizada fecha contatos, que podem energizar outra
  for (let i = 0; i < 14; i++) {
    const next = {};
    COILS.forEach(c => { next[c.id] = c.fn ? !!c.fn(net, coils, state) : energized(net, c.a, c.b); });
    const igual = ids.every(id => next[id] === coils[id]);
    coils = next;
    net = buildNets(state, wires, coils);
    if (igual) break;
  }

  const res = {
    coils, net, dev: net.dev, faults: [],
    motor: { state: 'parado', dir: 0, hz: 0 }, lamps: {}, diagnostics: [],
  };

  // curto-circuito: duas fases no mesmo nó, ou fonte lógica em curto
  net.nets.forEach(n => {
    if (n.phases.size >= 2) res.faults.push({ type: 'curto-fase-fase', net: n });
    else if (n.srcs.has('V24') && n.srcs.has('V0')) res.faults.push({ type: 'curto-fonte-24v', net: n });
  });
  res.short = res.faults.length > 0;

  // lâmpadas
  LAMPS.forEach(l => { res.lamps[l.id] = energized(net, l.a, l.b); });

  // motor
  if (VFD) {
    /* o sentido continua vindo da SEQUÊNCIA DE FASES que chega em U/V/W —
       assim um cabo trocado na saída aparece como motor girando ao contrário,
       igual à instalação de verdade. A frequência vem do inversor. */
    const d = net.dev;
    const { u, v, w } = motorPhases(net);
    const ligado = [u, v, w].every(p => p !== null);
    if (!d.run) res.motor.state = 'parado';
    else if (d.ref <= 0.001) res.motor.state = 'sem-ref';    // em RUN, mas sem referência de velocidade
    else if (!ligado) res.motor.state = 'falta-fase';
    else {
      const forward = ((v - u + 3) % 3 === 1) && ((w - v + 3) % 3 === 1);
      const reverse = ((u - v + 3) % 3 === 1) && ((v - w + 3) % 3 === 1);
      res.motor.state = 'girando';
      res.motor.dir = forward ? 1 : (reverse ? -1 : 0);
      res.motor.hz = d.hz;
      if (!res.motor.dir) res.motor.state = 'falta-fase';
    }
  } else {
    const { u, v, w } = motorPhases(net);
    const powered = [u, v, w].filter(p => p !== null).length;
    if (powered === 0) res.motor.state = 'parado';
    else if (powered < 3) res.motor.state = 'falta-fase';
    else {
      const forward = ((v - u + 3) % 3 === 1) && ((w - v + 3) % 3 === 1);
      const reverse = ((u - v + 3) % 3 === 1) && ((v - w + 3) % 3 === 1);
      if (forward) { res.motor.state = 'girando'; res.motor.dir = 1; res.motor.hz = 60; }
      else if (reverse) { res.motor.state = 'girando'; res.motor.dir = -1; res.motor.hz = 60; }
      else res.motor.state = 'falta-fase';
    }
  }

  res.netOf = net.netOf;
  return res;
}

/**
 * Uma carga está energizada quando os seus dois bornes estão em nós DIFERENTES,
 * ambos com potencial, e os potenciais não são o mesmo (fase x fase, fase x
 * neutro, ou +24 V x COM no comando do inversor).
 */
function energized(net, ka, kb) {
  if (!net || !net.netOf) return false;
  const a = net.netOf[ka], b = net.netOf[kb];
  if (!a || !b || a === b) return false;
  if (!a.srcs.size || !b.srcs.size) return false;
  const pa = [...a.phases], pb = [...b.phases];
  if (pa.length && pb.length) {
    return !(pa.length === pb.length && pa.every(p => pb.includes(p)));   // mesma fase: sem tensão
  }
  // um lado é potência e o outro é lógica (24 V): circuitos independentes
  if (!!pa.length !== !!pb.length) return false;
  return !setsEqual(a.srcs, b.srcs);
}

/** fase (1,2,3) presente em cada borne do motor — null se não houver */
function motorPhases(net) {
  const one = n => (n && n.phases.size === 1) ? [...n.phases][0] : null;
  return { u: one(net.netOf[MOTOR.u]), v: one(net.netOf[MOTOR.v]), w: one(net.netOf[MOTOR.w]) };
}

/* ============================================================================
   INVERSOR DE FREQUÊNCIA (CFW 500)
   Modelo reduzido ao que o painel ensina:
     · habilitação  = DI de parada (NF) + DI de habilitação geral (contato do
       contator de linha) — sem as duas o drive não arranca;
     · partida      = impulso na DI de start, com memória interna (comando a
       3 fios), como a auto-retenção de um contator;   · falha        = proteção eletrônica atuada na bancada (F051), que comuta
                    o relé RL1 e derruba o contator de linha;
   · fase faltando= uma ou duas fases na entrada (F022): o drive não parte —
                    é assim que um cabo de força cortado aparece no painel;
     · relé RL1     = NF fechado sem falha (derruba o contator na falha) e NA
       fechado na falha (lâmpada de sinalização);
     · saída U/V/W  = segue R/S/T quando em RUN; em REV troca duas fases.
   ========================================================================== */
function vfdInfo(net, coils, state) {
  if (!VFD) return null;
  const di = k => energized(net, VFD.di[k], VFD.com);

  const fases = VFD.power.in.map(t => {
    const n = net.netOf[t];
    return (n && n.phases.size === 1) ? [...n.phases][0] : null;
  });
  const nF = fases.filter(f => f !== null).length;          // fases na entrada R/S/T
  const powered = nF === 3 && new Set(fases).size === 3;
  /* F022: o drive tem uma ou duas fases e não arranca (cabo cortado na entrada).
     Diferente da falha F051, ele NÃO comuta o relé — sem as três fases ele
     simplesmente não parte, como na instalação de verdade. */
  const faseFaltando = nF > 0 && nF < 3;

  const enable = di('enable') && di('stop');
  const comandado = di('start') || (enable && !!coils.RUN);
  const fault = !!state.driveFault;
  const run = enable && comandado && !fault && powered;
  /* referência de velocidade: o app manda a posição do potenciômetro em
     state.ref (0..1); sem potenciômetro no projeto a referência é nominal */
  const ref = Math.max(0, Math.min(1, state.ref != null ? state.ref : 1));

  return {
    powered, enabled: enable, started: comandado, fault, faseFaltando, run,
    rev: run && di('dir'), ref, hz: run ? ref * (VFD.fmax || 60) : 0,
    di: { start: di('start'), stop: di('stop'), enable: di('enable'), dir: di('dir') },
    fases, nF,
  };
}

/* ---------------- cor do cabo pelo potencial do nó ---------------- */
/* Paleta do projeto: as fases usam a cor do condutor e o comando em 24 V usa
   o violeta da fonte interna — dá para ler o circuito inteiro pela cor. */
const WIRE_COLORS = {
  L1: '#ff7a17',   // L1 — laranja (sunset)
  L2: '#dadbdf',   // L2 — branco
  L3: '#a0c3ec',   // L3 — azul (breeze)
  V24: '#c4b5fd',  // +24 V do inversor — violeta (twilight)
  V0: '#7d8187',   // COM / 0 V — cinza
  none: '#4a4d53',
};

function wireColor(net, key) {
  const n = net && net.netOf && net.netOf[key];
  if (!n) return WIRE_COLORS.none;
  if (n.phases.size === 1) return WIRE_COLORS['L' + [...n.phases][0]];
  if (n.srcs.has('V24')) return WIRE_COLORS.V24;
  if (n.srcs.has('V0')) return WIRE_COLORS.V0;
  return WIRE_COLORS.none;
}

const PHASE_NAME = { 1: 'L1', 2: 'L2', 3: 'L3' };

/* o app e as ferramentas trocam de missão com applyProject() + simInit() */
simInit();
