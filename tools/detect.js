/* tools/detect.js — detecta a caixa do objeto (para recortar) e monta uma folha
   de contato com a caixa desenhada por cima, para conferência visual.
   uso: FFMPEG=... node tools/detect.js                                        */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FF = process.env.FFMPEG || 'ffmpeg';
const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'orig');
const N = 256;

function darkness(file) {
  const raw = execFileSync(FF, ['-v', 'error', '-i', file, '-vf', `scale=${N}:${N}`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  const d = new Float32Array(N * N);
  for (let i = 0, p = 0; i < d.length; i++, p += 3) {
    d[i] = 255 - Math.min(raw[p], raw[p + 1], raw[p + 2]);
  }
  return d;
}

function detect(file) {
  const d = darkness(file);
  // fundo = mediana da moldura externa
  const border = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (x < N * .12 || x > N * .88 || y < N * .12 || y > N * .88) border.push(d[y * N + x]);
  }
  border.sort((a, b) => a - b);
  const bg = border[Math.floor(border.length / 2)];
  const T = bg + 42;

  const rowN = new Float32Array(N), colN = new Float32Array(N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (d[y * N + x] > T) { rowN[y]++; colN[x]++; }
  }
  const minRow = N * .015, minCol = N * .015;
  let y0 = 0, y1 = N - 1, x0 = 0, x1 = N - 1;
  while (y0 < N && rowN[y0] < minRow) y0++;
  while (y1 > 0 && rowN[y1] < minRow) y1--;
  while (x0 < N && colN[x0] < minCol) x0++;
  while (x1 > 0 && colN[x1] < minCol) x1--;
  if (y0 >= y1 || x0 >= x1) return null;
  return { x: x0 / N, y: y0 / N, w: (x1 - x0 + 1) / N, h: (y1 - y0 + 1) / N, bg: Math.round(bg) };
}

const files = fs.readdirSync(src).filter(f => f.endsWith('.png')).sort();
const out = {};
files.forEach(f => { out[f] = detect(path.join(src, f)); });
fs.writeFileSync(path.join(__dirname, 'boxes.json'), JSON.stringify(out, null, 1));
Object.entries(out).forEach(([f, b]) => console.log(
  f.padEnd(22), b ? `bg ${String(b.bg).padStart(3)}  x ${b.x.toFixed(3)} y ${b.y.toFixed(3)} w ${b.w.toFixed(3)} h ${b.h.toFixed(3)}` : 'nada'));

/* folha de contato: 4 imagens por tela (2x2), com a caixa desenhada */
const ids = files.map(f => f.replace('.png', ''));
const html = `<!doctype html><meta charset="utf-8"><title>contato</title>
<style>body{margin:0;background:#111;font-family:monospace}
.grid{display:grid;grid-template-columns:1fr 1fr}
.cell{position:relative;width:233px;height:264px;overflow:hidden;border:1px solid #333}
.cell img{width:100%;height:auto;display:block}
.cell canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.cell b{position:absolute;left:4px;top:2px;color:#0f0;font-size:13px;background:#000a;padding:1px 4px;z-index:3}
</style>
<div class="grid" id="g"></div>
<script>
const B=${JSON.stringify(out)};
const IDS=${JSON.stringify(ids)};
const start=+(new URLSearchParams(location.search).get('i')||0);
const g=document.getElementById('g');
IDS.slice(start,start+4).forEach(id=>{
  const b=B[id+'.png'];
  const c=document.createElement('div');c.className='cell';
  c.innerHTML='<b>'+id+'</b><img src="../assets/orig/'+id+'.png">';
  const cv=document.createElement('canvas');cv.width=233;cv.height=233;
  if(b){const x=cv.getContext('2d');x.strokeStyle='#ff2d2d';x.lineWidth=2;
    x.strokeRect(b.x*233,b.y*233,b.w*233,b.h*233);}
  c.appendChild(cv);g.appendChild(c);
});
</script>`;
fs.writeFileSync(path.join(__dirname, 'sheet.html'), html);
console.log('\nfolha: tools/sheet.html?i=0,4,8,12');
