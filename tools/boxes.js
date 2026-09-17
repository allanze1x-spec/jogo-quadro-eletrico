/* ============================================================================
   tools/boxes.js — compara a CAIXA de cada peça com a nuvem de bornes dela.

       node tools/boxes.js

   Num esquema, o desenho do componente fica entre os bornes: os de entrada em
   cima (encostados na borda) e os de saída embaixo. Quando a caixa é muito
   maior do que os bornes, o cabo que sai do componente tem de atravessar o
   próprio desenho para escapar — é isso que deixa a fiação feia. Este script
   mostra a folga (ou o excesso) de cada lado, para calibrar o data.js.
   ========================================================================== */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'), ctx, { filename: 'data.js' });
const PROJECTS = vm.runInContext('PROJECTS', ctx);

const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

for (const id of Object.keys(PROJECTS)) {
  vm.runInContext(`applyProject(${JSON.stringify(id)})`, ctx);
  const PARTS = vm.runInContext('PARTS', ctx);
  console.log(`\n━━ ${id.toUpperCase()} — caixa × bornes ━━`);
  console.log('peça   caixa                          bornes             folga (esq/top/dir/base)  fundura do borne');
  PARTS.forEach(p => {
    if (p.kind === 'bus' || !p.terms.length) return;
    const xs = p.terms.map(t => t.x), ys = p.terms.map(t => t.y);
    const t = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
    const gap = [t.x1 - p.x, t.y1 - p.y, (p.x + p.w) - t.x2, (p.y + p.h) - t.y2];
    /* fundura: quanto o borne está dentro da caixa na direção em que o cabo sai */
    const fundo = p.terms.map(term => {
      const q = { x: term.x + VEC[term.dir][0] * 20, y: term.y + VEC[term.dir][1] * 20 };
      const dentro = q.x > p.x && q.x < p.x + p.w && q.y > p.y && q.y < p.y + p.h;
      return dentro ? 20 : 0;
    }).reduce((a, b) => Math.max(a, b), 0);
    console.log(
      `${p.id.padEnd(6)} ${String(p.x + ',' + p.y).padEnd(9)} ${String(p.w + '×' + p.h).padEnd(11)}` +
      ` ${String(t.x1 + ',' + t.y1).padEnd(9)} ${String(t.x2 + ',' + t.y2).padEnd(9)}` +
      ` ${gap.map(g => String(Math.round(g)).padStart(5)).join(' ')}   ${fundo ? 'ATRAVESSA' : 'ok'}`);
  });
}
