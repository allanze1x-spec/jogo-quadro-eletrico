/* ============================================================================
   tools/layout.js — confere a ARRANJO FÍSICO da placa contra o esquema.

       node tools/layout.js

   O esquema de referência tem uma leitura clara: à esquerda a cadeia de
   potência em coluna (entrada → Q1 → K1/K2 → F1 → motor) e à direita o comando
   (Q2 no alto, S0, os botões de partida) com as lâmpadas de sinalização na
   extrema direita e a barra de retorno por baixo de tudo — com a descida do
   terminal 2 do Q2 chegando reta na barra. Este script garante que a placa do
   jogo continue assim, sem peças sobrepostas.
   ========================================================================== */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'), ctx, { filename: 'data.js' });
const { PARTS, STAGE } = vm.runInContext('({ PARTS, STAGE })', ctx);

let pass = 0, fail = 0;
const out = [];
const check = (nome, ok, extra) => {
  ok ? pass++ : fail++;
  out.push(`  ${ok ? '\u001b[32m✔\u001b[0m' : '\u001b[31m✘\u001b[0m'} ${nome}${ok || !extra ? '' : '  → ' + extra}`);
};
const P = id => PARTS.find(p => p.id === id);
const box = p => ({ x1: p.x, y1: p.y, x2: p.x + p.w, y2: p.y + p.h });
const cx = p => p.x + p.w / 2;
const overlap = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 0 &&
  Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 0;
/* peça e o seu bloco auxiliar podem (devem) se encostar */
const par = (a, b) => a.replace(/x$/, '') === b.replace(/x$/, '');

/* -------------------------------------------------------- 1. sem sobrepor */
out.push('\u001b[1m1. Peças na placa (sem sobreposição)\u001b[0m');
const cols = [];
for (let i = 0; i < PARTS.length; i++) {
  for (let j = i + 1; j < PARTS.length; j++) {
    const a = PARTS[i], b = PARTS[j];
    if (par(a.id, b.id)) continue;
    if (a.kind === 'bus' || b.kind === 'bus') continue;
    if (overlap(box(a), box(b))) cols.push(`${a.id}×${b.id}`);
  }
}
check('nenhuma peça invade o espaço de outra', cols.length === 0, cols.join(', '));

const dentro = (b, x, y, m = 0) => x >= b.x1 - m && x <= b.x2 + m && y >= b.y1 - m && y <= b.y2 + m;
const invasores = [];
PARTS.forEach(p => p.terms.forEach(t => {
  PARTS.forEach(q => {
    if (q === p || par(p.id, q.id) || q.kind === 'bus') return;
    if (dentro(box(q), t.x, t.y, -6)) invasores.push(`${p.id}:${t.id} sobre ${q.id}`);
  });
}));
check('nenhum borne cai em cima de outra peça', invasores.length === 0, invasores.join(', '));

/* --------------------------------------------- 2. cadeia de potência (esq.) */
out.push('\n\u001b[1m2. Cadeia de potência — coluna da esquerda\u001b[0m');
const cmdIds = ['Q2', 'S0', 'S1', 'S2', 'H1', 'H2', 'H3', 'H4'];
const cmdX = Math.min(...cmdIds.map(id => P(id).x));
const potIds = ['ENT', 'Q1', 'K1', 'K2', 'F1', 'M1'];
check('entrada, Q1, K1, K2, F1 e M1 ficam todos à esquerda do comando',
  potIds.every(id => P(id).x + P(id).w <= cmdX + 1),
  potIds.filter(id => P(id).x + P(id).w > cmdX + 1).map(id => id + '→' + (P(id).x + P(id).w)).join(', '));
check('o F1 está ABAIXO do K1 (mesma coluna), como no esquema',
  P('F1').y > P('K1').y + P('K1').h && Math.abs(cx(P('F1')) - cx(P('K1'))) < 120,
  `F1.y=${P('F1').y} K1.y2=${P('K1').y + P('K1').h}`);
check('as saídas 2/4/6 do K1 caem em cima das entradas 1/3/5 do F1',
  ['2', '4', '6'].every((t, i) => {
    const a = P('K1').terms.find(x => x.id === t), b = P('F1').terms.find(x => x.id === ['1', '3', '5'][i]);
    return Math.abs(a.x - b.x) < 60 && b.y - a.y > 0 && b.y - a.y < 220;
  }));
check('o motor M1 pendura logo abaixo do F1',
  P('M1').y > P('F1').y + P('F1').h && Math.abs(cx(P('M1')) - cx(P('F1'))) < 140,
  `M1.xc=${cx(P('M1'))} F1.xc=${cx(P('F1'))}`);
/* o motor fica na mesma altura da barra (como no esquema), mas em coluna livre */
check('o motor não encosta na barra de retorno (colunas diferentes)',
  !overlap(box(P('M1')), box(P('RET'))),
  `M1 x=${P('M1').x}-${P('M1').x + P('M1').w} · barra x=${P('RET').x}-${P('RET').x + P('RET').w}`);
check('o F1 (com os auxiliares 95-98) fica na coluna de potência',
  P('F1x').x + P('F1x').w <= cmdX + 1);

/* --------------------------------------------- 3. comando e sinalização */
out.push('\n\u001b[1m3. Comando e sinalização — coluna da direita\u001b[0m');
check('Q2 abre a coluna de comando (é a peça mais ao alto)',
  ['Q2', 'S0', 'S1', 'S2', 'H1', 'H2', 'H3', 'H4'].every(id => P(id).y >= P('Q2').y - 1));
check('S0 (parada) vem abaixo do Q2 e antes dos botões de partida',
  P('S0').y > P('Q2').y + P('Q2').h && P('S1').y > P('S0').y && P('S2').y > P('S0').y);
check('S1 (frente) à esquerda do S2 (ré), na mesma altura — a divisão dos dois sentidos',
  P('S1').y === P('S2').y && cx(P('S1')) < cx(P('S2')));
check('as quatro lâmpadas ficam à direita dos botões',
  P('H1').x > P('S2').x + P('S2').w && ['H1', 'H2', 'H3', 'H4'].every(id => P(id).x > P('S0').x + P('S0').w),
  `H1.x=${P('H1').x} S2.x2=${P('S2').x + P('S2').w}`);
check('as lâmpadas estão na ordem do esquema: AM SC, VM MD, VD ML, VD 2R',
  P('H1').x < P('H2').x && P('H2').x < P('H3').x && P('H3').x < P('H4').x &&
  P('H1').lamp === 'H1' && P('H2').lamp === 'H2' && P('H3').lamp === 'H3' && P('H4').lamp === 'H4');
check('as lâmpadas ficam na mesma faixa vertical dos botões de partida',
  Math.abs(P('H1').y - P('S1').y) < 60);

/* --------------------------------------------- 4. barra de retorno (Q2:2) */
out.push('\n\u001b[1m4. Barra de retorno do comando\u001b[0m');
const bus = P('RET'), q2_2 = P('Q2').terms.find(t => t.id === '2');
/* tudo que passa por cima da barra tem de terminar antes dela */
const acima = PARTS.filter(p => p.kind !== 'bus' && p.x < bus.x + bus.w && p.x + p.w > bus.x)
  .filter(p => p.y + p.h > bus.y).map(p => p.id);
check('a barra de retorno fica abaixo de tudo o que passa por cima dela',
  acima.length === 0, acima.join(', '));
check('a barra começa sob o comando (não invade a coluna de potência)',
  bus.x >= cmdX - 60, `barra x=${bus.x} comando x=${cmdX}`);
check('a barra cobre todos os retornos (bobinas e lâmpadas)',
  ['H1', 'H2', 'H3', 'H4'].every(id => {
    const x2 = P(id).terms.find(t => t.id === 'X2').x;
    return x2 >= bus.x && x2 <= bus.x + bus.w;
  }));
/* o fio que desce do terminal 2 do Q2 vai reto até a barra, como no esquema */
const noCaminho = PARTS.filter(p => p.kind !== 'bus' && p.id !== 'Q2' &&
  box(p).x1 < q2_2.x && q2_2.x < box(p).x2 && p.y > q2_2.y && p.y < bus.y).map(p => p.id);
check('o terminal 2 do Q2 desce reto até a barra (corredor livre)',
  noCaminho.length === 0, noCaminho.join(', '));
check('a barra tem bornes suficientes para os 8 retornos (2 bobinas + 4 lâmpadas + Q2:2)',
  bus.terms.length >= 7, String(bus.terms.length));

/* --------------------------------------------- 5. palco */
out.push('\n\u001b[1m5. Dentro do palco\u001b[0m');
const fora = PARTS.flatMap(p => [p, ...p.terms.map(t => ({ id: p.id + ':' + t.id, x: t.x, y: t.y, w: 0, h: 0 }))])
  .filter(p => p.x < 0 || p.y < 0 || p.x + p.w > STAGE.w || p.y + p.h > STAGE.h).map(p => p.id);
check(`tudo dentro de ${STAGE.w}×${STAGE.h}`, fora.length === 0, fora.join(', '));

console.log(out.join('\n'));
console.log(`\n${pass} verificações OK, ${fail} falha(s).`);
process.exit(fail ? 1 : 0);
