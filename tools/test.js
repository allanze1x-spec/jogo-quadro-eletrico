/* ============================================================================
   tools/test.js — verificação automática do esquema (roda no Node, sem browser)

       node tools/test.js

   Carrega js/data.js + js/sim.js num contexto isolado, monta o quadro com a
   lista de missões (que reproduz o esquema elétrico) e confere o comportamento:
   partida frente, retenção, parada, ré, intertravamento, curto-circuito,
   relé térmico e inversão de fases.
   ========================================================================== */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
for (const f of ['js/data.js', 'js/sim.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const { PARTS, MISSIONS, solve, missionMatches } = vm.runInContext(
  '({ PARTS, MISSIONS, solve, missionMatches })', ctx);
const PART_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));

/* ---------------------------------------------------------------- helpers */
let pass = 0, fail = 0;
const results = [];
function check(name, cond, extra) {
  if (cond) { pass++; results.push('  \u001b[32m✔\u001b[0m ' + name); }
  else { fail++; results.push('  \u001b[31m✘\u001b[0m ' + name + (extra ? '  → ' + extra : '')); }
}
const section = t => results.push('\n\u001b[1m' + t + '\u001b[0m');

const pick = pat => pat.endsWith(':*')
  ? pat.slice(0, -2) + ':' + PART_BY_ID[pat.slice(0, -2)].terms[0].id
  : pat;

function allWires() {
  return MISSIONS.map((m, i) => ({ a: pick(m.a), b: pick(m.b), ok: true, mission: i, id: i + 1 }));
}
const state = (over = {}) => Object.assign({
  q1: false, q2: false, pressed: { S0: false, S1: false, S2: false }, f1Tripped: false,
}, over);
/** resolve mantendo a memória das bobinas (histerese dos contatores) */
function run(st, wires, prev) {
  const res = solve(st, wires, prev);
  return { res, prev: res.coils };
}

/* -------------------------------------------------- 1. lista de ligações */
section('1. Lista de ligações × esquema');
const wires = allWires();
check('toda missão tem uma ligação válida (bornes existem)',
  wires.every(w => PARTS.some(p => p.id === w.a.split(':')[0]) && PARTS.some(p => p.id === w.b.split(':')[0]))
  && MISSIONS.every((m, i) => missionMatches(m, wires[i].a, wires[i].b)));
check('nenhuma ligação duplicada',
  new Set(wires.map(w => [w.a, w.b].sort().join('~'))).size === wires.length);
check('a ordem do esquema é potência → comando → sinalização',
  MISSIONS.findIndex(m => m.sec === 'com') > MISSIONS.findIndex(m => m.sec === 'pot') &&
  MISSIONS.findIndex(m => m.sec === 'sig') > MISSIONS.findIndex(m => m.sec === 'com'));

/* -------------------------------------------------- 2. circuitos completos */
section('2. Continudade dos circuitos (quadro montado)');
const pot = MISSIONS.filter(m => m.sec === 'pot').length;
const com = MISSIONS.filter(m => m.sec === 'com').length;
const sig = MISSIONS.filter(m => m.sec === 'sig').length;
check(`potência (${pot}), comando (${com}), sinalização (${sig})`, pot === 18 && com === 17 && sig === 11,
  `${pot}/${com}/${sig}`);

let m = run(state({ q1: true }), wires);
const faseEm = (r, t) => [...(r.netOf[t].phases || [])].join('') || '—';
check('sem contator fechado o motor fica sem fase (parado)',
  ['M1:U', 'M1:V', 'M1:W'].every(t => faseEm(m.res, t) === '—'));

m = run(state({ q1: true, q2: true, pressed: { S1: true } }), wires);
check('K1 ligado energiza U/V/W em sequência 1-2-3',
  [faseEm(m.res, 'M1:U'), faseEm(m.res, 'M1:V'), faseEm(m.res, 'M1:W')].join(',') === '1,2,3',
  ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(','));

/* -------------------------------------------------- 3. partida frente */
section('3. Partida frente (S1) e auto-retenção');
m = run(state({ q1: true, q2: true, pressed: { S0: false, S1: true, S2: false } }), wires, m.prev);
check('S1 energiza K1', m.res.coils.K1 === true);
check('K1 desenergizado (K2 off)', m.res.coils.K2 === false);
check('motor gira no sentido horário', m.res.motor.state === 'girando' && m.res.motor.dir === 1);
check('lâmpada de alimentação (H1) acesa', m.res.lamps.H1 === true);
check('lâmpada frente (H2) acesa e ré (H3) apagada', m.res.lamps.H2 === true && m.res.lamps.H3 === false);
check('lâmpada de falha (H4) apagada', m.res.lamps.H4 === false);
check('sem curto-circuito', m.res.short === false);

m = run(state({ q1: true, q2: true }), wires, m.prev);   // solta o S1
check('auto-retenção 13-14 mantém K1 depois de soltar S1', m.res.coils.K1 === true && m.res.motor.dir === 1);

/* -------------------------------------------------- 4. parada / ré */
section('4. Parada (S0) e marcha ré (S2)');
m = run(state({ q1: true, q2: true, pressed: { S0: true } }), wires, m.prev);
check('S0 (NF) desenergiza K1', m.res.coils.K1 === false && m.res.motor.state === 'parado');

m = run(state({ q1: true, q2: true, pressed: { S2: true } }), wires, m.prev);
check('S2 energiza K2 com a ré cruzada', m.res.coils.K2 === true && m.res.coils.K1 === false);
check('motor gira no sentido anti-horário', m.res.motor.state === 'girando' && m.res.motor.dir === -1);
check('lâmpada ré (H3) acesa e frente (H2) apagada', m.res.lamps.H3 === true && m.res.lamps.H2 === false);
check('na ré a sequência de fases chega invertida em U/V/W (3-2-1)',
  [faseEm(m.res, 'M1:U'), faseEm(m.res, 'M1:V'), faseEm(m.res, 'M1:W')].join(',') === '3,2,1',
  ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(','));

/* -------------------------------------------------- 5. intertravamento */
section('5. Intertravamento (NF 11-12 cruzados)');
m = run(state({ q1: true, q2: true, pressed: { S0: false, S1: true } }), wires);
m = run(state({ q1: true, q2: true }), wires, m.prev);            // K1 retido
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), wires, m.prev);
check('com K1 ligado, S2 não energiza K2', m.res.coils.K2 === false && m.res.coils.K1 === true);
check('e não há curto-circuito', m.res.short === false);

// montagem ERRADA: sem intertravamento (bobinas ligadas direto nos botões)
const semTrav = wires.filter(w => !((w.a === 'K2:11' && w.b === 'S1:14') || (w.a === 'K1:11' && w.b === 'S0:12') ||
  (w.a === 'S0:12' && w.b === 'K2:13') || (w.a === 'K2:14' && w.b === 'K1:11')))
  .concat([{ a: 'S1:14', b: 'K1:A1', mission: null }, { a: 'S2:14', b: 'K2:A1', mission: null }]);
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), semTrav);
m = run(state({ q1: true, q2: true }), semTrav, m.prev);
check('sem intertravamento K1 fica retido (retenção própria)', m.res.coils.K1 === true);
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), semTrav, m.prev);
check('K1 + K2 juntos ⇒ curto-circuito fase-fase detectado',
  m.res.coils.K1 === true && m.res.coils.K2 === true && m.res.short === true,
  JSON.stringify(m.res.coils) + ' short=' + m.res.short);

/* -------------------------------------------------- 6. relé térmico */
section('6. Relé térmico F1 (95-96 / 97-98)');
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), wires);
m = run(state({ q1: true, q2: true, f1Tripped: true }), wires, m.prev);
check('95-96 abriu ⇒ contatores desligados', m.res.coils.K1 === false && m.res.coils.K2 === false);
check('motor parado', m.res.motor.state === 'parado');
check('97-98 fechou ⇒ lâmpada de falha acesa', m.res.lamps.H4 === true);
check('lâmpada de alimentação continua acesa (Q2 ligado)', m.res.lamps.H1 === true);
m = run(state({ q1: true, q2: true, f1Tripped: true, pressed: { S1: true } }), wires, m.prev);
check('com F1 atuado a partida não funciona', m.res.coils.K1 === false);
m = run(state({ q1: true, q2: true }), wires, m.prev);
check('depois do rearme, H4 apaga', m.res.lamps.H4 === false);

/* -------------------------------------------------- 7. fases invertidas */
section('7. Sentido de rotação × sequência de fases');
// troca duas fases na saída do Q2 para o K2 (montagem errada, mas sem curto)
const trocado = wires.map(w => {
  if (w.a === 'Q1:2' && w.b === 'K2:5') return { ...w, b: 'K2:1' };
  if (w.a === 'Q1:6' && w.b === 'K2:1') return { ...w, b: 'K2:5' };
  return w;
});
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), trocado);
check('com 2 fases trocadas no K2 a ré gira ao contrário (horário)',
  m.res.motor.state === 'girando' && m.res.motor.dir === 1 && m.res.short === false);

/* -------------------------------------------------- 8. falta de fase */
section('8. Diagnóstico de falta de fase');
const semFase = wires.filter(w => !(w.a === 'F1:6' && w.b === 'M1:W'));
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), semFase);
check('fio faltando no W ⇒ motor não parte (falta fase)', m.res.motor.state === 'falta-fase');
const semFaseU = wires.filter(w => !(w.a === 'F1:2' && w.b === 'M1:U'));
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), semFaseU);
check('fio faltando no U ⇒ falta fase também na ré', m.res.motor.state === 'falta-fase');
const semRet = wires.filter(w => !((w.a === 'S0:12' && w.b === 'K1:13') || (w.a === 'K2:11' && w.b === 'K1:14')));
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), semRet);
const solto = run(state({ q1: true, q2: true }), semRet, m.prev);
check('sem o contato 13-14 o K1 não se mantém (motor para)',
  solto.res.coils.K1 === false && solto.res.motor.state === 'parado');

/* -------------------------------------------------- 9. curtos diretos */
section('9. Curtos-circuitos');
m = run(state({ q1: true }), wires.concat([{ a: 'ENT:L1', b: 'ENT:L2', mission: null }]));
check('L1 ↔ L2 em curto', m.res.short === true);
m = run(state({ q1: true }), wires.concat([{ a: 'ENT:L1', b: 'BN:N1', mission: null }]));
check('L1 ↔ neutro em curto', m.res.short === true);
check('quadro correto nunca apresenta curto em repouso', run(state({ q1: true, q2: true }), wires).res.short === false);

/* ---------------------------------------- 10. modo manutenção (defeitos) */
section('10. Modo manutenção — defeitos escondidos');
const DEFECTS_T = vm.runInContext('DEFECTS', ctx);
const def = id => DEFECTS_T.find(d => d.id === id);
const comDefeito = id => def(id).montar(allWires().map(w => ({ ...w })));

check('todos os defeitos têm sintoma, causa, dica de medição e reparo',
  DEFECTS_T.every(d => d.id && d.os && d.titulo && d.sintoma && d.causa && d.medir && typeof d.montar === 'function'),
  DEFECTS_T.filter(d => !d.sintoma || !d.medir).map(d => d.id).join(','));
check('todo defeito realmente altera a fiação (nada de defeito fantasma)',
  DEFECTS_T.every(d => {
    const w = d.montar(allWires().map(x => ({ ...x })));
    return w.length !== allWires().length ||
      w.map(x => x.a + '~' + x.b).sort().join() !== allWires().map(x => x.a + '~' + x.b).sort().join();
  }));

// O.S. 1041 — cabo do motor faltando
let d1 = comDefeito('motor-sem-W');
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), d1);
check('1041: K1 fecha, lâmpadas ok, mas o motor não parte (falta fase)',
  m.res.coils.K1 === true && m.res.motor.state === 'falta-fase' && m.res.lamps.H2 === true);

// O.S. 1042 — neutro do K2 solto
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), comDefeito('re-sem-neutro'));
check('1042: a ré não fecha contator e não há curto', m.res.coils.K2 === false && m.res.short === false);
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), comDefeito('re-sem-neutro'));
check('1042: a frente continua funcionando', m.res.coils.K1 === true && m.res.motor.dir === 1);

// O.S. 1043 — sem auto-retenção (as duas marchas)
d1 = comDefeito('sem-retencao');
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), d1);
const soltaK1 = run(state({ q1: true, q2: true }), d1, m.prev);
check('1043: soltando o S1 o K1 cai (não retém)', m.res.coils.K1 === true && soltaK1.res.coils.K1 === false);
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), d1);
const soltaK2 = run(state({ q1: true, q2: true }), d1, m.prev);
check('1043: o K2 também não retém', m.res.coils.K2 === true && soltaK2.res.coils.K2 === false);

// O.S. 1044 — comando sem fase
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), comDefeito('comando-sem-fase'));
check('1044: nada fecha, mas a lâmpada de alimentação acende',
  m.res.coils.K1 === false && m.res.coils.K2 === false && m.res.lamps.H1 === true);

// O.S. 1045 — lâmpadas de marcha trocadas
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), comDefeito('sinalizacao-trocada'));
check('1045: na frente acende a amarela (H3) e não a verde',
  m.res.motor.dir === 1 && m.res.lamps.H3 === true && m.res.lamps.H2 === false);
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), comDefeito('sinalizacao-trocada'));
check('1045: na ré acende a verde (H2) e não a amarela',
  m.res.motor.dir === -1 && m.res.lamps.H2 === true && m.res.lamps.H3 === false);

// O.S. 1046 — intertravamento eliminado (retém, mas as duas marchas fecham juntas)
d1 = comDefeito('sem-intertravamento');
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), d1);
const soS1 = run(state({ q1: true, q2: true }), d1, m.prev);
check('1046: a frente retém normalmente', soS1.res.coils.K1 === true && soltaK1.res.short === false);
m = run(state({ q1: true, q2: true, pressed: { S1: true, S2: true } }), d1, soS1.prev);
check('1046: apertando a ré junto, K1 e K2 fecham e dá curto-circuito',
  m.res.coils.K1 === true && m.res.coils.K2 === true && m.res.short === true,
  JSON.stringify(m.res.coils) + ' short=' + m.res.short);

// O.S. 1047 — lâmpada de falha sem neutro
m = run(state({ q1: true, q2: true, f1Tripped: true }), comDefeito('falha-sem-neutro'));
check('1047: relé atuado mas a lâmpada de falha não acende',
  m.res.lamps.H4 === false && m.res.lamps.H1 === true);

// o reparo é sempre voltar a fiação do esquema
const norm = w => w.map(x => [x.a, x.b].map(k => k.replace(/^BN:N\d+$/, 'BN:*')).sort().join('~')).sort().join('|');
check('reparar = voltar à fiação do esquema (todos os defeitos)',
  DEFECTS_T.every(d => {
    const g = allWires();
    const com = d.montar(g.map(x => ({ ...x })));
    return norm(com) !== norm(g) && norm(g) === norm(allWires());
  }));

/* ------------------------------------------------------------------ saída */
console.log(results.join('\n'));
console.log(`\n${pass} verificações OK, ${fail} falha(s).`);
process.exit(fail ? 1 : 0);
