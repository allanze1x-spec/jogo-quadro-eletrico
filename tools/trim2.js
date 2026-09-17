/* tools/trim2.js — recorta os assets NOVOS (inversor/potenciômetro) usando a
   caixa normalizada de tools/boxes.json (gerada por tools/detect.js) e grava o
   PNG com transparência, do mesmo jeito que tools/trim.js faz com os antigos.

       FFMPEG=... node tools/detect.js
       FFMPEG=... node tools/trim2.js inversor potenciometro

   A diferença para o trim.js é que aqui a caixa é convertida usando o tamanho
   REAL do arquivo (as imagens novas não são quadradas, então não vale assumir
   2048 nas duas dimensões).
   ------------------------------------------------------------------------- */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FF = process.env.FFMPEG || 'ffmpeg';
const root = path.join(__dirname, '..');
const boxes = JSON.parse(fs.readFileSync(path.join(__dirname, 'boxes.json'), 'utf8'));

const LO = Number(process.env.LO || 46);   // abaixo disto: opaco
const HI = Number(process.env.HI || 78);   // acima disto: transparente
const OUT = Number(process.env.OUT || 620);
const pad = 8;

const nomes = process.argv.slice(2);
if (!nomes.length) { console.error('uso: node tools/trim2.js <nome> [...]'); process.exit(1); }

nomes.forEach(nome => {
  const src = path.join(root, 'assets', 'orig', nome + '.png');
  const b = boxes[nome + '.png'];
  if (!fs.existsSync(src)) { console.log('sem arquivo:', src); return; }
  if (!b) { console.log('sem caixa em boxes.json:', nome); return; }
  const hdr = fs.readFileSync(src);
  const W = hdr.readUInt32BE(16), H = hdr.readUInt32BE(20);
  const x = Math.max(0, Math.round(b.x * W) - pad);
  const y = Math.max(0, Math.round(b.y * H) - pad);
  const w = Math.min(W - x, Math.round(b.w * W) + pad * 2);
  const h = Math.min(H - y, Math.round(b.h * H) + pad * 2);
  const a = `clip((255-min(min(r(X,Y),g(X,Y)),b(X,Y))-${LO})*255/${HI - LO},0,255)`;
  const vf = `crop=${w}:${h}:${x}:${y},scale=${OUT}:-1:flags=lanczos,format=rgba,` +
    `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${a}'`;
  execFileSync(FF, ['-y', '-v', 'error', '-i', src, '-vf', vf, '-map_metadata', '-1',
    path.join(root, 'assets', nome + '.png')]);
  const out = fs.readFileSync(path.join(root, 'assets', nome + '.png'));
  const ow = out.readUInt32BE(16), oh = out.readUInt32BE(20);
  console.log(`${nome}.png`.padEnd(20), `origem ${W}x${H} caixa ${w}x${h}+${x}+${y}`,
    `→ ${ow}x${oh}  h/w=${(oh / ow).toFixed(3)}`);
});
