/* ============================================================================
   tools/test.js — verificação automática das duas missões (Node, sem browser)

       node tools/test.js

   Carrega js/data.js + js/sim.js num contexto isolado e, para cada missão,
   monta o quadro com a própria lista de ligações e confere:
     M1 (reversão)  — topologia do esquema, frente, retenção, parada, ré com
                      fases trocadas, intertravamento, relé térmico, defeitos;
     M2 (inversor)  — ramal do drive, comando 380 V do contator com o relé RL1
                      em série, comando 24 V das DIs, referência do
                      potenciômetro, falha F051, reset e defeitos.
   ========================================================================== */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
for (const f of ['js/data.js', 'js/sim.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const ev = expr => vm.runInContext(expr, ctx);

/* ---------------------------------------------------------------- helpers */
let pass = 0, fail = 0;
const results = [];
function check(name, cond, extra) {
  if (cond) { pass++; results.push('  \u001b[32m✔\u001b[0m ' + name); }
  else { fail++; results.push('  \u001b[31m✘\u001b[0m ' + name + (extra ? '  → ' + extra : '')); }
}
const section = t => results.push('\n\u001b[1m' + t + '\u001b[0m');

function useProject(id) {
  ev(`applyProject(${JSON.stringify(id)}); simInit();`);
  return ev('PROJECT');
}

/** monta a fiação do projeto: cada "RET:*" cai no borne mais próximo do par */
function allWires() {
  const MISSIONS = ev('MISSIONS'), PBI = ev('PART_BY_ID');
  const used = new Set();
  const posOf = k => {
    const [id, t] = k.split(':');
    const p = PBI[id];
    const tr = p && p.terms.find(x => x.id === t);
    return tr ? tr.x : 0;
  };
  const pick = (pat, other) => {
    if (!pat.endsWith(':*')) return pat;
    const id = pat.slice(0, -2), terms = PBI[id].terms;
    const ox = posOf(other);
    const livres = terms.filter(t => !used.has(id + ':' + t.id));
    const pool = livres.length ? livres : terms;
    const best = pool.reduce((a, t) => Math.abs(t.x - ox) < Math.abs(a.x - ox) ? t : a, pool[0]);
    used.add(id + ':' + best.id);
    return id + ':' + best.id;
  };
  return MISSIONS.map((m, i) => {
    const a = pick(m.a, m.b), b = pick(m.b, m.a);
    return { a, b, ok: true, mission: i, id: i + 1 };
  });
}

const BASE = {
  q1: false, q2: false, pressed: { S0: false, S1: false, S2: false },
  f1Tripped: false, driveFault: false, ref: 1,
};
const state = over => Object.assign({}, BASE, { pressed: Object.assign({}, BASE.pressed) }, over);
const pr = (over = {}) => Object.assign({ S0: false, S1: false, S2: false }, over);

const solve = ev('solve');
function run(st, wires, prev) { const res = solve(st, wires, prev); return { res, prev: res.coils }; }
const faseEm = (r, t) => [...(r.netOf[t].phases || [])].join('') || '—';
const has = (wires, a, b) => wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
const testSteps = () => ev('TESTS');
const Defects = () => ev('DEFECTS');

/* ==========================================================================
   MISSÃO 01 — QUADRO DE REVERSÃO DE ROTAÇÃO
   ========================================================================== */
section('M1 · 1. Lista de ligações × esquema');
const P1 = useProject('reversao');
let wires = allWires();
{
  const MISSIONS = ev('MISSIONS');
  check('toda missão tem ligação válida (bornes existem)',
    wires.every(w => ev('PART_BY_ID')[w.a.split(':')[0]] && ev('PART_BY_ID')[w.b.split(':')[0]]));
  check('nenhuma ligação duplicada',
    new Set(wires.map(w => [w.a, w.b].sort().join('~'))).size === wires.length);
  check('ordem do esquema: potência → comando → sinalização',
    MISSIONS.findIndex(m => m.sec === 'com') > MISSIONS.findIndex(m => m.sec === 'pot') &&
    MISSIONS.findIndex(m => m.sec === 'sig') > MISSIONS.findIndex(m => m.sec === 'com'));
  check('48 ligações em 3 seções (18 / 17 / 13)',
    MISSIONS.length === 48 &&
    MISSIONS.filter(m => m.sec === 'pot').length === 18 &&
    MISSIONS.filter(m => m.sec === 'com').length === 17 &&
    MISSIONS.filter(m => m.sec === 'sig').length === 13);
  check('a entrada tem só L1, L2 e L3 (não existe neutro no esquema)',
    ev('PART_BY_ID')['ENT'].terms.map(t => t.id).join(',') === 'L1,L2,L3');
}

section('M1 · 2. Fidelidade ao desenho (topologia)');
{
  check('Q1 na entrada: L1→1, L2→3, L3→5', has(wires, 'ENT:L1', 'Q1:1') && has(wires, 'ENT:L2', 'Q1:3') && has(wires, 'ENT:L3', 'Q1:5'));
  check('Q2 alimentado por DUAS fases (polo 1 no L1, polo 2 no L2)',
    has(wires, 'ENT:L1', 'Q2:1') && has(wires, 'ENT:L2', 'Q2:3'));
  check('saída 2 do Q2 é o retorno do comando (vai para a barra)',
    wires.some(w => w.a === 'Q2:2' && w.b.startsWith('RET:')));
  check('as entradas do K2 são diretas (2→1, 4→3, 6→5)',
    has(wires, 'Q1:2', 'K2:1') && has(wires, 'Q1:4', 'K2:3') && has(wires, 'Q1:6', 'K2:5'));
  check('o cruzamento da ré está na SAÍDA do K2 (2→F1:5 e 6→F1:1)',
    has(wires, 'K2:2', 'F1:5') && has(wires, 'K2:4', 'F1:3') && has(wires, 'K2:6', 'F1:1'));
  check('na frente as fases vão diretas: K1:2→F1:1, K1:4→F1:3, K1:6→F1:5',
    has(wires, 'K1:2', 'F1:1') && has(wires, 'K1:4', 'F1:3') && has(wires, 'K1:6', 'F1:5'));
  check('motor sai de F1:2/4/6 em U/V/W',
    has(wires, 'F1:2', 'M1:U') && has(wires, 'F1:4', 'M1:V') && has(wires, 'F1:6', 'M1:W'));
  check('cada lâmpada tem contato próprio (97-98, NF 21-22 e NA 23-24)',
    has(wires, 'F1:98', 'H1:X1') && has(wires, 'K1:22', 'K2:21') && has(wires, 'K2:22', 'H2:X1') &&
    has(wires, 'K1:24', 'H3:X1') && has(wires, 'K2:24', 'H4:X1'));
  check('intertravamento: o NF 11-12 de cada contator alimenta a bobina do outro',
    has(wires, 'S1:14', 'K2:11') && has(wires, 'K2:12', 'K1:A1') &&
    has(wires, 'S2:14', 'K1:11') && has(wires, 'K1:12', 'K2:A1'));
  check('retenção 13-14 em paralelo com os botões de partida',
    has(wires, 'S0:12', 'K1:13') && has(wires, 'K2:11', 'K1:14') &&
    has(wires, 'S0:12', 'K2:13') && has(wires, 'K1:11', 'K2:14'));
}

section('M1 · 3. Circuitos energizados');
{
  let m = run(state({ q1: true }), wires);
  check('sem contator fechado o motor fica sem fase', ['M1:U', 'M1:V', 'M1:W'].every(t => faseEm(m.res, t) === '—'));
  check('com Q2 desligado o comando e a barra ficam mortos',
    faseEm(m.res, 'F1:95') === '—' && faseEm(m.res, 'RET:R1') === '—');
  m = run(state({ q1: true, q2: true }), wires);
  check('Q2 ligado: L2 no comando e L1 devolvida pela barra (comando em 380 V)',
    faseEm(m.res, 'F1:95') === '2' && faseEm(m.res, 'RET:R1') === '1' && faseEm(m.res, 'K1:A2') === '1');
  check('quadro correto não apresenta curto em repouso', m.res.short === false);
}

section('M1 · 4. Partida, retenção, parada e ré');
{
  let m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), wires);
  check('S1 energiza K1 e o motor gira no sentido horário',
    m.res.coils.K1 === true && m.res.coils.K2 === false && m.res.motor.dir === 1);
  check('frente: VD ML acesa, VM MD apagada, falha apagada',
    m.res.lamps.H3 === true && m.res.lamps.H2 === false && m.res.lamps.H1 === false);
  check('fases 1-2-3 nos bornes do motor', ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(',') === '1,2,3');
  m = run(state({ q1: true, q2: true }), wires, m.prev);
  check('auto-retenção 13-14 mantém K1 com o S1 solto', m.res.coils.K1 === true);
  let s = run(state({ q1: true, q2: true, pressed: pr({ S0: true }) }), wires, m.prev);
  check('S0 (NF) derruba o contator e o motor para', s.res.coils.K1 === false && s.res.motor.state === 'parado');
  m = run(state({ q1: true, q2: true }), wires, s.prev);
  check('com tudo parado acende a VM MD', m.res.lamps.H2 === true && m.res.lamps.H3 === false);
  m = run(state({ q1: true, q2: true, pressed: pr({ S2: true }) }), wires, m.prev);
  check('S2 energiza K2 e o motor gira invertido', m.res.coils.K2 === true && m.res.motor.dir === -1);
  check('na ré as fases chegam 3-2-1', ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(',') === '3,2,1');
  check('na ré acende a VD 2R', m.res.lamps.H4 === true && m.res.lamps.H2 === false);
}

section('M1 · 5. Intertravamento e proteção');
{
  let m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), wires);
  m = run(state({ q1: true, q2: true }), wires, m.prev);
  m = run(state({ q1: true, q2: true, pressed: pr({ S2: true }) }), wires, m.prev);
  check('com K1 ligado, S2 não fecha o K2 e não há curto', m.res.coils.K2 === false && m.res.short === false);
  m = run(state({ q1: true, q2: true, f1Tripped: true }), wires);
  check('relé térmico atuado: contatores caem e a AM SC acende', m.res.coils.K1 === false && m.res.lamps.H1 === true);
  m = run(state({ q1: true, q2: true }), wires, m.prev);
  check('depois do rearme a lâmpada de falha apaga', m.res.lamps.H1 === false);
  const semFase = wires.filter(w => !(w.a === 'F1:6' && w.b === 'M1:W'));
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), semFase);
  check('fio do W faltando ⇒ falta fase', m.res.motor.state === 'falta-fase');
  const tri = wires.concat([{ a: 'ENT:L1', b: 'ENT:L2', mission: null }]);
  check('L1 ↔ L2 em curto', run(state({ q1: true }), tri).res.short === true);
}

section('M1 · 6. Testes de funcionamento e defeitos');
{
  const T = testSteps();
  check('6 passos de teste com id/tarefa/porquê/verificação',
    T.length === 6 && T.every(s => s.id && s.title && s.task && s.why && typeof s.ok === 'function'));
  const D = Defects();
  check('8 defeitos com sintoma, causa, medição e reparo',
    D.length === 8 && D.every(d => d.os && d.titulo && d.sintoma && d.causa && d.medir && typeof d.montar === 'function'));
  const norm = w => w.map(x => [x.a, x.b].map(k => k.replace(/^RET:R\d+$/, 'RET:*')).sort().join('~')).sort().join('|');
  check('todo defeito altera de verdade a fiação e o reparo volta ao esquema',
    D.every(d => { const g = allWires(); return norm(g.map(x => ({ ...x }))) === norm(allWires()) && norm(d.montar(g.map(x => ({ ...x })))) !== norm(g); }));
  const d1 = D.find(d => d.id === 'motor-sem-W').montar(allWires().map(x => ({ ...x })));
  let m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), d1);
  check('1041: K1 fecha e sinaliza, mas o motor não parte', m.res.coils.K1 && m.res.motor.state === 'falta-fase' && m.res.lamps.H3);
  const d6 = D.find(d => d.id === 'sem-intertravamento').montar(allWires().map(x => ({ ...x })));
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true, S2: true }) }), d6);
  check('1046: sem intertravamento K1 e K2 fecham juntos ⇒ curto', m.res.coils.K1 && m.res.coils.K2 && m.res.short);
  const d3 = D.find(d => d.id === 'sem-retencao').montar(allWires().map(x => ({ ...x })));
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), d3);
  const solto = run(state({ q1: true, q2: true }), d3, m.prev);
  check('1043: soltando o S1 o K1 cai (sem retenção)', m.res.coils.K1 && !solto.res.coils.K1);
}

/* ==========================================================================
   MISSÃO 02 — QUADRO COM INVERSOR CFW 500
   ========================================================================== */
section('M2 · 1. Lista de ligações do projeto');
const P2 = useProject('inversor');
wires = allWires();
{
  const MISSIONS = ev('MISSIONS');
  check('37 ligações em 3 seções (12 potência · 14 comando 380 V · 11 comando 24 V)',
    MISSIONS.length === 37 &&
    MISSIONS.filter(m => m.sec === 'pot').length === 12 &&
    MISSIONS.filter(m => m.sec === 'ctl').length === 14 &&
    MISSIONS.filter(m => m.sec === 'io').length === 11,
    `${MISSIONS.length}/${MISSIONS.filter(m => m.sec === 'pot').length}/${MISSIONS.filter(m => m.sec === 'ctl').length}/${MISSIONS.filter(m => m.sec === 'io').length}`);
  check('nenhuma ligação duplicada e todos os bornes existem',
    new Set(wires.map(w => [w.a, w.b].sort().join('~'))).size === wires.length &&
    wires.every(w => ev('PART_BY_ID')[w.a.split(':')[0]] && ev('PART_BY_ID')[w.b.split(':')[0]]));
  check('ordem: potência → comando do contator → comando 24 V',
    MISSIONS.findIndex(m => m.sec === 'ctl') > MISSIONS.findIndex(m => m.sec === 'pot') &&
    MISSIONS.findIndex(m => m.sec === 'io') > MISSIONS.findIndex(m => m.sec === 'ctl'));
}

section('M2 · 2. Potência: Q1 → K1 → inversor → motor');
{
  check('Q1 na entrada: L1→1, L2→3, L3→5', has(wires, 'ENT:L1', 'Q1:1') && has(wires, 'ENT:L2', 'Q1:3') && has(wires, 'ENT:L3', 'Q1:5'));
  check('contator de linha entre o Q1 e o inversor',
    has(wires, 'Q1:2', 'K1:1') && has(wires, 'Q1:4', 'K1:3') && has(wires, 'Q1:6', 'K1:5'));
  check('saída do contator nos bornes R, S e T do drive',
    has(wires, 'K1:2', 'CFW:R') && has(wires, 'K1:4', 'CFW:S') && has(wires, 'K1:6', 'CFW:T'));
  check('saída U, V e W do drive no motor, sem cruzamento',
    has(wires, 'CFW:U', 'M1:U') && has(wires, 'CFW:V', 'M1:V') && has(wires, 'CFW:W', 'M1:W'));
}

section('M2 · 3. Comando 380 V do contator com o relé do inversor em série');
{
  check('Q2 bipolar: polo 1 no L1 (retorno) e polo 2 no L2 (fase)',
    has(wires, 'ENT:L1', 'Q2:1') && has(wires, 'ENT:L2', 'Q2:3'));
  check('saída 2 do Q2 na barra de retorno', wires.some(w => w.a === 'Q2:2' && w.b.startsWith('RET:')));
  check('a fase do comando entra no contato do relé (RL1-C)',
    has(wires, 'Q2:4', 'CFW:RL1-C'));
  check('o contato NF do relé alimenta a parada S0 (falha derruba o contator)',
    has(wires, 'CFW:RL1-NF', 'S0:11'));
  check('marcha S1 no A1 do contator com retenção 13-14',
    has(wires, 'S0:12', 'S1:13') && has(wires, 'S1:14', 'K1:A1') &&
    has(wires, 'S0:12', 'K1:13') && has(wires, 'K1:14', 'K1:A1'));
  check('retorno da bobina do K1 na barra', wires.some(w => (w.a === 'K1:A2' || w.b === 'K1:A2') && (w.a.startsWith('RET:') || w.b.startsWith('RET:'))));
  check('lâmpada de falha pelo contato NA do relé (RL1-NA)',
    has(wires, 'CFW:RL1-NA', 'H1:X1'));
  check('lâmpada de quadro energizado direto da fase do comando',
    has(wires, 'Q2:4', 'H2:X1'));
}

section('M2 · 4. Comando 24 V (DIs) e referência pelo potenciômetro');
{
  check('+24 V nos dois blocos NF do S0 e no botão de sentido S2',
    has(wires, 'CFW:+24V', 'S0:21') && has(wires, 'CFW:+24V', 'S2:13'));
  check('S0 em série com a partida (S0:22 → S1:23 → DI1)',
    has(wires, 'S0:22', 'S1:23') && has(wires, 'S1:24', 'CFW:DI1'));
  check('DI2 (parada) alimentado depois do S0', has(wires, 'S0:22', 'CFW:DI2'));
  check('DI3 (habilitação geral) pelo contato auxiliar 33-34 do contator',
    has(wires, 'CFW:+24V', 'K1:33') && has(wires, 'K1:34', 'CFW:DI3'));
  check('DI4 (sentido) pelo botão S2', has(wires, 'S2:14', 'CFW:DI4'));
  check('potenciômetro em +10 V / AI1 / GND',
    has(wires, 'CFW:+10V', 'RP1:1') && has(wires, 'RP1:2', 'CFW:AI1') && has(wires, 'RP1:3', 'CFW:GND'));
}

section('M2 · 5. Comportamento do inversor');
{
  let m = run(state({ q1: true, q2: true }), wires);
  check('quadro energizado: contator aberto, drive sem potência e sem habilitação',
    m.res.coils.K1 === false && m.res.dev.powered === false && m.res.dev.enabled === false &&
    m.res.dev.run === false && m.res.lamps.H2 === true && m.res.lamps.H1 === false);
  check('sem curto-circuito e sem falha', m.res.short === false && m.res.dev.fault === false);

  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), wires, m.prev);
  check('S1 fecha o contator K1 e habilita o drive', m.res.coils.K1 === true && m.res.dev.enabled === true);
  check('o drive parte em RUN/FWD e o motor gira no sentido horário',
    m.res.dev.run === true && m.res.dev.rev === false && m.res.motor.state === 'girando' && m.res.motor.dir === 1);
  check('fases 1-2-3 na saída do inversor', ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(',') === '1,2,3');
  check('frequência = referência × 60 Hz', Math.abs(m.res.motor.hz - 60) < .01, String(m.res.motor.hz));

  m = run(state({ q1: true, q2: true }), wires, m.prev);
  check('memória interna: o motor continua girando com o S1 solto', m.res.dev.run === true && m.res.motor.dir === 1);

  m = run(state({ q1: true, q2: true, ref: 0 }), wires, m.prev);
  check('sem referência o drive fica em RUN com 0 Hz e o motor não gira',
    m.res.dev.run === true && m.res.motor.state === 'sem-ref');

  m = run(state({ q1: true, q2: true, pressed: pr({ S2: true }) }), wires, m.prev);
  check('S2 (DI4) inverte o sentido: REV e motor anti-horário',
    m.res.dev.rev === true && m.res.motor.dir === -1);
  check('na ré a saída do drive troca duas fases (3-2-1)',
    ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(',') === '3,2,1');

  m = run(state({ q1: true, q2: true, pressed: pr({ S0: true }) }), wires, m.prev);
  check('S0 derruba o contator e para o inversor', m.res.coils.K1 === false && m.res.dev.run === false && m.res.motor.state === 'parado');
  check('a lâmpada de quadro energizado continua acesa', m.res.lamps.H2 === true);

  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), wires);
  m = run(state({ q1: true, q2: true, driveFault: true }), wires, m.prev);
  check('falha F051: relé comuta, contator cai, motor para e a AM SC acende',
    m.res.dev.fault === true && m.res.coils.K1 === false && m.res.motor.state === 'parado' && m.res.lamps.H1 === true);
  m = run(state({ q1: true, q2: true }), wires, m.prev);
  check('depois do reset a lâmpada de falha apaga e o drive não religa sozinho',
    m.res.dev.fault === false && m.res.lamps.H1 === false && m.res.dev.run === false);
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), wires, m.prev);
  check('um novo toque no S1 parte o motor outra vez', m.res.dev.run === true && m.res.motor.dir === 1);
}

section('M2 · 6. Diagnóstico: faltas típicas no quadro do inversor');
{
  const semPot = wires.filter(w => !(w.a === 'RP1:2' && w.b === 'CFW:AI1'));
  let m = run(state({ q1: true, q2: true, pot: 1 }), semPot);
  m = run(state({ q1: true, q2: true, ref: 0, pressed: pr({ S1: true }) }), semPot, m.prev);
  check('sem o cursor do potenciômetro o drive fica em RUN a 0 Hz (motor parado)',
    m.res.dev.run === true && m.res.motor.state === 'sem-ref');

  const semW = wires.filter(w => !(w.a === 'CFW:W' && w.b === 'M1:W'));
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), semW);
  check('cabo do motor aberto ⇒ falta fase na saída', m.res.motor.state === 'falta-fase');

  const semFase = wires.filter(w => !(w.a === 'K1:6' && w.b === 'CFW:T'));
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), semFase);
  check('uma fase faltando na entrada ⇒ contator fecha, drive em F022 e motor parado',
    m.res.coils.K1 === true && m.res.dev.faseFaltando === true && m.res.dev.powered === false &&
    m.res.dev.run === false && m.res.motor.state === 'parado' && m.res.lamps.H1 === false);
}

section('M2 · 7. Testes de funcionamento e defeitos');
{
  const T = testSteps();
  check('7 passos de teste com id/tarefa/porquê/verificação',
    T.length === 7 && T.every(s => s.id && s.title && s.task && s.why && typeof s.ok === 'function'));
  const D = Defects();
  check('6 defeitos com sintoma, causa, medição e reparo',
    D.length === 6 && D.every(d => d.os && d.titulo && d.sintoma && d.causa && d.medir && typeof d.montar === 'function'));
  const norm = w => w.map(x => [x.a, x.b].map(k => k.replace(/^RET:R\d+$/, 'RET:*')).sort().join('~')).sort().join('|');
  check('todo defeito altera a fiação e o reparo volta ao projeto',
    D.every(d => { const g = allWires(); return norm(d.montar(g.map(x => ({ ...x })))) !== norm(g) && norm(g) === norm(allWires()); }));

  const comDef = id => D.find(d => d.id === id).montar(allWires().map(x => ({ ...x })));

  let w2 = comDef('ref-sem-sinal');
  let m = run(state({ q1: true, q2: true, ref: 0, pressed: pr({ S1: true }) }), w2);
  check('2001: drive em RUN e motor parado (referência não chega no AI1)',
    m.res.dev.run === true && m.res.motor.state === 'sem-ref');

  w2 = comDef('rele-trocado');
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), w2);
  check('2002: relé invertido (NA em vez de NF) ⇒ nada liga',
    m.res.coils.K1 === false && m.res.dev.run === false && m.res.lamps.H1 === false);

  w2 = comDef('di3-sem-habilitacao');
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), w2);
  check('2003: contator fecha mas o drive fica em READY (sem habilitação)',
    m.res.coils.K1 === true && m.res.dev.run === false && m.res.dev.enabled === false);

  w2 = comDef('sentido-sem-fio');
  m = run(state({ q1: true, q2: true }), w2);
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), w2, m.prev);
  m = run(state({ q1: true, q2: true, pressed: pr({ S2: true }) }), w2, m.prev);
  check('2004: sem o fio do DI4 o sentido não muda', m.res.dev.run === true && m.res.dev.rev === false && m.res.motor.dir === 1);

  w2 = comDef('fase-motor-trocada');
  m = run(state({ q1: true, q2: true, pressed: pr({ S1: true }) }), w2);
  check('2005: fases trocadas na saída ⇒ motor gira ao contrário em FWD',
    m.res.dev.rev === false && m.res.motor.dir === -1);

  w2 = comDef('falha-sempre-acesa');
  m = run(state({ q1: true, q2: true }), w2);
  check('2006: lâmpada de falha acesa sem falha nenhuma',
    m.res.dev.fault === false && m.res.lamps.H1 === true);
}

/* ------------------------------------------------------------------ saída */
console.log(results.join('\n'));
console.log(`\n${pass} verificações OK, ${fail} falha(s).`);
process.exit(fail ? 1 : 0);
