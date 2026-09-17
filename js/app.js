/* ============================================================================
   app.js — interface, montagem, interação e animações
   ========================================================================== */

/* ---------------------------------- utils --------------------------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const boardEl = $('#board');
const stageEl = $('#stage');
const wiresEl = $('#wires');

/* índice dos bornes do projeto ativo (recalculado a cada troca de missão) */
const TERM_POS = {}, TERM_DIR = {}, PART_OF_TERM = {};
function rebuildTermIndex() {
  [TERM_POS, TERM_DIR, PART_OF_TERM].forEach(o => Object.keys(o).forEach(k => delete o[k]));
  PARTS.forEach(p => p.terms.forEach(t => {
    const k = p.id + ':' + t.id;
    TERM_POS[k] = { x: t.x, y: t.y };
    TERM_DIR[k] = t.dir;
    PART_OF_TERM[k] = p.id;
  }));
}
rebuildTermIndex();

/* ---------------------------------- estado -------------------------------- */
const S = {
  etapa: 1,
  placed: {},
  wires: [],
  q1: false, q2: false,
  pressed: { S0: false, S1: false, S2: false },
  f1Tripped: false,
  load: 'nominal',
  sel: null,
  score: 0,
  errors: 0,
  free: false,
  auto: false,
  done: new Set(),
  testDone: new Set(),
  _stage3: false,
  mode: 'esquema',      // 'esquema' | 'manutencao'
  defect: null,
  projId: 'reversao',   // missão ativa (trocada por startProject)
  driveFault: false,    // falha rearmável do inversor (F051 na bancada)
  ref: 0.5,             // posição do potenciômetro RP1 (0..1)
  _fixed: false,
  _repairs: 0,
  started: Date.now(),
  elapsed: 0,
  overload: 0,
  seq: 0,
  shortFired: false,
  res: null,
};

/* ---------------------------------- som ----------------------------------- */
const SFX = (() => {
  let ctx = null, hum = null, master = null;
  const ac = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    }
    return ctx;
  };
  const noise = dur => {
    const c = ac(), b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  };
  return {
    click() {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = 1400;
      g.gain.setValueAtTime(.06, c.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .05);
      o.connect(g).connect(master); o.start(); o.stop(c.currentTime + .06);
    },
    clack() {
      const c = ac(), n = noise(.09), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
      g.gain.setValueAtTime(.35, c.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .09);
      n.connect(f).connect(g).connect(master); n.start();
    },
    err() {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(220, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(90, c.currentTime + .18);
      g.gain.setValueAtTime(.08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .2);
      o.connect(g).connect(master); o.start(); o.stop(c.currentTime + .22);
    },
    /** bip contínuo do multímetro (continuidade) */
    beep() {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = 1000;
      g.gain.setValueAtTime(.05, c.currentTime);
      g.gain.setValueAtTime(.05, c.currentTime + .13);
      g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .2);
      o.connect(g).connect(master); o.start(); o.stop(c.currentTime + .22);
    },
    ok() {
      const c = ac();
      [520, 780].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const t = c.currentTime + i * .07;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .02);
        g.gain.exponentialRampToValueAtTime(.001, t + .18);
        o.connect(g).connect(master); o.start(t); o.stop(t + .2);
      });
    },
    boom() {
      const c = ac(), n = noise(.6), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.setValueAtTime(2600, c.currentTime);
      f.frequency.exponentialRampToValueAtTime(120, c.currentTime + .6);
      g.gain.setValueAtTime(.55, c.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .7);
      n.connect(f).connect(g).connect(master); n.start();
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(35, c.currentTime + .5);
      og.gain.setValueAtTime(.35, c.currentTime);
      og.gain.exponentialRampToValueAtTime(.001, c.currentTime + .55);
      o.connect(og).connect(master); o.start(); o.stop(c.currentTime + .6);
    },
    humOn() {
      if (hum) return;
      const c = ac(), g = c.createGain(), f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420;
      g.gain.value = 0;
      const o1 = c.createOscillator(), o2 = c.createOscillator();
      o1.type = 'sawtooth'; o1.frequency.value = 50;
      o2.type = 'triangle'; o2.frequency.value = 100;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
      o1.start(); o2.start();
      g.gain.linearRampToValueAtTime(.05, c.currentTime + .35);
      hum = { o1, o2, g };
    },
    humOff() {
      if (!hum) return;
      const c = ac(), h = hum; hum = null;
      h.g.gain.linearRampToValueAtTime(0, c.currentTime + .25);
      setTimeout(() => { try { h.o1.stop(); h.o2.stop(); } catch (e) { } }, 350);
    },
  };
})();

/* ------------------------------- construção -------------------------------- */
function buildPaint() {
  /* trilhos e faixas vêm do projeto (data.js) — cada quadro tem o seu desenho */
  const rails = PAINT.rails, zones = PAINT.zones;
  $('#paint').innerHTML =
    zones.map(z => `<div class="zone" style="left:${z.x}px;top:${z.y}px;width:${z.w}px;height:${z.h}px">
        <span>${z.t}</span></div>`).join('') +
    rails.map(r => {
      let holes = '';
      for (let x = 14; x < r.w - 6; x += 34) holes += `<i class="hole" style="left:${x}px"></i>`;
      return `<div class="rail" style="left:${r.x}px;top:${r.y}px;width:${r.w}px">${holes}</div>`;
    }).join('');
}

function buildGhosts() {
  $('#ghosts').innerHTML = PARTS.map(p =>
    `<div class="ghost" data-ghost="${p.id}" style="left:${p.x - 6}px;top:${p.y - 6}px;width:${p.w + 12}px;height:${p.h + 12}px">
       <span>${p.id}</span></div>`).join('');
}

function partHTML(p) {
  let inner = '';
  if (p.img) inner += `<img src="${p.img}" alt="${p.name}">`;
  else if (p.kind === 'aux') {
    inner += `<div class="screw" style="left:6px;top:6px"></div><div class="screw" style="right:6px;top:6px"></div>
              <div class="screw" style="left:6px;bottom:6px"></div><div class="screw" style="right:6px;bottom:6px"></div>`;
  }
  return `<div class="part ${p.kind || ''} ${p.lamp ? 'lamp' : ''}" data-part="${p.id}"
      style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
      ${p.kind ? '<div class="plate"></div>' : ''}
      ${inner}
      <span class="tag">${p.id}${p.sub ? `<em>${p.sub}</em>` : ''}</span>
    </div>`;
}

function buildTray() {
  $('#tray-items').innerHTML = PARTS.filter(p => !S.placed[p.id]).map(p =>
    `<div class="tray-item" data-tray="${p.id}" title="${p.name}">
       ${p.img ? `<img src="${p.img}" alt="">` : '<div class="ph"></div>'}
       <span class="cap">${p.id}${p.sub ? `<em>${p.sub}</em>` : ''}</span>
     </div>`).join('');
}

function placePart(id, animate) {
  if (S.placed[id]) return;
  S.placed[id] = true;
  const p = PART_BY_ID[id];
  $('#parts').insertAdjacentHTML('beforeend', partHTML(p));
  const el = $(`[data-part="${id}"]`);
  if (animate) { el.classList.add('snapping'); setTimeout(() => el.classList.remove('snapping'), 320); }
  $(`[data-ghost="${id}"]`)?.classList.add('done');
  buildTerms();
  SFX.clack();
  $('#tray-count').textContent = `${Object.keys(S.placed).length} / ${PARTS.length}`;
  renderPane();
  if (Object.keys(S.placed).length === PARTS.length) finishEtapa1();
}

function buildTerms() {
  $('#terms').innerHTML = PARTS.filter(p => S.placed[p.id]).map(p =>
    p.terms.map(t => {
      const k = p.id + ':' + t.id;
      return `<div class="term ${t.dir}" data-term="${k}" style="left:${t.x}px;top:${t.y}px">
                <span class="lbl">${t.label}</span></div>`;
    }).join('')
  ).join('');
  $('#terms').querySelectorAll('.term').forEach(el => {
    el.addEventListener('click', () => clickTerm(el.dataset.term));
  });
  paintTargets();
}

/* -------------------------------- roteamento ------------------------------ */
function roundedPath(pts, r) {
  const clean = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = clean[clean.length - 1], b = pts[i];
    if (Math.abs(a.x - b.x) > .5 || Math.abs(a.y - b.y) > .5) clean.push(b);
  }
  let d = `M ${clean[0].x} ${clean[0].y}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const p = clean[i], a = clean[i - 1], b = clean[i + 1];
    const d1 = Math.hypot(p.x - a.x, p.y - a.y), d2 = Math.hypot(b.x - p.x, b.y - p.y);
    if (d1 < 1 || d2 < 1) continue;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const s = { x: p.x - (p.x - a.x) / d1 * rr, y: p.y - (p.y - a.y) / d1 * rr };
    const e = { x: p.x + (b.x - p.x) / d2 * rr, y: p.y + (b.y - p.y) / d2 * rr };
    d += ` L ${s.x} ${s.y} Q ${p.x} ${p.y} ${e.x} ${e.y}`;
  }
  const l = clean[clean.length - 1];
  d += ` L ${l.x} ${l.y}`;
  return d;
}

/* ============================================================================
   ROTEAMENTO DOS CABOS — desenho ortogonal, como num painel de verdade

   1. cada cabo sai do borne seguindo a DIREÇÃO do borne (o "stub"), esticado
      até ficar FORA da peça (e do bloco auxiliar colado nela);
   2. daí até o stub do outro borne o caminho é achado por A* numa grade de
      20 px que bloqueia as caixas das peças — o mapa é montado uma vez por
      projeto e nunca é alterado, então o cabo não atravessa componente;
   3. corredores já usados custam um pouco mais caro (com teto), o que separa
      os fios paralelos sem virar desvio longo;
   4. sem caminho (ou sem mapa) cai no traçado ortogonal simples.
   ========================================================================== */
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
/* direções na grade: 0 cima · 1 direita · 2 baixo · 3 esquerda */
const DIR_ID = { up: 0, right: 1, down: 2, left: 3 };
const DIR_VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const GRID = 20;

let RMAP = null, RCACHE = {}, RUSE = null;

/** mapa de obstáculos: caixas das peças (infladas) + borda do palco */
function buildRouteMap() {
  const cols = Math.ceil(STAGE.w / GRID) + 1, rows = Math.ceil(STAGE.h / GRID) + 1;
  const blocked = new Uint8Array(cols * rows);
  const pad = 4;
  PARTS.forEach(p => {
    if (p.kind === 'bus') return;              // a barra de retorno é um trilho: pode passar por baixo
    const ax = Math.floor((p.x - pad) / GRID), ay = Math.floor((p.y - pad) / GRID);
    const bx = Math.ceil((p.x + p.w + pad) / GRID), by = Math.ceil((p.y + p.h + pad) / GRID);
    for (let y = Math.max(0, ay); y <= Math.min(rows - 1, by); y++)
      for (let x = Math.max(0, ax); x <= Math.min(cols - 1, bx); x++) blocked[y * cols + x] = 1;
  });
  for (let x = 0; x < cols; x++) { blocked[x] = 1; blocked[(rows - 1) * cols + x] = 1; }
  for (let y = 0; y < rows; y++) { blocked[y * cols] = 1; blocked[y * cols + cols - 1] = 1; }
  RMAP = { cols, rows, blocked };
  RCACHE = {};
}

/** o ponto está dentro de alguma peça (ou do bloco auxiliar dela)? */
function dentroDePeca(q) {
  return PARTS.some(p => p.kind !== 'bus' &&
    q.x > p.x - 4 && q.x < p.x + p.w + 4 && q.y > p.y - 4 && q.y < p.y + p.h + 4);
}

/**
 * Stub de um borne: sai na direção declarada do borne e estica até estar em
 * área livre. É o que permite o cabo nascer de dentro da peça (como os bornes
 * desenhados sobre o componente) sem abrir caminho por cima dela.
 */
function stubOut(termKey, min) {
  const A = TERM_POS[termKey];
  const d = VEC[TERM_DIR[termKey] || 'down'];
  let k = min;
  let q = { x: A.x + d[0] * k, y: A.y + d[1] * k };
  while (k < 460 && dentroDePeca(q)) { k += GRID; q = { x: A.x + d[0] * k, y: A.y + d[1] * k }; }
  return q;
}

/** A* com penalidade de curva e de corredor já ocupado */
function aStar(from, to, dir0) {
  const { cols, rows, blocked } = RMAP;
  const cl = (v, n) => Math.max(1, Math.min(n - 2, v));
  const sx = cl(Math.round(from.x / GRID), cols), sy = cl(Math.round(from.y / GRID), rows);
  const gx = cl(Math.round(to.x / GRID), cols), gy = cl(Math.round(to.y / GRID), rows);
  if (blocked[sy * cols + sx] || blocked[gy * cols + gx]) return null;

  const N = cols * rows * 4;
  const g = new Float32Array(N).fill(1e9);
  const back = new Int32Array(N).fill(-1);
  const seen = new Uint8Array(N);
  const id = (x, y, d) => (y * cols + x) * 4 + d;
  const h = (x, y) => (Math.abs(x - gx) + Math.abs(y - gy)) * GRID;

  const heap = [];
  const push = (node, f) => {
    heap.push([f, node]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
      }
    }
    return top[1];
  };

  const start = id(sx, sy, dir0);
  g[start] = 0; push(start, h(sx, sy));
  let goal = -1;
  while (heap.length) {
    const node = pop();
    if (seen[node]) continue;
    seen[node] = 1;
    const d = node & 3, cell = node >> 2, x = cell % cols, y = (cell - x) / cols;
    if (x === gx && y === gy) { goal = node; break; }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue;              // não volta por onde veio
      const nx = x + DIR_VEC[nd][0], ny = y + DIR_VEC[nd][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (blocked[ny * cols + nx]) continue;
      /* corredor já usado: no máximo 9 px por célula — separa os fios
         paralelos sem empurrar o cabo para um desvio longo */
      const custo = GRID + (nd === d ? 0 : 24) +
        (RUSE ? Math.min(RUSE[ny * cols + nx], 3) * 3 : 0);
      const nn = id(nx, ny, nd);
      if (g[node] + custo < g[nn]) { g[nn] = g[node] + custo; back[nn] = node; push(nn, g[nn] + h(nx, ny)); }
    }
  }
  if (goal < 0) return null;
  const cells = [];
  for (let n = goal; n >= 0; n = back[n]) {
    const c = n >> 2, x = c % cols;
    cells.push([x, (c - x) / cols]);
  }
  cells.reverse();
  return cells;
}

/** traçado ortogonal simples (usado quando o A* não acha caminho) */
function simplePath(A, p1, q1, B, off, da, db) {
  if (da[0] !== 0 && db[0] !== 0) {
    const mx = (p1.x + q1.x) / 2 + (off || 0);
    return [A, p1, { x: mx, y: p1.y }, { x: mx, y: q1.y }, q1, B];
  }
  if (da[0] !== 0 || db[0] !== 0) return [A, p1, { x: q1.x, y: p1.y }, q1, B];
  const my = (p1.y + q1.y) / 2 + (off || 0);
  return [A, p1, { x: p1.x, y: my }, { x: q1.x, y: my }, q1, B];
}

/** tira pontos repetidos e colineares (deixa só as dobras) */
function simplifyPath(pts) {
  const clean = [];
  pts.forEach(p => {
    const l = clean[clean.length - 1];
    if (!l || Math.abs(l.x - p.x) > .5 || Math.abs(l.y - p.y) > .5) clean.push(p);
  });
  if (clean.length < 3) return clean;
  const out = [clean[0]];
  for (let i = 1; i < clean.length - 1; i++) {
    const a = out[out.length - 1], b = clean[i], c = clean[i + 1];
    const reto = (Math.abs(a.x - b.x) < .5 && Math.abs(b.x - c.x) < .5) ||
      (Math.abs(a.y - b.y) < .5 && Math.abs(b.y - c.y) < .5);
    if (!reto) out.push(b);
  }
  out.push(clean[clean.length - 1]);
  return out;
}

function wirePath(a, b, off) {
  const A = TERM_POS[a], B = TERM_POS[b];
  const key = a + '|' + b;
  if (!A || !B) return '';
  if (RCACHE[key]) return RCACHE[key];
  const da = VEC[TERM_DIR[a] || 'down'], db = VEC[TERM_DIR[b] || 'down'];
  const p1 = stubOut(a, 26);
  const q1 = stubOut(b, 26);
  let pts = null;
  if (RMAP) {
    const cells = (typeof aStar === 'function') ? aStar(p1, q1, DIR_ID[TERM_DIR[a] || 'down']) : null;
    if (cells && cells.length > 1) {
      const wp = cells.slice(1, -1).map(([cx, cy]) => ({ x: cx * GRID, y: cy * GRID }));
      pts = [A, p1].concat(wp, [q1, B]);
      if (RUSE) cells.forEach(([cx, cy]) => { RUSE[cy * RMAP.cols + cx] += 1; });
    }
  }
  if (!pts) pts = simplePath(A, p1, q1, B, off, da, db);
  const d = roundedPath(simplifyPath(pts), 12);
  RCACHE[key] = d;
  return d;
}

function renderWires() {
  const res = S.res;
  const out = [];
  const count = {};
  const bump = k => { count[k] = (count[k] || 0) + 1; };
  // barra de retorno: todos os bornes são o MESMO ponto elétrico → desenha o trilho
  const bus = PART_BY_ID.RET;
  if (S.placed.RET) out.push(`<polyline class="busbar" points="${bus.terms.map(t => t.x + ',' + t.y).join(' ')}"/>`);
  RUSE = new Float32Array(RMAP ? RMAP.cols * RMAP.rows : 1);
  S.wires.forEach((w, i) => {
    const off = ((i % 5) - 2) * 7;
    const col = res ? wireColor(res.net, w.a) : '#4b5563';
    const bad = !w.ok && w.mission === null;
    out.push(`<path class="wire ${bad ? 'bad' : ''}" data-wid="${i}" d="${wirePath(w.a, w.b, off)}"
        stroke="${col}" stroke-width="${bad ? 4 : 5.5}"/>`);
    bump(w.a); bump(w.b);
  });
  // ponto de junção cheio onde chegam 2 ou mais cabos — como no esquema
  Object.keys(count).forEach(k => {
    const p = TERM_POS[k];
    if (!p || count[k] < 2) return;
    out.push(`<circle class="junc" cx="${p.x}" cy="${p.y}" r="5.5"
        fill="${res ? wireColor(res.net, k) : '#4b5563'}"/>`);
  });
  if (S.sel && S.hover) {
    out.push(`<path class="wire ghostwire" d="${wirePath(S.sel, S.hover, 0)}" stroke-width="4"/>`);
  }
  wiresEl.innerHTML = out.join('');
  // em modo livre/manutenção dá para clicar no cabo e cortá-lo
  wiresEl.classList.toggle('cutting', S.free || S.mode === 'manutencao');
  $$('.term').forEach(t => t.classList.toggle('wired', !!count[t.dataset.term]));
}

/** corta o cabo clicado (só no modo livre/manutenção) */
function cutWire(i) {
  const w = S.wires[i];
  if (!w) return;
  if (!(S.free || S.mode === 'manutencao')) {
    coachShow('Cabo travado', 'Só é possível cortar cabo no modo livre ou no modo manutenção.');
    return;
  }
  S.wires.splice(i, 1);
  if (w.mission !== null && w.mission !== undefined) { S.done.delete(w.mission); renderMissions(); }
  S._k1 = S._k2 = undefined; S._coils = null;
  SFX.clack();
  logMsg('warn', `Cabo cortado: ${w.a} → ${w.b}`);
  paintTargets(); refresh();
}

/* --------------------------------- missões -------------------------------- */
function currentMission() {
  for (let i = 0; i < MISSIONS.length; i++) if (!S.done.has(i)) return { i, m: MISSIONS[i] };
  return null;
}

function missionLabel(i) {
  const m = MISSIONS[i];
  const f = k => k.endsWith(':*') ? k.slice(0, -2) + ' (qualquer borne)' : k;
  return `${f(m.a)} → ${f(m.b)}`;
}

/* cabeçalho do painel + barra de objetivo: sempre dizem o que fazer AGORA */
function renderPane() {
  const manut = S.mode === 'manutencao';
  const teste = S.etapa === 3 && !manut;
  $('#mission-list').classList.toggle('hidden', teste);
  $('#test-list').classList.toggle('hidden', !teste);

  let title, count, pct, objStep, objCount, objText;
  if (manut) {
    const d = S.defect;
    title = 'Ordem de serviço'; count = S._fixed ? '1 / 1' : '0 / 1'; pct = S._fixed ? 100 : 0;
    objStep = 'Manutenção'; objCount = d ? d.os : '';
    objText = d ? d.sintoma : '';
  } else if (S.etapa === 1) {
    const feitos = Object.keys(S.placed).length, total = PARTS.length;
    title = 'Etapa 1 — Fixar componentes'; count = `${feitos} / ${total}`; pct = feitos / total * 100;
    objStep = 'Fixar'; objCount = `${feitos} / ${total}`;
    objText = feitos ? 'Continue fixando os componentes que faltam na placa.'
      : 'Arraste os componentes da caixa para os contornos tracejados da placa.';
  } else if (S.etapa === 2) {
    const cur = currentMission();
    title = 'Etapa 2 — Ligar os cabos'; count = `${S.done.size} / ${MISSIONS.length}`;
    pct = S.done.size / MISSIONS.length * 100;
    objStep = `Ligação ${Math.min(S.done.size + 1, MISSIONS.length)}`;
    objCount = SECTIONS[cur ? cur.m.sec : Object.keys(SECTIONS)[0]] || '';
    objText = cur ? `${missionLabel(cur.i)} — ${cur.m.hint}` : 'Montagem concluída!';
  } else {
    const cur = currentTest();
    title = 'Etapa 3 — Teste de funcionamento'; count = `${S.testDone.size} / ${TESTS.length}`;
    pct = S.testDone.size / TESTS.length * 100;
    objStep = 'Teste'; objCount = `${S.testDone.size} / ${TESTS.length}`;
    objText = cur ? `${cur.title}: ${cur.task}` : 'Sequência de funcionamento concluída.';
  }
  $('#pane-title').textContent = title;
  $('#pane-count').textContent = count;
  $('#pane-bar').style.width = pct + '%';
  $('#obj-etapa').textContent = objStep;
  $('#obj-count').textContent = objCount;
  $('#obj-text').textContent = objText;

  const cur = S.etapa === 2 && !manut ? currentMission() : null;
  $('#obj-locate').classList.toggle('hidden', !cur);
  $('#tab-badge').classList.toggle('hidden', !(teste && currentTest()));
}

function renderMissions() {
  if (S.mode === 'manutencao' && S.defect) {
    const d = S.defect;
    $('#mission-list').innerHTML = `
      <div class="os ${S._fixed ? 'ok' : ''}">
        <div class="os-head"><b>${d.os}</b><span>${S._fixed ? 'ENCERRADA' : 'EM ABERTO'}</span></div>
        <div class="os-title">${d.titulo}</div>
        <p class="os-sym"><b>Sintoma relatado pelo operador:</b> ${d.sintoma}</p>
        <div class="os-steps">
          <div><b>1.</b> Reproduza o sintoma na bancada (Q1, Q2, S1, S2 e S0).</div>
          <div><b>2.</b> Desligue Q1 e Q2 e use o <b>Multímetro</b> para testar continuidade nos pontos suspeitos.</div>
          <div><b>3.</b> Confira o <b>Esquema</b> para ver como a ligação deveria estar.</div>
          <div><b>4.</b> Clique num cabo errado para cortá-lo e refaça a ligação correta nos bornes.</div>
        </div>
        <p class="os-hint"><b>Onde investigar:</b> ${d.medir}</p>
        <p class="os-note">A lista de missões fica escondida de propósito: o diagnóstico é seu.</p>
      </div>
      <div class="statcard">
        <h4>Checklist do reparo</h4>
        <div class="motorline"><span>Fiação conforme o esquema</span>
          <strong class="pill ${S._fixed ? 'on' : 'off'}">${S._fixed ? 'ok' : 'pendente'}</strong></div>
        <div class="motorline"><span>Cabos fora do esquema</span>
          <strong class="pill ${S.wires.filter(w => w.mission === null).length ? 'warn' : 'ok'}">${S.wires.filter(w => w.mission === null).length}</strong></div>
      </div>`;
    renderPane();
    return;
  }
  const list = [];
  let lastSec = null, lastSub = null;
  const cur = currentMission();
  const fmt = k => k.endsWith(':*') ? k.slice(0, -2) + ':*' : k;
  MISSIONS.forEach((m, i) => {
    if (m.sec !== lastSec) { lastSec = m.sec; list.push(`<div class="sec-head">${SECTIONS[m.sec] || m.sec}</div>`); }
    const done = S.done.has(i), atual = cur && cur.i === i;
    const cls = done ? 'done' : (atual ? 'current' : '');
    if (atual) lastSub = i;
    list.push(`<div class="mission ${cls}" data-mi="${i}">
       <div class="dot">${done ? '✓' : i + 1}</div>
       <div class="body">
         <div class="wirelb"><code>${fmt(m.a)}</code>
           <svg class="ic"><use href="#i-arrow"/></svg>
           <code>${fmt(m.b)}</code></div>
         <span class="hint">${m.hint}</span>
       </div>
     </div>`);
  });
  $('#mission-list').innerHTML = list.join('');
  renderPane();
  const el = $('.mission.current');
  if (el && lastSub !== null) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function paintTargets() {
  $$('.term').forEach(t => t.classList.remove('target'));
  if (S.free) return;
  const cur = currentMission();
  if (!cur) return;
  $$('.term').forEach(t => {
    const k = t.dataset.term;
    if (matchTerm(k, cur.m.a) || matchTerm(k, cur.m.b)) t.classList.add('target');
  });
}

/*
 * Aviso da bancada. Ele fica NO CANTO do quadro (nunca no meio da placa, onde
 * atrapalharia a montagem) e se fecha sozinho: mensagem de rotina some rápido,
 * aviso importante fica mais tempo. O que o jogador precisa fazer AGORA está
 * sempre na faixa de objetivo e na lista de tarefas — o aviso é só reforço.
 */
let coachTimer = 0;
function coachShow(title, msg, ms) {
  $('#coach-title').textContent = title;
  $('#coach-desc').textContent = msg;
  const el = $('#coach');
  el.classList.remove('hidden');
  el.classList.toggle('info', false);
  clearTimeout(coachTimer);
  coachTimer = setTimeout(hideCoach, ms === undefined ? 5200 : ms);
}
function hideCoach() {
  clearTimeout(coachTimer);
  $('#coach').classList.add('hidden');
}

/* ---------------- etapa 3 — teste de funcionamento ------------------------
   Cada missão traz a sua sequência em data.js (TESTS): a do quadro de
   reversão repete a seção "Funcionamento" do esquema e a do inversor segue as
   funções do drive (marcha, referência, sentido, parada, falha e reset).
   Cada passo é conferido na bancada, em tempo real. */
function currentTest() {
  return TESTS.find(s => !S.testDone.has(s.id)) || null;
}

function renderTests() {
  const cur = currentTest();
  $('#test-list').innerHTML = TESTS.map((s, i) => {
    const done = S.testDone.has(s.id);
    const cls = done ? 'done' : (cur && cur.id === s.id ? 'current' : '');
    return `<div class="mission ${cls}" data-tid="${s.id}">
       <div class="dot">${done ? '✓' : i + 1}</div>
       <div class="body">
         <div class="wirelb"><code>${s.title}</code></div>
         <span class="hint">${done ? s.why : s.task}</span>
       </div>
     </div>`;
  }).join('');
  renderPane();
}

function evalTests(res) {
  const cur = currentTest();
  if (!cur) return;
  if (!cur.ok(S, res)) return;
  S.testDone.add(cur.id);
  S.score += 15;
  SFX.ok(); flashScore();
  logMsg('ok', `✔ ${cur.title} — ${cur.why}`);
  renderTests();
  const nx = currentTest();
  if (nx) coachShow(`Teste ${S.testDone.size}/${TESTS.length}`, nx.task);
  else {
    coachShow('Sequência de funcionamento concluída!', 'Você montou e operou o quadro exatamente como no esquema.');
    if (!S._celebrated) { S._celebrated = true; setTimeout(celebrate, 700); }
  }
  setTimeout(refresh, 0);   // atualiza HUD/lista sem re-entrar em refresh()
}

function startTesting() {
  S.etapa = 3;
  S._stage3 = true;
  renderTests();
  activateTab('tarefas');
  openSidebar(true);
  logMsg('ok', 'Montagem concluída! Agora siga a sequência de teste na bancada.');
  const cur = currentTest();
  if (cur) coachShow('Etapa 3 — Teste de funcionamento', cur.task);
}

/* navegação do painel lateral (aba + gaveta no mobile) */
function activateTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tabbody').forEach(b => b.classList.add('hidden'));
  const pane = $('#tab-' + name);
  if (pane) pane.classList.remove('hidden');
}
/* em tela larga o painel é fixo: a gaveta e a cortina só valem no layout estreito */
function openSidebar(on) {
  const estreito = window.innerWidth <= 1180;
  $('#sidebar').classList.toggle('open', !!on && estreito);
  scrim().classList.toggle('hidden', !(on && estreito));
}
let _scrim = null;
function scrim() {
  if (!_scrim) {
    _scrim = document.createElement('div');
    _scrim.className = 'scrim hidden';
    _scrim.onclick = () => openSidebar(false);
    document.body.appendChild(_scrim);
  }
  return _scrim;
}

/* ============================================================================
   MULTÍMETRO — mede tensão/continuidade entre dois bornes a partir das redes
   elétricas já resolvidas pelo sim.js (é o instrumento do modo manutenção).
   ========================================================================== */
const METER = { on: false, a: null, b: null };

function measure(res, ka, kb) {
  const na = res.netOf[ka], nb = res.netOf[kb];
  if (!na || !nb) return { v: '—', unit: '', txt: 'Borne fora da placa (componente não fixado).' };
  if (na === nb) return { v: '0,0', unit: 'Ω', txt: 'CONTINUIDADE — os dois bornes são o mesmo ponto elétrico.', beep: true };
  const fa = [...na.phases], fb = [...nb.phases];
  if (fa.length && fb.length) return { v: '380', unit: 'V ~', txt: `Tensão de linha entre ${PHASE_NAME[fa[0]]} e ${PHASE_NAME[fb[0]]}.` };
  if ((fa.length && nb.hasN) || (fb.length && na.hasN)) return { v: '220', unit: 'V ~', txt: 'Tensão fase-neutro.' };
  if (fa.length || fb.length) return { v: '0,0', unit: 'V', txt: 'Sem referência: o outro ponto está flutuando (circuito aberto).' };
  return { v: '0,0', unit: 'Ω', txt: 'Sem tensão nem continuidade — provável cabo faltando ou contato aberto.' };
}

function meterProbe(k) {
  if (METER.a && !METER.b) METER.b = k;
  else { METER.a = k; METER.b = null; }
  if (METER.a && METER.b) {
    const m = measure(S.res, METER.a, METER.b);
    if (m.beep) SFX.beep(); else SFX.click();
    S._reading = m;
    logMsg(m.beep ? 'ok' : 'info', `Multímetro ${METER.a} ↔ ${METER.b}: ${m.v} ${m.unit} — ${m.txt}`);
  } else SFX.click();
  paintMeter(); paintSel();
}

function paintMeter() {
  const on = METER.on;
  $('#meter').classList.toggle('hidden', !on);
  if (!on) return;
  $('#meter-a').textContent = METER.a || '—';
  $('#meter-b').textContent = METER.b || '—';
  const m = S._reading;
  const val = $('#meter-val'), unit = $('#meter-unit'), txt = $('#meter-txt');
  if (METER.a && METER.b && m) {
    val.textContent = m.v; unit.textContent = m.unit; txt.textContent = m.txt;
    val.classList.toggle('cont', !!m.beep);
  } else {
    val.textContent = '— — —'; unit.textContent = '';
    txt.textContent = METER.a ? 'Agora clique no segundo borne (probe B).' : 'Clique em dois bornes da placa para medir.';
    val.classList.remove('cont');
  }
}

function setMeter(on) {
  METER.on = on;
  METER.a = METER.b = null; S._reading = null;
  $('#btn-meter').classList.toggle('on', on);
  S.sel = null;
  paintMeter(); paintSel();
  if (on) coachShow('Multímetro ligado', 'Clique em dois bornes para medir tensão (V ~) ou continuidade. Com Q1/Q2 desligados a continuidade acha fio rompido.');
}

/* ============================================================================
   MODO MANUTENÇÃO — o quadro vem montado com UM defeito escondido.
   Os defeitos (sintoma, causa e como medir) estão em data.js.
   ========================================================================== */

/** fiação de referência (a do esquema), com os retornos distribuídos na barra */
function goldenWires() {
  const used = new Set();
  return MISSIONS.map(m => {
    const pick = pat => {
      if (!pat.endsWith(':*')) return pat;
      const id = pat.slice(0, -2), terms = PART_BY_ID[id].terms;
      const free = terms.find(t => !used.has(id + ':' + t.id));
      const k = id + ':' + (free || terms[0]).id; used.add(k); return k;
    };
    return { a: pick(m.a), b: pick(m.b) };
  });
}

/** compara a fiação atual com a do esquema (aceita qualquer borne da barra de retorno) */
function wiringMatchesSchema() {
  const norm = list => list.map(w => wireKey(w.a, w.b)).sort();
  const want = norm(goldenWires()), have = norm(S.wires);
  return want.length === have.length && want.every((k, i) => k === have[i]);
}

function startMaintenance(defectId) {
  resetAll();
  S.mode = 'manutencao';
  S.free = true;                                  // libera reparar/cortar a fiação
  $('#btn-livre').classList.add('on');
  PARTS.forEach(p => placePart(p.id));            // etapa 1 já resolvida
  const used = new Set();
  const pick = pat => {
    if (!pat.endsWith(':*')) return pat;
    const id = pat.slice(0, -2), terms = PART_BY_ID[id].terms;
    const free = terms.find(t => !used.has(id + ':' + t.id));
    const k = id + ':' + (free || terms[0]).id; used.add(k); return k;
  };
  MISSIONS.forEach(m => { S.sel = null; makeWire(pick(m.a), pick(m.b)); });   // montagem correta

  const d = DEFECTS.find(x => x.id === defectId) || DEFECTS[Math.floor(Math.random() * DEFECTS.length)];
  S.defect = d;
  S.wires = d.montar(S.wires);                    // injeta o defeito escondido
  S.score = 0; S.errors = 0; S.elapsed = 0; S._t0 = Date.now();
  S._k1 = S._k2 = undefined; S._coils = null; S.sel = null; S._fixed = false;
  S.done = new Set(MISSIONS.map((_, i) => i));    // a fiação do esquema já estava pronta

  paintSel(); renderMissions(); paintTargets(); refresh(); fitBoard();
  activateTab('tarefas');
  if (window.innerWidth <= 1180) openSidebar(true);
  logMsg('err', `${d.os} aberta — ${d.titulo}. Defeito plantado na montagem.`);
  coachShow(`${d.os} — ${d.titulo}`, d.sintoma);
}

function checkRepair() {
  if (S.mode !== 'manutencao' || S._fixed || !S.defect) return;
  if (!wiringMatchesSchema()) return;
  S._fixed = true;
  S.score += 60; S._repairs++;
  SFX.ok(); flashScore();
  logMsg('ok', `✔ ${S.defect.os} encerrada — fiação conforme o esquema.`);
  renderMissions();
  setTimeout(refresh, 0);   // atualiza HUD/checklist sem re-entrar em refresh()
  const d = S.defect;
  $('#modal-title').textContent = `✔ ${d.os} — reparo concluído`;
  $('#modal-body').innerHTML = `<div class="cert">
      <p>Você diagnosticou e corrigiu o defeito <b>sem</b> a lista de ligações — só pelos sintomas e pelo multímetro.</p>
      <div class="big">+60 pts</div>
      <p><b>Defeito:</b> ${d.titulo}</p>
      <p><b>Causa:</b> ${d.causa}</p>
      <p style="color:#9fb6c9;font-size:13px"><b>Como achar:</b> ${d.medir}</p>
      <button class="btn" id="prox-defeito">Próximo defeito</button>
      <button class="btn ghost" id="sair-manut">Voltar ao modo esquema</button>
    </div>`;
  $('#modal').classList.remove('hidden');
  $('#prox-defeito').onclick = () => startMaintenance(null);
  $('#sair-manut').onclick = () => { $('#modal').classList.add('hidden'); resetAll(); };
}

/* ------------------------------- interação -------------------------------- */
function clickTerm(k) {
  if (METER.on) { meterProbe(k); return; }
  if (S.etapa !== 2 && !(S.etapa === 3 && S.free)) return;
  if (S.sel === k) { S.sel = null; paintSel(); return; }
  if (!S.sel) { S.sel = k; paintSel(); SFX.click(); return; }
  const a = S.sel, b = k;
  S.sel = null; paintSel();
  makeWire(a, b);
}

function paintSel() {
  $$('.term').forEach(t => {
    const k = t.dataset.term;
    t.classList.toggle('selected', !METER.on && k === S.sel);
    t.classList.toggle('probe-a', METER.on && k === METER.a);
    t.classList.toggle('probe-b', METER.on && k === METER.b);
  });
}

function makeWire(a, b) {
  if (a === b) return;
  if (a.split(':')[0] === b.split(':')[0] && !a.endsWith(':*')) {
    // mesmo componente é permitido (ex.: Q1:1 -> Q1:2), só evita duplicar
  }
  if (S.wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a))) {
    coachShow('Já ligado', 'Já existe um cabo entre esses dois bornes.', 3200);
    SFX.err(); return;
  }
  // qual missão casa?
  let mi = null;
  MISSIONS.forEach((m, i) => { if (mi === null && missionMatches(m, a, b)) mi = i; });

  if (!S.free) {
    const cur = currentMission();
    if (mi === null || (cur && mi !== cur.i)) {
      S.errors++;
      flashTerm(b); SFX.err();
      coachShow('Ops!', `Não é essa ligação agora. ${cur ? 'A missão é: ' + missionLabel(cur.i) : ''}`, 4200);
      return;
    }
  }
  const w = { a, b, ok: mi !== null, mission: mi, id: ++S.seq };
  S.wires.push(w);
  if (mi !== null && !S.done.has(mi)) {
    S.done.add(mi); S.score += 10; SFX.ok();
    flashScore();
  } else if (mi === null) {
    S.score = Math.max(0, S.score - 2);
  }
  /* ligação correta é rotina: nada de aviso em cima da placa — o avanço aparece
     na lista de tarefas, na barra de objetivo, no ponto e no som. O aviso fica
     só para o que foge do normal (ligação errada, cabo repetido) e para o fim
     da montagem. */
  renderMissions(); paintTargets(); refresh();
  if (!currentMission()) {
    coachShow('Montagem concluída!', 'Ligue Q1 e Q2 e aperte S1 ou S2 para fazer o motor girar.', 9000);
  }
}

function flashTerm(k) {
  const el = $(`.term[data-term="${k}"]`);
  if (!el) return;
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 700);
}

function flashScore() {
  const el = $('#hud-score');
  el.style.transition = 'none'; el.style.color = '#7ff0b0'; el.style.transform = 'scale(1.25)';
  setTimeout(() => { el.style.transition = '.4s'; el.style.color = ''; el.style.transform = ''; }, 60);
}

/* -------------------------------- solução --------------------------------- */
function refresh() {
  const res = solve(S, S.wires, S._coils);
  S.res = res;
  /* a memória viaja para o próximo ciclo: as bobinas do contator E as
     memórias internas do inversor (RUN) — sem isto o drive pararia ao soltar
     o botão de marcha */
  S._coils = Object.assign({}, res.coils);

  const wasK1 = S._k1, wasK2 = S._k2;
  if (wasK1 !== undefined && (wasK1 !== res.coils.K1 || wasK2 !== res.coils.K2)) SFX.clack();
  S._k1 = res.coils.K1; S._k2 = res.coils.K2;

  // curto-circuito
  if (res.short && !S.shortFired) {
    S.shortFired = true;
    SFX.boom();
    const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 600);
    S.q1 = false; S.q2 = false;
    logMsg('err', res.faults[0].type === 'curto-fase-fase'
      ? 'CURTO-CIRCUITO entre fases: o disjuntor geral desarmou.'
      : 'CURTO-CIRCUITO fase-neutro: o disjuntor geral desarmou.');
    logMsg('warn', 'Verifique o intertravamento (contatos NF 11-12 cruzados entre K1 e K2).');
  }
  if (!res.short) S.shortFired = false;

  applyVisual(res);
  renderWires();
  updateUI(res);
}

function applyVisual(res) {
  // bobinas do projeto (contatores; no inversor a memória de RUN é interna)
  COILS.forEach(c => {
    const el = $(`.part[data-part="${c.id}"]`);
    if (el) el.classList.toggle('energized', !!res.coils[c.id]);
  });
  // lâmpadas de sinalização do projeto
  LAMPS.forEach(l => {
    const el = $(`.part[data-part="${l.id}"]`);
    if (!el) return;
    el.classList.toggle('lamp-on', !!res.lamps[l.id]);
    el.style.setProperty('--glow', l.c);
  });
  // eixo do motor: a velocidade acompanha a frequência do inversor
  const m = $('.part[data-part="M1"]');
  if (m) {
    let sp = m.querySelector('.shaft');
    if (!sp) {
      sp = document.createElement('div');
      sp.className = 'shaft';
      sp.style.cssText = 'position:absolute;left:-34px;top:60px;width:56px;height:56px;border-radius:50%;' +
        'border:5px dashed rgba(40,60,80,.55);opacity:0;transition:opacity .2s';
      m.appendChild(sp);
    }
    const on = res.motor.state === 'girando';
    const vel = clamp((res.motor.hz || 0) / 60, .12, 1);
    sp.style.opacity = on ? '1' : '0';
    sp.style.animation = on ? `spin ${(1.7 - 1.35 * vel).toFixed(2)}s linear infinite` : 'none';
    sp.style.animationDirection = res.motor.dir > 0 ? 'normal' : 'reverse';
    sp.style.borderColor = on ? (res.motor.dir > 0 ? 'rgba(111,240,174,.85)' : 'rgba(255,194,133,.9)') : 'transparent';
  }
  if (VFD) updateHMI(res);
}

/* ---------------------- painel (display) do inversor ---------------------- */
/* O que o operador vê na frente do drive: frequência, estado e os LEDs das
   entradas digitais. O mesmo conteúdo vai para o HMI do quadro (dentro da peça)
   e para os elementos do painel lateral e da bancada. */
function hmiState(res) {
  const d = res.dev || {};
  if (d.fault) return { hz: '000.0', st: 'F051 FALHA', cls: 'fault' };
  if (!d.run) {
    if (d.faseFaltando) return { hz: '----', st: 'F022 FALTA FASE', cls: 'fault' };
    if (!d.powered) return { hz: '----', st: 'SEM TENSÃO', cls: 'off' };
    return d.enabled
      ? { hz: '000.0', st: 'READY', cls: 'ready' }
      : { hz: '000.0', st: 'SEM HABILITAÇÃO', cls: 'off' };
  }
  if (d.ref <= 0.001) return { hz: '000.0', st: 'RUN SEM REFERÊNCIA', cls: 'warn' };
  return { hz: d.hz.toFixed(1).padStart(5, '0'), st: d.rev ? 'RUN  REV' : 'RUN  FWD', cls: 'run' };
}

function updateHMI(res) {
  if (!VFD) return;
  const h = hmiState(res);
  const el = $('.part[data-part="' + VFD.part + '"]');
  if (el && !el.querySelector('.hmi')) {
    el.insertAdjacentHTML('beforeend', `<div class="hmi">
        <div class="hmi-hz"><span></span><small>Hz</small></div>
        <div class="hmi-st"></div>
        <div class="hmi-di">${['DI1', 'DI2', 'DI3', 'DI4'].map(k => `<i data-di="${k}">${k.slice(2)}</i>`).join('')}</div>
      </div>`);
  }
  if (el) {
    el.querySelector('.hmi .hmi-hz span').textContent = h.hz;
    const st = el.querySelector('.hmi .hmi-st');
    st.textContent = h.st;
    st.dataset.k = h.cls;
    el.querySelectorAll('.hmi-di i').forEach(i => {
      const k = i.dataset.di.toLowerCase();
      i.classList.toggle('on', !!(res.dev && res.dev.di && res.dev.di[k]));
    });
  }
  // painel lateral / bancada
  const hz = $('#drv-hz-2'); if (hz) hz.textContent = h.hz;
  const st2 = $('#drv-st-2'); if (st2) { st2.textContent = h.st; st2.dataset.k = h.cls; }
  // LEDs das entradas digitais (bancada e painel lateral)
  const MAPA_DI = { di1: 'start', di2: 'stop', di3: 'enable', di4: 'dir' };
  Object.keys(MAPA_DI).forEach(k => {
    const led = document.querySelectorAll('#di-' + k + ', .hmi-di i[data-di="' + k.toUpperCase() + '"]');
    led.forEach(n => n.classList.toggle('on', !!(res.dev && res.dev.di && res.dev.di[MAPA_DI[k]])));
  });
  const rl = $('#drv-rl');
  if (rl) {
    const falha = !!(res.dev && res.dev.fault);
    rl.textContent = falha ? 'RL1 comutado (falha)' : 'RL1 em repouso (NF fechado)';
    rl.className = 'pill ' + (falha ? 'err' : 'ok');
  }
  const ro = $('#drv-ref');
  if (ro) ro.textContent = (S.ref * 100).toFixed(0) + ' % · ' + ((S.ref * (VFD.fmax || 60))).toFixed(0) + ' Hz';
}

/* --------------------------------- HUD ------------------------------------ */
function updateUI(res) {
  $('#hud-score').textContent = S.score;
  const manut = S.mode === 'manutencao';
  const prog = manut
    ? { n: S._fixed ? 1 : 0, t: 1 }
    : (S.etapa === 3
      ? { n: S.testDone.size, t: TESTS.length }
      : { n: S.done.size, t: MISSIONS.length });
  $('#hud-progress').textContent = `${prog.n} / ${prog.t}`;
  $('#hud-bar').style.width = (prog.n / prog.t * 100) + '%';
  $('#hud-label-prog').textContent = manut ? 'Reparo' : (S.etapa === 3 ? 'Testes' : 'Ligações');
  $('#hud-etapa').textContent = manut
    ? (S._fixed ? 'O.S. encerrada — reparo OK' : 'Manutenção — diagnosticar o defeito')
    : (S.etapa === 1 ? '1 / 3 — Fixar componentes'
      : S.etapa === 2 ? '2 / 3 — Ligar os cabos' : '3 / 3 — Teste de funcionamento');

  const ms = res.motor.state;
  $('#st-motor').textContent = {
    'parado': 'Motor parado', 'girando': 'Motor girando',
    'falta-fase': 'Não parte (falta fase)', 'sem-ref': 'Em RUN sem referência de velocidade',
  }[ms] || ms;
  $('#st-rot').textContent = ms === 'girando'
    ? (res.motor.dir > 0 ? 'sentido horário (frente)' : 'sentido anti-horário (ré)') : '—';

  // contatores do projeto
  COILS.forEach(c => {
    if (c.fn) return;                        // memória interna do inversor (RUN)
    const el = $('#st-' + c.id.toLowerCase());
    if (!el) return;
    el.textContent = res.coils[c.id] ? 'energizado' : 'desligado';
    el.className = 'pill ' + (res.coils[c.id] ? 'on' : 'off');
  });

  const f1 = $('#st-f1');
  if (f1) {
    f1.textContent = S.f1Tripped ? 'ATUADO (sobrecarga)' : 'normal';
    f1.className = 'pill ' + (S.f1Tripped ? 'err' : 'ok');
  }

  $('#st-lamps').innerHTML = LAMPS.map(l =>
    `<div class="lamp ${res.lamps[l.id] ? 'on' : ''}" style="--c:${l.c}">
       <div class="bulb"></div>${l.tag} · ${l.name}</div>`).join('');

  // motor (painel lateral)
  const svg = $('#motor-svg');
  svg.classList.toggle('on', ms === 'girando');
  svg.classList.toggle('fault', ms === 'falta-fase' || res.short);
  $('#motor-txt').textContent = S.short ? 'CURTO'
    : (ms === 'girando' ? (res.motor.dir > 0 ? 'FWD' : 'REV')
      : (ms === 'falta-fase' ? 'FAULT' : (ms === 'sem-ref' ? '0 Hz' : 'OFF')));
  const rotor = $('#motor-rotor');
  rotor.style.transformOrigin = '60px 60px';
  const vel = clamp((res.motor.hz || 0) / 60, .12, 1);
  rotor.style.animation = ms === 'girando'
    ? `spin ${(1.9 - 1.5 * vel).toFixed(2)}s linear infinite` : 'none';
  rotor.style.animationDirection = res.motor.dir > 0 ? 'normal' : 'reverse';

  // bancada
  const ctrlLive = S.q2 && !S.f1Tripped && !(res.dev && res.dev.fault);
  const rov = $('#ro-voltage');
  if (rov) rov.innerHTML = VFD
    ? `Comando: <b>${ctrlLive ? '380 V' : '0 V'}</b> · fonte do inversor: <b>24 Vcc</b>`
    : `Tensão no comando: <b>${ctrlLive ? '380 V entre L1 e L2' : '0 V'}</b>`;
  const rv2 = $('#ro-voltage2'); if (rv2) rv2.textContent = ctrlLive ? '380 V' : '0 V';
  let msg;
  if (S.short) msg = 'Curto-circuito detectado: rearme o disjuntor depois de corrigir a fiação.';
  else if (S.f1Tripped) msg = 'Relé térmico atuou. Aperte REARMAR no F1 e reduza a carga.';
  else if (res.dev && res.dev.fault) msg = 'Inversor em falha (F051). Anote o código, reduza a carga e aperte RESET no painel do drive.';
  else if (ms === 'girando') msg = VFD
    ? `Inversor em ${res.dev.rev ? 'REV' : 'FWD'} a ${res.motor.hz.toFixed(1)} Hz (${(S.ref * 100).toFixed(0)} % da referência).`
    : (res.motor.dir > 0 ? 'Motor girando no sentido horário (K1 / frente).' : 'Motor girando no sentido anti-horário (K2 / ré).');
  else if (ms === 'sem-ref') msg = 'Inversor em RUN com 0,0 Hz: a referência de velocidade não está chegando no AI1.';
  else if (ms === 'falta-fase') msg = VFD ? 'Falta uma fase na saída do inversor (cabo do motor aberto).' : 'O motor não parte: falta uma fase ou há fio trocado.';
  else if (S.q1 && S.q2) msg = VFD ? 'Quadro energizado. Aperte S1 para fechar o contator e dar partida no inversor.' : 'Quadro energizado. Aperte S1 (frente) ou S2 (ré).';
  else msg = 'Ligue Q1 e Q2 para energizar o quadro.';
  const rom = $('#ro-msg');
  if (rom) rom.textContent = msg;

  // interruptores da bancada (o rótulo muda por projeto)
  ['q1', 'q2'].forEach(id => {
    const c = $('#ctl-' + id);
    if (!c) return;
    c.classList.toggle('on', !!S[id]);
    const bb = c.querySelector('b');
    if (bb) bb.textContent = S[id] ? 'LIGADO' : 'OFF';
  });

  // som do motor
  if (res.motor.state === 'girando') SFX.humOn(); else SFX.humOff();

  // etapa 2 concluída ⇒ entra no teste de funcionamento (uma única vez)
  if (!manut && S.etapa === 2 && !S._stage3 && S.done.size === MISSIONS.length) startTesting();
  if (S.etapa === 3 && !manut) evalTests(res);
  if (manut) checkRepair();
  renderPane();
}

function logMsg(kind, text) {
  const d = document.createElement('div');
  d.className = kind;
  d.textContent = `[${new Date().toLocaleTimeString('pt-BR', { hour12: false })}] ${text}`;
  const log = $('#st-log');
  log.prepend(d);
  while (log.children.length > 40) log.lastChild.remove();
}

/* ------------------------------- etapa 1 ---------------------------------- */
function finishEtapa1() {
  S.etapa = 2;
  $('#tray').classList.add('hidden');
  $('#board-wrap').classList.add('tray-off');
  fitBoard();
  buildGhosts();
  $$('.ghost').forEach(g => g.classList.add('done'));
  paintTargets();
  const cur = currentMission();
  if (cur) coachShow('Etapa 2 — Ligar os cabos', cur.m.hint);
  logMsg('ok', 'Componentes fixados na placa. Comece pelo circuito de potência.');
  fitBoard();
}

function setupDrag() {
  /*
   * Arraste das peças da caixa para a placa. Funciona com mouse E com toque:
   *  · o toque é rastreado pelo pointerId (o primeiro dedo que pegou a peça);
   *  · pointercancel devolve a peça à caixa — é o que o navegador manda quando
   *    ele rouba o gesto (rolar/zoom), e sem isso o fantasma ficava preso na
   *    tela no celular;
   *  · a tolerância de encaixe é definida EM TELA (~46 px de dedo) e convertida
   *    para px do palco — com zoom de 21% do celular, 60 px do palco seriam só
   *    ~12 px na tela e o encaixe não aconteceria.
   */
  let drag = null;

  /** o ponteiro está dentro da zona de encaixe da peça (em px do palco)? */
  const naZona = (p, sp) => {
    const tol = clamp(46 / Math.max(VIEW.z, .1), 60, 280);
    return sp.x > p.x - tol && sp.x < p.x + p.w + tol &&
      sp.y > p.y - tol && sp.y < p.y + p.h + tol;
  };

  const onDown = e => {
    if (drag) return;                              // um arraste por vez (multi-toque)
    const item = e.target.closest?.('[data-tray]');   // ?. : alvo pode não ser elemento
    if (!item) return;
    e.preventDefault();
    const id = item.dataset.tray, p = PART_BY_ID[id];
    drag = { id, pid: e.pointerId, item, ghost: document.createElement('div') };
    /* o fantasma segue o dedo no tamanho do zoom (com piso, para dar para ver
       o que está na mão num celular) */
    const scale = Math.max(parseFloat($('#zoom-val').textContent) / 100, .32);
    drag.ghost.className = 'dragghost';
    drag.ghost.style.cssText = `position:fixed;width:${p.w}px;height:${p.h}px;pointer-events:none;z-index:500;
       transform:translate(-50%,-50%);opacity:.9;filter:drop-shadow(0 12px 18px rgba(0,0,0,.6))`;
    drag.ghost.innerHTML = p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:contain">` : '';
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    drag.ghost.style.transform = `translate(-50%,-50%) scale(${scale})`;
    document.body.appendChild(drag.ghost);
    item.style.opacity = '.4';
  };

  const onMove = e => {
    if (!drag || e.pointerId !== drag.pid) return;
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    const sp = toStage(e.clientX, e.clientY);
    $(`[data-ghost="${drag.id}"]`)?.classList.toggle('over', naZona(PART_BY_ID[drag.id], sp));
  };

  /** solta (pointerup) ou cancela (pointercancel: rolagem/gesto do navegador) */
 const solta = (e, podeEncaixar) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const p = PART_BY_ID[drag.id];
    let colocou = false;
    if (podeEncaixar) {
      const sp = toStage(e.clientX, e.clientY);
      colocou = naZona(p, sp);
    }
    drag.ghost.remove();
    $(`[data-ghost="${drag.id}"]`)?.classList.remove('over');
    if (colocou) placePart(drag.id, true);
    else drag.item.style.opacity = '';
    drag = null;
  };
  const onUp = e => solta(e, true);
  const onCancel = e => solta(e, false);   // devolve a peça à caixa, sem encaixar

  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
}

function toStage(clientX, clientY) {
  const r = boardEl.getBoundingClientRect();
  return {
    x: (clientX - r.left) / (r.width / STAGE.w),
    y: (clientY - r.top) / (r.height / STAGE.h),
  };
}

/* ------------------------- zoom, arrasto e foco ---------------------------- */
/* O tabuleiro é centrado pelo grid; a transformação é aplicada sobre o centro:
   um ponto do palco (x,y) cai em centro + translate + (x - metade) * escala.   */
const VIEW = { z: 1, tx: 0, ty: 0 };
/** semTransicao: salto direto, para o ajuste inicial não ficar preso na transição */
function applyView() {
  boardEl.style.transform = `translate(${VIEW.tx}px,${VIEW.ty}px) scale(${VIEW.z})`;
  $('#zoom-val').textContent = Math.round(VIEW.z * 100) + '%';
}
/*
 * Área útil do quadro: a caixa de componentes é uma faixa embaixo (telas em pé)
 * ou uma coluna à esquerda (telas largas). O ajuste, o zoom e o foco usam só o
 * que sobra — é isso que faz a placa ocupar a tela inteira em qualquer formato.
 * Coordenadas em relação ao canto superior esquerdo do #board-wrap.
 */
function viewArea() {
  const wrap = $('#board-wrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const t = $('#tray');
  let left = 0, top = 0, w = W, h = H;
  if (t && !t.classList.contains('hidden')) {
    const tw = t.offsetWidth, th = t.offsetHeight;
    if (tw < W * .5 && th > H * .5) { left = tw; w = W - tw; }   // coluna lateral
    else h = H - th;                                             // faixa inferior
  }
  return { left, top, w, h, cx: w / 2, cy: h / 2 };
}
function fitBoard() {
  const a = viewArea();
  const z = Math.max(.05, Math.min((a.w - 34) / STAGE.w, (a.h - 30) / STAGE.h));
  VIEW.z = z; VIEW.tx = 0; VIEW.ty = 0;
  applyView();
}
/** zoom em torno de um ponto (px relativo ao #board-wrap) */
function zoomBy(f, cx, cy) {
  const a = viewArea();
  const nx = clamp(VIEW.z * f, .08, 4);
  const px = cx === undefined ? a.cx : cx - a.left;
  const py = cy === undefined ? a.cy : cy - a.top;
  const dx = px - a.cx - VIEW.tx;
  const dy = py - a.cy - VIEW.ty;
  VIEW.tx -= dx * (nx / VIEW.z - 1);
  VIEW.ty -= dy * (nx / VIEW.z - 1);
  VIEW.z = nx;
  applyView();
}
/** centraliza a placa nos bornes de uma ligação */
function focusTerminals(a, b) {
  const A = TERM_POS[a] || TERM_POS[b], B = TERM_POS[b] || TERM_POS[a];
  if (!A || !B) return;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const area = viewArea();
  const z = clamp(Math.min(area.w / (Math.abs(A.x - B.x) + 520),
    area.h / (Math.abs(A.y - B.y) + 360)), .28, 1.35);
  VIEW.z = z;
  VIEW.tx = (STAGE.w / 2 - mx) * z;
  VIEW.ty = (STAGE.h / 2 - my) * z;
  applyView();
  [a, b].forEach(k => {
    const t = $(`.term[data-term="${k}"]`);
    if (!t) return;
    t.animate([{ boxShadow: '0 0 0 22px rgba(255,176,31,.55)' }, { boxShadow: '0 0 0 0 rgba(255,176,31,0)' }],
      { duration: 900, easing: 'ease-out' });
  });
}

function setupBoardNav() {
  const wrap = $('#board-wrap');
  let pan = null;
  wrap.addEventListener('wheel', e => {
    if (e.target.closest('#tray,#sidebar,.meter,#objective,.zoombar,#coach,#modal')) return;
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  wrap.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.term,#tray,#sidebar,.meter,#objective,.zoombar,#coach,#modal')) return;
    pan = { x: e.clientX, y: e.clientY, tx: VIEW.tx, ty: VIEW.ty, moved: false };
  });
  wrap.addEventListener('pointermove', e => {
    if (!pan) return;
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 6) return;
    pan.moved = true;
    VIEW.tx = pan.tx + dx; VIEW.ty = pan.ty + dy;
    applyView();
  });
  const endPan = () => { setTimeout(() => { pan = null; }, 0); };
  wrap.addEventListener('pointerup', endPan);
  wrap.addEventListener('pointercancel', endPan);
  wrap.addEventListener('pointerleave', endPan);
}

/* ------------------------------ bancada ----------------------------------- */
function pressButton(name, down) {
  if (S.pressed[name] === down) return;
  S.pressed[name] = down;
  if (down) SFX.click();
  const btn = { S0: '#ctl-s0', S1: '#ctl-s1', S2: '#ctl-s2' }[name];
  $(btn)?.classList.toggle('pressed', down);
  const part = { S0: 'S0', S1: 'S1', S2: 'S2' }[name];
  const pel = $(`.part[data-part="${part}"]`);
  if (pel) { pel.style.transform = down ? 'translateY(3px)' : ''; pel.style.filter = down ? 'brightness(1.3)' : ''; }
  refresh();
}

function tripF1(reason) {
  if (S.f1Tripped) return;
  S.f1Tripped = true;
  SFX.clack();
  logMsg('warn', 'Relé térmico F1 atuou (' + reason + '). Contatos 95-96 abriram e 97-98 fecharam.');
  refresh();
}

function celebrate() {
  if (S._certShown) return;
  S._certShown = true;
  const t = $('#hud-time').textContent;
  $('#modal-title').textContent = 'Quadro montado e testado!';
  $('#modal-body').innerHTML = `<div class="cert">
      <p>${VFD
      ? 'Você montou e comissionou um quadro com <b>inversor de frequência CFW 500</b>: ramal de potência com contator de linha, '
      + 'comando em 24 V pelas entradas digitais, referência por potenciômetro e proteção pela falha do drive.'
      : 'Você montou e operou o comando de motor trifásico com reversão <b>seguindo o esquema elétrico</b>: '
      + 'potência, comando e sinalização, mais a sequência de funcionamento (frente, parada, ré, sobrecarga e rearme).'}</p>
      <div class="big">${S.score} pts</div>
      <p>Tempo: <b>${t}</b> · Ligações: <b>${S.wires.length}</b> · Tentativas erradas: <b>${S.errors}</b></p>
      <p style="color:#9fb6c9;font-size:13px">${VFD
      ? 'Desafios extras: tire o fio do DI3 (habilitação) e veja o drive ficar em READY; inverta duas fases na saída do inversor e confira o motor girando ao contrário.'
      : 'Desafios extras: monte sem o intertravamento (11-12 cruzados) e veja o curto-circuito; troque entre si as fases da saída do K2 (2 e 6) e confira a rotação invertida.'}</p>
      <button class="btn" onclick="window.print()">Imprimir laudo</button>
    </div>`;
  $('#modal').classList.remove('hidden');
  SFX.ok();
}

/* --------------------------------- modais --------------------------------- */
function showSchematic() {
  const p = PROJECT;
  const imgs = p.schematic && p.schematic.imgs;
  /* legenda dos componentes da missão */
  const legend = PARTS.map(x => `<div><b>${x.id}</b> — ${x.name}${x.sub ? ` · ${x.sub}` : ''}</div>`).join('');
  /* lista técnica: as ligações da missão, na ordem do projeto */
  let lastSec = null;
  const lista = MISSIONS.map(m => {
    let head = '';
    if (m.sec !== lastSec) { lastSec = m.sec; head = `<div class="sec-head">${SECTIONS[m.sec] || m.sec}</div>`; }
    return head + `<div class="wirelb row"><code>${m.a}</code>
      <svg class="ic"><use href="#i-arrow"/></svg><code>${m.b}</code>
      <span class="hint">${m.hint}</span></div>`;
  }).join('');
  const params = p.parametros ? `
    <h4 class="helph4">Parametrização do inversor (conferir no manual do CFW 500)</h4>
    <div class="ptable">${p.parametros.map(([par, nome, val]) =>
    `<div><b>${par}</b><span>${nome}</span><em>${val}</em></div>`).join('')}</div>` : '';
  $('#modal-title').textContent = `${p.missao} — referência elétrica`;
  $('#modal-body').innerHTML = `
    <p class="tinyp"><b>${p.titulo}.</b> ${p.resumo}</p>
    ${imgs ? `<img class="schem" src="${imgs[0]}" alt="Esquema elétrico">` : ''}
    ${params}
    <h4 class="helph4">Componentes do quadro</h4>
    <div class="legend">${legend}</div>
    <h4 class="helph4">Ligações do projeto</h4>
    <div class="wlist">${lista}</div>
    ${imgs && imgs[1] ? `<img class="schem" style="margin-top:14px" src="${imgs[1]}" alt="Poster do esquema">` : ''}`;
  $('#modal').classList.remove('hidden');
}

function verify() {
  if (S.mode === 'manutencao') {
    const extra = S.wires.filter(w => w.mission === null).length;
    const ok = wiringMatchesSchema();
    $('#modal-title').textContent = 'Laudo técnico da O.S.';
    $('#modal-body').innerHTML = `
      <div class="check ${ok ? 'ok' : 'err'}">${ok
        ? '✔ A fiação bate com o esquema elétrico — reparo correto.'
        : '✘ A fiação ainda não bate com o esquema. Continue investigando com o multímetro e o Esquema.'}</div>
      <div class="check ${extra ? 'err' : 'ok'}">${extra
        ? `Atenção: há <b>${extra}</b> cabo(s) que não existem no esquema — provavelmente precisa cortar (clique no cabo).`
        : '✔ Nenhum cabo fora do esquema.'}</div>
      <div class="check">Teste de funcionamento: com Q1 e Q2 ligados, <b>S1</b> gira para frente,
        <b>S2</b> gira para trás e <b>S0</b> para o motor. Sobrecarga atua no F1 e acende a lâmpada AM SC de falha.</div>`;
    $('#modal').classList.remove('hidden');
    return;
  }
  const missing = [];
  MISSIONS.forEach((m, i) => { if (!S.done.has(i)) missing.push(i); });
  const extra = S.wires.filter(w => w.mission === null);
  const rows = [];
  rows.push(`<div class="check ${missing.length ? 'err' : 'ok'}">${missing.length
    ? `Faltam <b>${missing.length}</b> ligação(ões). A próxima é: <b>${missionLabel(missing[0])}</b>`
    : '✔ Todas as ligações do esquema foram feitas.'}</div>`);
  if (extra.length) rows.push(`<div class="check err">Atenção: <b>${extra.length}</b> cabo(s) fora do esquema:
    ${extra.map(w => `${w.a} → ${w.b}`).join(', ')}</div>`);
  if (S.res.short) rows.push(`<div class="check err">Curto-circuito: duas fases no mesmo ponto (ou fase direto no neutro).</div>`);
  if (!S.res.short && missing.length === 0) {
    rows.push(`<div class="check ok">Circuito elétrico coerente com o esquema. 🎯</div>`);
    rows.push(`<div class="check">${VFD
      ? 'Teste de funcionamento: com Q1 e Q2 ligados, <b>S1</b> fecha o contator K1 e dá partida no inversor (DI1); '
      + 'o <b>potenciômetro</b> dá a velocidade; <b>S2</b> troca o sentido (DI4); <b>S0</b> para tudo. '
      + 'Na sobrecarga o drive atua (F051), o relé RL1 derruba o K1 e acende a AM SC.'
      : 'Teste de funcionamento: com Q1 e Q2 ligados, <b>S1</b> → K1 (frente) e a verde VD ML acende; '
      + '<b>S2</b> → K2 (ré) e a verde VD 2R acende; <b>S0</b> desliga tudo e acende a VM MD (motor parado). '
      + 'O relé térmico só atua em sobrecarga, aí acende a AM SC.'}</div>`);
  }
  $('#modal-title').textContent = 'Verificação da montagem';
  $('#modal-body').innerHTML = rows.join('');
  $('#modal').classList.remove('hidden');
}

/* --------------------------------- auto-montar ---------------------------- */
function autoMount() {
  if (S.mode === 'manutencao') {
    coachShow('Modo manutenção', 'Aqui não tem montagem automática: o serviço é seu. Meça e conserte à mão.');
    return;
  }
  if (S.auto) return;
  if (S.etapa === 1) { PARTS.forEach(p => placePart(p.id)); }
  S.auto = true;
  const step = () => {
    const cur = currentMission();
    if (!cur) { S.auto = false; coachShow('Pronto!', 'Montagem automática concluída — teste com S1 e S2.'); return; }
    const m = cur.m;
    // para "RET:*" o robô escolhe um borne de retorno ainda livre (como no esquema,
    // em que cada retorno desce num ponto diferente da barra)
    const pick = pat => {
      if (!pat.endsWith(':*')) return pat;
      const id = pat.slice(0, -2), terms = PART_BY_ID[id].terms;
      const used = new Set();
      S.wires.forEach(w => { used.add(w.a); used.add(w.b); });
      const free = terms.find(t => !used.has(id + ':' + t.id));
      return id + ':' + (free || terms[0]).id;
    };
    S.sel = null; paintSel();
    makeWire(pick(m.a), pick(m.b));
    setTimeout(step, 260);
  };
  setTimeout(step, 120);
}

/* --------------------------------- reset ---------------------------------- */
function resetAll() {
  S.etapa = 1; S.placed = {}; S.wires = []; S.q1 = S.q2 = false;
  S.pressed = { S0: false, S1: false, S2: false };
  S.f1Tripped = false; S.driveFault = false; S.ref = 0.5;
  S.sel = null; S.score = 0; S.errors = 0;
  S.free = false; $('#btn-livre').classList.remove('on');
  S.mode = 'esquema'; S.defect = null; S._fixed = false; S._repairs = 0;
  METER.on = false; METER.a = METER.b = null; S._reading = null;
  $('#btn-meter').classList.remove('on');
  $('#meter').classList.add('hidden');
  wiresEl.classList.remove('cutting');
  S.done = new Set(); S.auto = false; S.shortFired = false;
  S.testDone = new Set(); S._stage3 = false;
  S._celebrated = false; S._certShown = false; S._k1 = S._k2 = undefined; S._coils = null;
  S.started = Date.now(); S.elapsed = 0; S.overload = 0;
  $('#parts').innerHTML = ''; $('#terms').innerHTML = ''; wiresEl.innerHTML = '';
  $('#st-log').innerHTML = ''; $('#tray').classList.remove('hidden');
  $('#board-wrap').classList.remove('tray-off');
  $('#modal').classList.add('hidden');
  $('#tray-count').textContent = `0 / ${PARTS.length}`;
  activateTab('tarefas');
  SFX.humOff();
  buildDock(); buildGhosts(); buildTray();
  renderMissions(); renderTests(); paintMeter(); refresh(); fitBoard();
  coachShow('Etapa 1 — Fixar componentes', 'Arraste cada componente da caixa para o contorno tracejado na placa.');
}

/* ============================================================================
   BANCADA — montada a partir da missão. Cada projeto declara em data.js os
   interruptores, botões, tipo de proteção (relé térmico ou falha do inversor),
   painel do drive e potenciômetro. Isso mantém o M1 e o M2 no mesmo código.
   ========================================================================== */
function buildDock() {
  const b = PROJECT.bench;
  const sw = b.switches.map(s => `<button id="ctl-${s.id}" class="key">${s.label} <b>OFF</b></button>`).join('');
  const btns = b.buttons.map(x =>
    `<button id="ctl-${x.id}" class="pbtn ${x.cls}" data-pbtn="${x.name}">${x.name}<b>${x.sub}</b></button>`).join('');
  const prot = b.protection === 'f1'
    ? '<button id="ctl-f1" class="key">F1 <b>REARMAR</b></button>'
    : '<button id="ctl-reset" class="key">RESET <b>F051</b></button>';
  const drive = b.drive ? `
    <div class="dock-group">
      <span class="dock-title">Painel do inversor</span>
      <div class="drv">
        <div class="drv-disp"><span id="drv-hz-2">000.0</span><small>Hz</small>
          <em id="drv-st-2" class="drv-st" data-k="off">OFF</em></div>
        <div class="drv-leds"><i id="di-di1">DI1</i><i id="di-di2">DI2</i><i id="di-di3">DI3</i><i id="di-di4">DI4</i></div>
      </div>
    </div>` : '';
  const pot = b.pot ? `
    <div class="dock-group">
      <span class="dock-title">Referência · RP1</span>
      <input id="ctl-pot" class="pot" type="range" min="0" max="100" value="${Math.round(S.ref * 100)}" aria-label="Potenciômetro de referência">
      <span id="drv-ref" class="ro-mini">${Math.round(S.ref * 100)} %</span>
    </div>` : '';
  $('#dock').innerHTML =
    `<div class="dock-group"><span class="dock-title">Alimentação</span>${sw}</div>` +
    `<div class="dock-group"><span class="dock-title">Comando</span>${btns}</div>` +
    `<div class="dock-group"><span class="dock-title">Proteção e carga</span>${prot}
       <select id="ctl-load" title="Carga do motor">
         <option value="sem">Sem carga</option>
         <option value="nominal" selected>Carga nominal</option>
         <option value="sobrecarga">Sobrecarga</option>
       </select></div>` + drive + pot +
    `<div class="dock-group readout-group"><span class="dock-title">Leitura</span>
       <div class="readout">
         <span id="ro-voltage" class="ro">—</span>
         <span id="ro-msg" class="ro msg">Ligue Q1 e Q2 para energizar o quadro.</span>
       </div></div>`;
  bindDock();
}

function bindDock() {
  const b = PROJECT.bench;
  b.switches.forEach(s => {
    const el = $('#ctl-' + s.id);
    if (!el) return;
    el.onclick = () => { S[s.id] = !S[s.id]; SFX.clack(); refresh(); };
  });
  $('#ctl-load').onchange = e => { S.load = e.target.value; S.overload = 0; };
  if (b.protection === 'f1') {
    $('#ctl-f1').onclick = () => {
      if (!S.f1Tripped) { logMsg('warn', 'O relé térmico não está atuado.'); return; }
      S.f1Tripped = false; SFX.clack(); logMsg('ok', 'Relé térmico rearmado (95-96 fechado).'); refresh();
    };
  } else {
    $('#ctl-reset').onclick = () => {
      const emFalha = S.driveFault || !!(S.res && S.res.dev && S.res.dev.fault);
      if (!emFalha) { logMsg('warn', 'O inversor não está em falha.'); return; }
      S.driveFault = false; S.overload = 0; S.load = 'nominal';
      const sel = $('#ctl-load'); if (sel) sel.value = 'nominal';
      SFX.clack();
      logMsg('ok', 'Falha do inversor rearmada. O RL1 volta ao repouso — um novo toque no S1 parte o motor.');
      refresh();
    };
  }
  b.buttons.forEach(x => {
    const el = $('#ctl-' + x.id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); pressButton(x.name, true); });
    el.addEventListener('pointerup', () => pressButton(x.name, false));
    el.addEventListener('pointerleave', () => pressButton(x.name, false));
  });
  const pot = $('#ctl-pot');
  if (pot) pot.oninput = e => { S.ref = (+e.target.value) / 100; refresh(); };
}

/** proteção que desliga o motor por sobrecarga: relé térmico ou falha F051 */
function tripProtection(reason) {
  if (PROJECT.bench.trip === 'drive') {
    if (S.driveFault) return;
    S.driveFault = true;
    SFX.clack();
    logMsg('err', 'F051 — sobrecorrente no inversor. O relé RL1 comuta, o NF abre e o contator K1 cai com o motor.');
    logMsg('warn', 'Reduza a carga e aperte RESET no painel do inversor para rearmar.');
    refresh();
    return;
  }
  tripF1(reason || 'sobrecarga do motor');
}

/* ------------------------------- controles -------------------------------- */
function bindUI() {

  // apertar os botões direto na placa (um toque = impulso momentâneo)
  document.addEventListener('click', e => {
    const p = e.target.closest('.part');
    if (!p || !p.dataset.part) return;
    const id = p.dataset.part;
    if (id !== 'S0' && id !== 'S1' && id !== 'S2') return;
    if (S.etapa < 2) return;
    pressButton(id, true);
    setTimeout(() => pressButton(id, false), 140);
  });

  $('#btn-esquema').onclick = showSchematic;
  $('#btn-verificar').onclick = verify;
  $('#btn-dica').onclick = () => {
    if (S.mode === 'manutencao' && S.defect) {
      coachShow(`Como investigar (${S.defect.os})`, S.defect.medir);
      return;
    }
    const cur = currentMission();
    coachShow('Dica', cur ? cur.m.hint + '  ➜  ' + missionLabel(cur.i) : 'Montagem completa!');
  };

  // cortar cabo clicando nele (modo livre / manutenção)
  wiresEl.addEventListener('click', e => {
    const p = e.target.closest('path.wire');
    if (!p || p.classList.contains('ghostwire')) return;
    cutWire(+p.dataset.wid);
  });

  // multímetro
  $('#btn-meter').onclick = () => setMeter(!METER.on);
  $('#meter-x').onclick = () => setMeter(false);

  // modo manutenção
  $('#btn-manut').onclick = () => {
    $('#modal-title').textContent = 'Modo manutenção — ordem de serviço';
    $('#modal-body').innerHTML = `<div class="cert">
        <p>O quadro é montado <b>completo e correto</b> e em seguida recebe <b>um defeito escondido</b>.
           A lista de missões some: você reproduz o sintoma na bancada, mede com o multímetro e
           conserta a fiação até ela voltar a bater com o esquema.</p>
        <p style="color:#9fb6c9;font-size:13px">No modo manutenção você pode <b>cortar cabos</b>
           clicando neles na placa e refazer a ligação nos bornes certos.</p>
        <button class="btn" id="def-random">Defeito aleatório</button>
        <div class="deflist">${DEFECTS.map(d =>
      `<button class="btn ghost def" data-def="${d.id}">${d.os} — ${d.titulo}</button>`).join('')}</div>
      </div>`;
    $('#modal').classList.remove('hidden');
    $('#def-random').onclick = () => { $('#modal').classList.add('hidden'); startMaintenance(null); };
    $$('#modal-body .def').forEach(b => b.onclick = () => {
      $('#modal').classList.add('hidden'); startMaintenance(b.dataset.def);
    });
  };
  $('#btn-livre').onclick = () => {
    S.free = !S.free;
    $('#btn-livre').classList.toggle('on', S.free);
    paintTargets();
    coachShow(S.free ? 'Modo livre ativado' : 'Modo esquema', S.free
      ? 'Qualquer borne pode ser ligado, inclusive fora do esquema. Cuidado: ligação errada entre fases provoca curto-circuito!'
      : 'Modo guiado: só a próxima ligação do esquema é aceita.');
    if (S.free && S.etapa === 3) logMsg('warn', 'Modo livre: você pode alterar a fiação montada.');
  };
  $('#btn-auto').onclick = autoMount;
  if ($('#btn-missoes')) $('#btn-missoes').onclick = showMissionSelect;
  if ($('#mselect-x')) $('#mselect-x').onclick = () => $('#mselect').classList.add('hidden');
  if ($('#mselect-free')) $('#mselect-free').onclick = () => $('#mselect').classList.add('hidden');
  $('#btn-reset').onclick = () => {
    if (confirm('Recomeçar a montagem do zero?')) resetAll();
  };
  $('#btn-pular').onclick = () => PARTS.forEach(p => placePart(p.id));
  $('#btn-panel').onclick = () => openSidebar(!$('#sidebar').classList.contains('open'));
  $('#coach-x').onclick = hideCoach;
  /* encostar na placa já fecha o aviso: ele nunca fica no caminho da montagem */
  $('#board-wrap').addEventListener('pointerdown', e => {
    if (!e.target.closest('#coach')) hideCoach();
  });
  $('#modal-x').onclick = () => $('#modal').classList.add('hidden');
  $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };

  $$('.tab').forEach(t => t.onclick = () => {
    activateTab(t.dataset.tab);
    if (window.innerWidth <= 1180) openSidebar(false);
  });

  $$('.zoombar button').forEach(b => b.onclick = () => {
    const v = +b.dataset.zoom;
    if (v === 0) fitBoard(); else zoomBy(v > 0 ? 1.2 : 1 / 1.2);
  });

  $('#obj-locate').onclick = () => {
    const cur = currentMission();
    if (!cur) return;
    const a = TERM_POS[cur.m.a] ? cur.m.a : cur.m.b;
    const b = TERM_POS[cur.m.b] ? cur.m.b : cur.m.a;
    focusTerminals(a, b);
    coachShow('Localizado no quadro', `${missionLabel(cur.i)} — clique no primeiro borne destacado.`);
  };
  setupBoardNav();

  // atalhos
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { S.sel = null; paintSel(); $('#modal').classList.add('hidden'); }
    if (e.repeat) return;
    if (e.key === '1') pressButton('S1', true);
    if (e.key === '2') pressButton('S2', true);
    if (e.key === '0') pressButton('S0', true);
  });
  document.addEventListener('keyup', e => {
    if (e.key === '1') pressButton('S1', false);
    if (e.key === '2') pressButton('S2', false);
    if (e.key === '0') pressButton('S0', false);
  });

  window.addEventListener('resize', fitBoard);
  if (window.ResizeObserver) new ResizeObserver(() => fitBoard()).observe($('#board-wrap'));
}

/* -------------------------------- loop ------------------------------------ */
function tick() {
  if (S._t0 === undefined) S._t0 = Date.now();
  const d = Date.now() - S._t0;
  if (d > 950) {
    S._t0 = Date.now();
    if (S.etapa === 2 && !S.short) S.elapsed += 1;
    const s = S.elapsed;
    $('#hud-time').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  const running = S.res && S.res.motor.state === 'girando' && !S.short;
  if (running && S.load === 'sobrecarga') {
    S.overload += 100;
    const seg = (S.overload / 1000).toFixed(1);
    if (S.overload % 1000 < 100) logMsg('warn', PROJECT.bench.trip === 'drive'
      ? `Corrente alta... proteção eletrônica do inversor contando (${seg}s)`
      : `Corrente alta... relé térmico aquecendo (${seg}s)`);
    if (S.overload > 3200) tripProtection('sobrecarga do motor');
  } else if (!running) S.overload = 0;
}

/* ============================================================================
   MISSÕES — seletor de serviço e troca de quadro
   ========================================================================== */
function buildMissionSelect() {
  $('#mselect-list').innerHTML = Object.values(PROJECTS).map(p => `
    <article class="mcard" data-proj="${p.id}">
      <span class="eyebrow">${p.missao} · nível ${p.nivel}</span>
      <h2>${p.nome}</h2>
      <p class="mlead">${p.titulo}</p>
      <p class="mres">${p.resumo}</p>
      <dl class="mspec">
        <div><dt>Aplicação</dt><dd>${p.aplicacao}</dd></div>
        <div><dt>Escopo</dt><dd>${p.parts.length} componentes · ${p.missions.length} ligações</dd></div>
        <div><dt>Duração</dt><dd>${p.duracao}</dd></div>
      </dl>
      <ul class="mentregas">${p.entregas.map(e => `<li>${e}</li>`).join('')}</ul>
      <div class="macts">
        <button class="btn primary" data-start="${p.id}">Iniciar montagem</button>
        <button class="btn ghost" data-manut="${p.id}">Ordem de serviço</button>
      </div>
    </article>`).join('');
  $$('#mselect-list [data-start]').forEach(b => b.onclick = () => startProject(b.dataset.start));
  $$('#mselect-list [data-manut]').forEach(b => b.onclick = () => startProject(b.dataset.manut, 'manutencao'));
}

function showMissionSelect() {
  buildMissionSelect();
  $('#mselect').classList.remove('hidden');
}

/** troca de missão: recarrega dados, simulação, roteador, placa e bancada */
function startProject(id, modo) {
  applyProject(id);            // data.js — peças, missões, testes, defeitos
  simInit();                   // sim.js — índices de bornes e fontes
  rebuildTermIndex();          // app.js — posição e direção dos bornes
  buildRouteMap();             // roteador — novo mapa de obstáculos
  S.projId = id;
  document.body.dataset.proj = id;
  $('#brand-title').textContent = PROJECT.nome;
  $('#brand-sub').textContent = PROJECT.titulo;
  $('#mselect').classList.add('hidden');
  resetAll();
  logMsg('ok', `${PROJECT.missao} — ${PROJECT.titulo}.`);
  if (modo === 'manutencao') startMaintenance(null);
}

/* --------------------------------- init ----------------------------------- */
function init() {
  // girar o eixo do motor / rotor do painel
  const st = document.createElement('style');
  st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(st);

  buildRouteMap();
  buildPaint();
  buildDock();          // bancada do projeto ativo (interruptores, botões, painel do drive)
  buildGhosts();
  buildTray();
  renderMissions();
  renderTests();
  bindUI();
  setupDrag();
  $('#tray-count').textContent = `0 / ${PARTS.length}`;
  refresh();
  fitBoard();
  coachShow('Etapa 1 — Fixar componentes', 'Arraste cada componente da caixa para o contorno tracejado na placa.');
  logMsg('ok', 'Bem-vindo! Monte o quadro seguindo o esquema elétrico. Abra "Esquema" para ver o diagrama.');
  setInterval(tick, 100);

  /* link direto para uma missão: index.html?m=inversor */
  const q = new URLSearchParams(location.search);
  const alvo = q.get('m');
  if (alvo && PROJECTS[alvo]) startProject(alvo);
  else if (!q.has('view')) showMissionSelect();

  // modo de inspeção: index.html?view=1 (tudo montado) | &z=1.2&tx=0&ty=0 (zoom num trecho)
  if (q.has('view')) {
    fitBoard = () => { };
    PARTS.forEach(p => placePart(p.id));
    const z = parseFloat(q.get('z') || '0');
    const tx = parseFloat(q.get('tx') || '0');
    const ty = parseFloat(q.get('ty') || '0');
    const apply = () => {
      if (!z) {
        const W = 1900, H = 1140;
        document.body.style.cssText = `width:${W}px;height:${H}px;transform-origin:top left;overflow:hidden;margin:0`;
        document.body.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`;
        boardEl.style.transform = 'scale(1)';
      } else {
        ['.topbar', '#dock', '#sidebar', '#coach', '#zoom'].forEach(s => { const e = $(s); if (e) e.style.display = 'none'; });
        boardEl.style.cssText = `position:absolute;left:0;top:0;transform-origin:top left;transform:scale(${z}) translate(${-tx}px,${-ty}px)`;
      }
    };
    apply(); window.addEventListener('resize', apply);
    if (q.has('wires')) autoMount();
  }
}

init();
