/* ============================================================================
   tools/test.js — verificação automática do esquema (roda no Node, sem browser)

       node tools/test.js

   Carrega js/data.js + js/sim.js num contexto isolado, monta o quadro com a
   lista de missões (que reproduz o esquema elétrico) e confere o comportamento:
   partida frente, retenção, parada, ré, intertravamento, curto-circuito,
   relé térmico, inversão de fases, os dois polos do Q2, a barra de retorno e
   as quatro lâmpadas de sinalização.
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

/* cada "RET:*" cai num borne diferente da barra, como no esquema */
const used = new Set();
const pick = pat => {
  if (!pat.endsWith(':*')) return pat;
  const id = pat.slice(0, -2), terms = PART_BY_ID[id].terms;
  const free = terms.find(t => !used.has(id + ':' + t.id));
  const k = id + ':' + (free || terms[0]).id; used.add(k); return k;
};
function allWires() {
  used.clear();
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

/* -------------------------------------------------- 2. o esquema em si */
section('2. Fidelidade ao desenho (topologia do esquema)');
const has = (a, b) => wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
check('a entrada tem só L1, L2 e L3 (não existe neutro no esquema)',
  PARTS.find(p => p.id === 'ENT').terms.map(t => t.id).join(',') === 'L1,L2,L3' &&
  !PARTS.some(p => p.terms.some(t => t.id === 'N')));
check('Q1: o L1 vai no terminal 1, L2 no 3 e L3 no 5',
  has('ENT:L1', 'Q1:1') && has('ENT:L2', 'Q1:3') && has('ENT:L3', 'Q1:5'));
check('Q2 alimentado por DUAS fases: polo 1 (1) no L1 e polo 2 (3) no L2',
  has('ENT:L1', 'Q2:1') && has('ENT:L2', 'Q2:3'));
check('a SAÍDA do polo 1 do Q2 (2) é o retorno do comando (vai para a barra)',
  wires.some(w => w.a.startsWith('Q2:2') && w.b.startsWith('RET:')));
check('a SAÍDA do polo 2 do Q2 (4) é a fase do comando e da sinalização',
  has('Q2:4', 'F1:95') && has('Q2:4', 'F1:97') &&
  has('Q2:4', 'K1:21') && has('Q2:4', 'K1:23') && has('Q2:4', 'K2:23'));
check('as ENTRADAS do K2 são diretas (2→1, 4→3, 6→5)',
  has('Q1:2', 'K2:1') && has('Q1:4', 'K2:3') && has('Q1:6', 'K2:5'));
check('o cruzamento de fases da ré está na SAÍDA do K2 (2→F1:5 e 6→F1:1)',
  has('K2:2', 'F1:5') && has('K2:4', 'F1:3') && has('K2:6', 'F1:1'));
check('F1 na frente: K1:2→1, K1:4→3, K1:6→5',
  has('K1:2', 'F1:1') && has('K1:4', 'F1:3') && has('K1:6', 'F1:5'));
check('motor U, V e W saem de F1:2, F1:4 e F1:6',
  has('F1:2', 'M1:U') && has('F1:4', 'M1:V') && has('F1:6', 'M1:W'));
check('todo retorno (bobinas e lâmpadas) fecha na barra de retorno',
  ['K1:A2', 'K2:A2', 'H1:X2', 'H2:X2', 'H3:X2', 'H4:X2']
    .every(k => wires.some(w => (w.a === k || w.b === k) && (w.a.startsWith('RET:') || w.b.startsWith('RET:')))));
check('cada lâmpada tem contato próprio: F1 97-98, K1/K2 NF 21-22 e NA 23-24',
  has('F1:98', 'H1:X1') && has('K1:22', 'K2:21') && has('K2:22', 'H2:X1') &&
  has('K1:24', 'H3:X1') && has('K2:24', 'H4:X1'));
check('o NF 11-12 de cada contator é o intertravamento do outro',
  has('S1:14', 'K2:11') && has('K2:12', 'K1:A1') && has('S2:14', 'K1:11') && has('K1:12', 'K2:A1'));
check('a retenção 13-14 fica em paralelo com o botão de partida',
  has('S0:12', 'K1:13') && has('K2:11', 'K1:14') && has('S0:12', 'K2:13') && has('K1:11', 'K2:14'));

/* -------------------------------------------------- 3. circuitos completos */
section('3. Continuidade dos circuitos (quadro montado)');
const pot = MISSIONS.filter(m => m.sec === 'pot').length;
const com = MISSIONS.filter(m => m.sec === 'com').length;
const sig = MISSIONS.filter(m => m.sec === 'sig').length;
check(`potência (${pot}), comando (${com}), sinalização (${sig}) — total 48 cabos do esquema`,
  pot === 18 && com === 17 && sig === 13 && MISSIONS.length === 48, `${pot}/${com}/${sig}`);

let m = run(state({ q1: true }), wires);
const faseEm = (r, t) => [...(r.netOf[t].phases || [])].join('') || '—';
check('sem contator fechado o motor fica sem fase (parado)',
  ['M1:U', 'M1:V', 'M1:W'].every(t => faseEm(m.res, t) === '—'));
check('com o Q2 desligado o comando não tem fase nenhuma',
  faseEm(m.res, 'F1:95') === '—' && faseEm(m.res, 'K1:A1') === '—');
check('com o Q2 desligado a barra de retorno fica morta',
  faseEm(m.res, 'RET:R1') === '—');

m = run(state({ q1: true, q2: true }), wires);
check('com o Q2 ligado o polo 2 leva L2 ao comando e à sinalização',
  faseEm(m.res, 'F1:95') === '2' && faseEm(m.res, 'F1:97') === '2' && faseEm(m.res, 'K1:21') === '2',
  faseEm(m.res, 'F1:95'));
check('com o Q2 ligado o polo 1 devolve L1 pela barra de retorno (comando em 380 V)',
  faseEm(m.res, 'RET:R1') === '1' && faseEm(m.res, 'K1:A2') === '1', faseEm(m.res, 'RET:R1'));

m = run(state({ q1: true, q2: true, pressed: { S1: true } }), wires);
check('K1 ligado energiza U/V/W em sequência 1-2-3',
  [faseEm(m.res, 'M1:U'), faseEm(m.res, 'M1:V'), faseEm(m.res, 'M1:W')].join(',') === '1,2,3',
  ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(','));

/* -------------------------------------------------- 4. partida frente */
section('4. Partida frente (S1) e auto-retenção');
m = run(state({ q1: true, q2: true, pressed: { S0: false, S1: true, S2: false } }), wires, m.prev);
check('S1 energiza K1', m.res.coils.K1 === true);
check('K2 desenergizado', m.res.coils.K2 === false);
check('motor gira no sentido horário', m.res.motor.state === 'girando' && m.res.motor.dir === 1);
check('lâmpada de falha (H1, AM SC) apagada', m.res.lamps.H1 === false);
check('lâmpada da marcha frente (H3, VD ML) acesa', m.res.lamps.H3 === true);
check('lâmpada VM MD (motor parado) apagada com o motor girando', m.res.lamps.H2 === false);
check('lâmpada da ré (H4, VD 2R) apagada', m.res.lamps.H4 === false);
check('sem curto-circuito', m.res.short === false);

m = run(state({ q1: true, q2: true }), wires, m.prev);   // solta o S1
check('auto-retenção 13-14 mantém K1 depois de soltar S1', m.res.coils.K1 === true && m.res.motor.dir === 1);
check('com a frente ligada: verde da frente acesa e VM MD apagada',
  m.res.lamps.H3 === true && m.res.lamps.H2 === false);

/* -------------------------------------------------- 5. parada / ré */
section('5. Parada (S0) e marcha ré (S2)');
m = run(state({ q1: true, q2: true, pressed: { S0: true } }), wires, m.prev);
check('S0 (NF) desenergiza K1', m.res.coils.K1 === false && m.res.motor.state === 'parado');
m = run(state({ q1: true, q2: true }), wires, m.prev);
check('com tudo parado acende a VM MD (NF 21-22 dos dois contatores em série)',
  m.res.lamps.H2 === true && m.res.lamps.H3 === false && m.res.lamps.H4 === false);

m = run(state({ q1: true, q2: true, pressed: { S2: true } }), wires, m.prev);
check('S2 energiza K2 com a ré cruzada', m.res.coils.K2 === true && m.res.coils.K1 === false);
check('motor gira no sentido anti-horário', m.res.motor.state === 'girando' && m.res.motor.dir === -1);
check('na ré acende a VD 2R (H4) e a VM MD apaga', m.res.lamps.H4 === true && m.res.lamps.H2 === false);
check('na ré a sequência de fases chega invertida em U/V/W (3-2-1)',
  [faseEm(m.res, 'M1:U'), faseEm(m.res, 'M1:V'), faseEm(m.res, 'M1:W')].join(',') === '3,2,1',
  ['M1:U', 'M1:V', 'M1:W'].map(t => faseEm(m.res, t)).join(','));

/* -------------------------------------------------- 6. intertravamento */
section('6. Intertravamento (NF 11-12 cruzados)');
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

/* -------------------------------------------------- 7. relé térmico */
section('7. Relé térmico F1 (95-96 / 97-98)');
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), wires);
m = run(state({ q1: true, q2: true, f1Tripped: true }), wires, m.prev);
check('95-96 abriu ⇒ contatores desligados', m.res.coils.K1 === false && m.res.coils.K2 === false);
check('motor parado', m.res.motor.state === 'parado');
check('97-98 fechou ⇒ lâmpada de falha AM SC (H1) acesa', m.res.lamps.H1 === true);
// a sinalização é alimentada direto pela saída 4 do Q2: com o motor parado,
// a VM MD acende junto com a AM SC (é o que o painel mostra ao operador)
check('com o relé atuado as marchas apagam e a VM MD (motor parado) acende',
  m.res.lamps.H2 === true && m.res.lamps.H3 === false && m.res.lamps.H4 === false);
m = run(state({ q1: true, q2: true, f1Tripped: true, pressed: { S1: true } }), wires, m.prev);
check('com F1 atuado a partida não funciona', m.res.coils.K1 === false);
m = run(state({ q1: true, q2: true }), wires, m.prev);
check('depois do rearme, a lâmpada de falha apaga', m.res.lamps.H1 === false);

/* -------------------------------------------------- 8. fases invertidas */
section('8. Sentido de rotação × sequência de fases');
// troca as duas fases da SAÍDA do K2 (montagem errada, mas sem curto): a ré passa a girar como a frente
const trocado = wires.map(w => {
  if (w.a === 'K2:2' && w.b === 'F1:5') return { ...w, b: 'F1:1' };
  if (w.a === 'K2:6' && w.b === 'F1:1') return { ...w, b: 'F1:5' };
  return w;
});
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), trocado);
check('com as saídas do K2 trocadas a ré gira ao contrário (horário)',
  m.res.motor.state === 'girando' && m.res.motor.dir === 1 && m.res.short === false);

// e a montagem correta gira invertida
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), wires);
check('na montagem correta a ré gira anti-horário', m.res.motor.dir === -1);

/* -------------------------------------------------- 9. falta de fase */
section('9. Diagnóstico de falta de fase');
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

/* -------------------------------------------------- 10. curtos diretos */
section('10. Curtos-circuitos');
m = run(state({ q1: true }), wires.concat([{ a: 'ENT:L1', b: 'ENT:L2', mission: null }]));
check('L1 ↔ L2 em curto', m.res.short === true);
m = run(state({ q1: true, q2: true }), wires.concat([{ a: 'ENT:L2', b: 'RET:R1', mission: null }]));
check('fase do comando (L2) direto na barra de retorno (L1) ⇒ curto', m.res.short === true);
check('quadro correto nunca apresenta curto em repouso', run(state({ q1: true, q2: true }), wires).res.short === false);

/* ---------------------------------------- 11. modo manutenção (defeitos) */
section('11. Modo manutenção — defeitos escondidos');
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
check('1041: K1 fecha, sinalização ok, mas o motor não parte (falta fase)',
  m.res.coils.K1 === true && m.res.motor.state === 'falta-fase' && m.res.lamps.H3 === true);

// O.S. 1042 — retorno do K2 solto
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), comDefeito('re-sem-retorno'));
check('1042: a ré não fecha contator e não há curto', m.res.coils.K2 === false && m.res.short === false);
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), comDefeito('re-sem-retorno'));
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
// a sinalização não passa pelo 95-96: a VM MD continua acesa indicando que o
// motor está parado — é essa a pista que separa o comando morto da falta geral
check('1044: nenhum contator fecha e só a VM MD fica acesa',
  m.res.coils.K1 === false && m.res.coils.K2 === false &&
  !m.res.lamps.H1 && m.res.lamps.H2 === true && !m.res.lamps.H3 && !m.res.lamps.H4,
  JSON.stringify(m.res.lamps));

// O.S. 1045 — lâmpadas de marcha trocadas
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), comDefeito('sinalizacao-trocada'));
check('1045: na frente acende a lâmpada da ré (H4) e não a da frente (H3)',
  m.res.motor.dir === 1 && m.res.lamps.H4 === true && m.res.lamps.H3 === false);
m = run(state({ q1: true, q2: true, pressed: { S2: true } }), comDefeito('sinalizacao-trocada'));
check('1045: na ré acende a da frente (H3) e não a da ré (H4)',
  m.res.motor.dir === -1 && m.res.lamps.H3 === true && m.res.lamps.H4 === false);

// O.S. 1046 — intertravamento eliminado (retém, mas as duas marchas fecham juntas)
d1 = comDefeito('sem-intertravamento');
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), d1);
const soS1 = run(state({ q1: true, q2: true }), d1, m.prev);
check('1046: a frente retém normalmente', soS1.res.coils.K1 === true && soltaK1.res.short === false);
m = run(state({ q1: true, q2: true, pressed: { S1: true, S2: true } }), d1, soS1.prev);
check('1046: apertando a ré junto, K1 e K2 fecham e dá curto-circuito',
  m.res.coils.K1 === true && m.res.coils.K2 === true && m.res.short === true,
  JSON.stringify(m.res.coils) + ' short=' + m.res.short);

// O.S. 1047 — lâmpada de falha sem retorno
m = run(state({ q1: true, q2: true, f1Tripped: true }), comDefeito('falha-sem-retorno'));
check('1047: relé atuado mas a lâmpada de falha não acende',
  m.res.lamps.H1 === false && m.res.lamps.H2 === true);

// O.S. 1048 — sem indicação de motor parado
m = run(state({ q1: true, q2: true }), comDefeito('parado-sem-lampada'));
check('1048: com tudo parado a VM MD não acende', m.res.lamps.H2 === false);
m = run(state({ q1: true, q2: true, pressed: { S1: true } }), comDefeito('parado-sem-lampada'));
check('1048: as marchas continuam sinalizando certo',
  m.res.coils.K1 === true && m.res.lamps.H3 === true);

// o reparo é sempre voltar a fiação do esquema
const norm = w => w.map(x => [x.a, x.b].map(k => k.replace(/^RET:R\d+$/, 'RET:*')).sort().join('~')).sort().join('|');
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
