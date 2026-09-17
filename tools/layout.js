/* ============================================================================
   tools/layout.js — confere o ARRANJO FÍSICO das placas contra os esquemas.

       node tools/layout.js

   Cada projeto tem a sua leitura: na placa de reversão a cadeia de potência é
   uma coluna à esquerda (entrada → Q1 → K1/K2 → F1 → motor) e o comando fica à
   direita, com a barra de retorno por baixo; na placa do inversor a coluna de
   potência desce até o drive (Q1 → K1 → CFW 500 → motor) e o comando ocupa a
   faixa da direita. Este script garante que as duas continuem assim, sem peças
   sobrepostas e sem dois bornes na mesma coordenada.
   ========================================================================== */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'), ctx, { filename: 'data.js' });
const PROJECTS = vm.runInContext('PROJECTS', ctx);

/* o que cada placa precisa respeitar */
const EXPECT = {
  reversao: {
    power: ['Q1', 'K1', 'K2', 'F1', 'M1'],   // coluna da esquerda, de cima para baixo
    cmd: ['Q2', 'S0', 'S1', 'S2', 'H1', 'H2', 'H3', 'H4'],
    lamps: ['H1', 'H2', 'H3', 'H4'],
    start: 'S1',
    /* S0 (parada) acima e os dois sentidos lado a lado embaixo */
    botoes: 'coluna',
    zones: 'potência à esquerda, comando e sinalização à direita',
  },
  inversor: {
    power: ['Q1', 'K1', 'CFW', 'M1'],
    cmd: ['Q2', 'RP1', 'S0', 'S1', 'S2', 'H1', 'H2'],
    lamps: ['H1', 'H2'],
    start: 'S1',
    /* posto de comando do painel: parada, marcha e sentido na mesma fileira */
    botoes: 'fileira',
    zones: 'potência (drive) à esquerda, comando à direita',
  },
};

let pass = 0, fail = 0;
const out = [];
const check = (nome, ok, extra) => {
  ok ? pass++ : fail++;
  out.push(`  ${ok ? '\u001b[32m✔\u001b[0m' : '\u001b[31m✘\u001b[0m'} ${nome}${ok || !extra ? '' : '  → ' + extra}`);
};
const box = p => ({ x1: p.x, y1: p.y, x2: p.x + p.w, y2: p.y + p.h });
const cx = p => p.x + p.w / 2;
const overlap = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 0 &&
  Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 0;
/* peça e o seu bloco auxiliar podem (devem) se encostar */
const par = (a, b) => a.replace(/x$/, '') === b.replace(/x$/, '');
const within = (b, x, y, m = 0) => x >= b.x1 - m && x <= b.x2 + m && y >= b.y1 - m && y <= b.y2 + m;

for (const id of Object.keys(EXPECT)) {
  const exp = EXPECT[id];
  vm.runInContext(`applyProject(${JSON.stringify(id)})`, ctx);
  const { PARTS, STAGE, MISSIONS } = vm.runInContext('({ PARTS, STAGE, MISSIONS })', ctx);
  const P = pid => PARTS.find(p => p.id === pid);
  out.push(`\n\u001b[1m══ ${id.toUpperCase()} — ${exp.zones} ══\u001b[0m`);

  /* -------------------------------------------------- 1. sem sobreposição */
  out.push('\n\u001b[1m1. Peças na placa\u001b[0m');
  const cols = [];
  for (let i = 0; i < PARTS.length; i++) {
    for (let j = i + 1; j < PARTS.length; j++) {
      const a = PARTS[i], b = PARTS[j];
      if (par(a.id, b.id) || a.kind === 'bus' || b.kind === 'bus') continue;
      if (overlap(box(a), box(b))) cols.push(`${a.id}×${b.id}`);
    }
  }
  check('nenhuma peça invade o espaço de outra', cols.length === 0, cols.join(', '));

  const invasores = [];
  PARTS.forEach(p => p.terms.forEach(t => {
    PARTS.forEach(q => {
      if (q === p || par(p.id, q.id) || q.kind === 'bus') return;
      if (within(box(q), t.x, t.y, -6)) invasores.push(`${p.id}:${t.id} sobre ${q.id}`);
    });
  }));
  check('nenhum borne cai em cima de outra peça', invasores.length === 0, invasores.join(', '));

  /* dois bornes no mesmo ponto seriam impossíveis de clicar sem ambiguidade */
  const seen = {};
  const dup = [];
  PARTS.forEach(p => p.terms.forEach(t => {
    const k = `${t.x},${t.y}`;
    if (seen[k] && seen[k] !== p.id + ':' + t.id) dup.push(`${seen[k]} = ${p.id}:${t.id}`);
    seen[k] = p.id + ':' + t.id;
  }));
  check('nenhum borne compartilha a coordenada de outro', dup.length === 0, dup.join(', '));

  const fora = PARTS.flatMap(p => [p, ...p.terms.map(t => ({ id: p.id + ':' + t.id, x: t.x, y: t.y, w: 0, h: 0 }))])
    .filter(p => p.x < 0 || p.y < 0 || p.x + p.w > STAGE.w || p.y + p.h > STAGE.h).map(p => p.id);
  check(`tudo dentro do palco ${STAGE.w}×${STAGE.h}`, fora.length === 0, fora.join(', '));

  /* ------------------------------------------- 2. cadeia de potência (esq.) */
  out.push('\n\u001b[1m2. Cadeia de potência à esquerda\u001b[0m');
  const cmdX = Math.min(...exp.cmd.map(pid => P(pid).x));
  check(`${exp.power[0]}…${exp.power[exp.power.length - 1]} ficam à esquerda do comando`,
    exp.power.every(pid => P(pid).x + P(pid).w <= cmdX + 1),
    exp.power.filter(pid => P(pid).x + P(pid).w > cmdX + 1).map(pid => pid + '→' + (P(pid).x + P(pid).w)).join(', '));
  check('a coluna desce na ordem do esquema',
    exp.power.every((pid, i) => i === 0 || P(pid).y >= P(exp.power[i - 1]).y),
    exp.power.map(pid => `${pid}@${P(pid).y}`).join(' '));
  check('a coluna de potência fica na metade esquerda do palco',
    exp.power.every(pid => P(pid).x + P(pid).w <= STAGE.w * .62),
    exp.power.map(pid => pid + '→' + (P(pid).x + P(pid).w)).join(' '));

  /* --------------------------------------------- 3. comando e sinalização */
  out.push('\n\u001b[1m3. Comando e sinalização à direita\u001b[0m');
  check('Q2 abre a coluna de comando (peça mais ao alto do conjunto)',
    exp.cmd.every(pid => P(pid).y >= P('Q2').y - 1));
  if (exp.botoes === 'coluna') {
    check('S0 (parada) acima e os botões de partida abaixo dele',
      P('S0').y < P('S1').y && P('S0').y < P('S2').y);
  } else {
    check('posto de comando numa fileira: S0 · S1 · S2 lado a lado, parada à esquerda',
      P('S0').y === P('S1').y && P('S1').y === P('S2').y &&
      P('S0').x < P('S1').x && P('S1').x < P('S2').x);
  }
  check(`${exp.start} (partida) à esquerda do S2 (sentido), na mesma altura`,
    P(exp.start).y === P('S2').y && cx(P(exp.start)) < cx(P('S2')));
  check('as lâmpadas ficam em faixa própria, sem encostar nos botões',
    exp.lamps.every(l => exp.cmd.filter(pid => ['S0', 'S1', 'S2'].includes(pid))
      .every(s => !overlap(box(P(l)), box(P(s))))));
  const lampsX = exp.lamps.map(l => `${l}@${P(l).x}`).join(' ');
  check('as lâmpadas seguem a ordem do esquema, da esquerda para a direita',
    exp.lamps.every((l, i) => i === 0 || P(l).x > P(exp.lamps[i - 1]).x), lampsX);

  /* --------------------------------------------- 4. barra de retorno (Q2:2) */
  out.push('\n\u001b[1m4. Barra de retorno do comando\u001b[0m');
  const bus = P('RET'), q2 = P('Q2'), q2_2 = q2.terms.find(t => t.id === '2');
  const acima = PARTS.filter(p => p.kind !== 'bus' && p.x < bus.x + bus.w && p.x + p.w > bus.x)
    .filter(p => p.y + p.h > bus.y).map(p => p.id);
  check('a barra fica abaixo de tudo o que passa por cima dela', acima.length === 0, acima.join(', '));
  check('a barra começa sob o comando (não invade a coluna de potência)',
    bus.x >= cmdX - 60, `barra x=${bus.x} comando x=${cmdX}`);
  check('a barra cobre os bornes de retorno do comando',
    exp.cmd.filter(pid => P(pid).terms.some(t => t.id === 'A2' || t.id === 'X2')).every(pid => {
      const ret = P(pid).terms.find(t => t.id === 'A2' || t.id === 'X2');
      return ret.x >= bus.x && ret.x <= bus.x + bus.w;
    }));
  const noCaminho = PARTS.filter(p => p.kind !== 'bus' && p.id !== 'Q2' &&
    box(p).x1 < q2_2.x && q2_2.x < box(p).x2 && p.y > q2_2.y && p.y < bus.y).map(p => p.id);
  check('o terminal 2 do Q2 desce reto até a barra (corredor livre)',
    noCaminho.length === 0, noCaminho.join(', '));
  const retornos = PARTS.filter(p => p.terms.some(t => t.id === 'A2' || t.id === 'X2')).length + 1;
  check(`a barra tem bornes para todos os retornos (${retornos})`,
    bus.terms.length >= retornos, String(bus.terms.length));

  /* ------------------------------- 5. bornes com saída livre (fica bonito) */
  out.push('\n\u001b[1m5. Cabos saindo do componente em linha reta\u001b[0m');
  /* Réplica do stubOut() do app: o cabo sai do borne na direção dele e estica
     até achar área livre. Se o borne afunda na própria peça, o cabo acaba
     atravessando o desenho do componente — exatamente o que deixa a fiação
     feia. Aqui exigimos que o stub resolva em até 30 px. */
  const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const dentro = q => PARTS.some(p => p.kind !== 'bus' && p.kind !== 'aux' &&
    q.x > p.x - 4 && q.x < p.x + p.w + 4 && q.y > p.y - 4 && q.y < p.y + p.h + 4);
  const fundos = [];
  PARTS.forEach(p => {
    if (!p.terms.length) return;
    p.terms.forEach(t => {
      const d = VEC[t.dir] || [0, 1];
      let k = 26;
      let q = { x: t.x + d[0] * k, y: t.y + d[1] * k };
      while (k < 460 && dentro(q)) { k += 20; q = { x: t.x + d[0] * k, y: t.y + d[1] * k }; }
      if (k > 30) fundos.push(`${p.id}:${t.id} (${k} px)`);
    });
  });
  check('todo borne tem área livre na direção em que o cabo sai', fundos.length === 0, fundos.join(', '));

  /* ------------------------------------- 6. toda ligação é possível de desenhar */
  out.push('\n\u001b[1m6. Ligações desenháveis\u001b[0m');
  const termsDe = pid => (P(pid) ? P(pid).terms.map(t => pid + ':' + t.id) : []);
  const semBorne = MISSIONS.filter(m => !termsDe(m.a.split(':')[0]).length || !termsDe(m.b.split(':')[0]).length)
    .map(m => m.a + '→' + m.b);
  check('todas as peças citadas nas ligações existem na placa', semBorne.length === 0, semBorne.join(', '));
  const semMarca = MISSIONS.filter(m => ![m.a, m.b].every(k => k.endsWith(':*') || termsDe(k.split(':')[0]).includes(k)))
    .map(m => m.a + '→' + m.b);
  check('todo borne citado existe na peça', semMarca.length === 0, semMarca.join(', '));
}

console.log(out.join('\n'));
console.log(`\n${pass} verificações OK, ${fail} falha(s).`);
process.exit(fail ? 1 : 0);
