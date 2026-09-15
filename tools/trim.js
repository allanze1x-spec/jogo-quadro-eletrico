/* tools/trim.js — recorta a imagem pela caixa detectada (tools/boxes.json) e
   remove o fundo claro, gravando PNG com transparência.
   uso: FFMPEG=... node tools/trim.js [alpha_lo alpha_hi]                        */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FF = process.env.FFMPEG || 'ffmpeg';
const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'orig');
const dst = path.join(root, 'assets');
const boxes = JSON.parse(fs.readFileSync(path.join(__dirname, 'boxes.json'), 'utf8'));

const LO = Number(process.argv[2] || 46);   // abaixo disto -> totalmente transparente
const HI = Number(process.argv[3] || 78);   // acima disto -> totalmente opaco
const OUT = 620;

const files = fs.readdirSync(src).filter(f => f.endsWith('.png')).sort();
const info = [];
files.forEach(f => {
  const b = boxes[f];
  if (!b) { console.log('sem caixa:', f); return; }
  const S = 2048;
  const pad = 6;
  let x = Math.max(0, Math.round(b.x * S) - pad);
  let y = Math.max(0, Math.round(b.y * S) - pad);
  let w = Math.min(S - x, Math.round(b.w * S) + pad * 2);
  let h = Math.min(S - y, Math.round(b.h * S) + pad * 2);
  const a = `clip((255-min(min(r(X,Y),g(X,Y)),b(X,Y))-${LO})*255/${HI - LO},0,255)`;
  const vf = `crop=${w}:${h}:${x}:${y},scale=${OUT}:-1:flags=lanczos,format=rgba,` +
    `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${a}'`;
  execFileSync(FF, ['-y', '-v', 'error', '-i', path.join(src, f), '-vf', vf,
    '-map_metadata', '-1', '-pred', 'mixed', path.join(dst, f)]);
  info.push({ f, w, h, ratio: +(h / w).toFixed(4) });
});

info.forEach(i => console.log(`${i.f.padEnd(22)} ratio h/w = ${i.ratio}`));

/* folha de contato final (fundo xadrez para ver a transparência) */
const ids = files.map(f => f.replace('.png', ''));
const html = `<!doctype html><meta charset="utf-8"><title>final</title>
<style>body{margin:0;background:#9aa3ad;font-family:monospace}
.grid{display:grid;grid-template-columns:1fr 1fr}
.cell{width:233px;height:233px;position:relative;display:grid;place-items:center;border:1px solid #667;
 background:conic-gradient(#c9ced4 0 25%,#e6e9ec 0 50%,#c9ced4 0 75%,#e6e9ec 0) 0 0/22px 22px}
.cell img{max-width:96%;max-height:96%}
.cell b{position:absolute;left:3px;top:1px;color:#000;font-size:12px;background:#fff9;padding:0 3px;z-index:3}
</style><div class="grid" id="g"></div>
<script>
const IDS=${JSON.stringify(ids)};
const start=+(new URLSearchParams(location.search).get('i')||0);
const g=document.getElementById('g');
IDS.slice(start,start+4).forEach(id=>{
  const c=document.createElement('div');c.className='cell';
  c.innerHTML='<b>'+id+'</b><img src="../assets/'+id+'.png">';
  g.appendChild(c);
});
</script>`;
fs.writeFileSync(path.join(__dirname, 'final.html'), html);
