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

const TERM_POS = {};
const TERM_DIR = {};
PARTS.forEach(p => p.terms.forEach(t => {
  const k = p.id + ':' + t.id;
  TERM_POS[k] = { x: t.x, y: t.y };
  TERM_DIR[k] = t.dir;
}));

const PART_OF_TERM = {};
PARTS.forEach(p => p.terms.forEach(t => { PART_OF_TERM[p.id + ':' + t.id] = p.id; }));

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
  const rails = [
    { x: 278, y: 190, w: 168 }, { x: 1115, y: 160, w: 138 },
    { x: 160, y: 505, w: 610 }, { x: 706, y: 820, w: 300 },
  ];
  const zones = [
    { x: 30, y: 20, w: 1000, h: 1150, t: 'CIRCUITO DE POTÊNCIA' },
    { x: 1060, y: 20, w: 270, h: 580, t: 'COMANDO' },
    { x: 1060, y: 660, w: 620, h: 560, t: 'SINALIZAÇÃO' },
  ];
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

const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function wirePath(a, b, off) {
  const A = TERM_POS[a], B = TERM_POS[b];
  if (!A || !B) return '';
  const da = VEC[TERM_DIR[a] || 'down'], db = VEC[TERM_DIR[b] || 'down'];
  const st = 34;
  const p1 = { x: A.x + da[0] * st, y: A.y + da[1] * st };
  const q1 = { x: B.x + db[0] * st, y: B.y + db[1] * st };
  let pts;
  if (da[0] !== 0 && db[0] !== 0) {
    const mx = (p1.x + q1.x) / 2 + off;
    pts = [A, p1, { x: mx, y: p1.y }, { x: mx, y: q1.y }, q1, B];
  } else if (da[0] !== 0 || db[0] !== 0) {
    pts = [A, p1, { x: q1.x, y: p1.y }, q1, B];
  } else {
    const my = (p1.y + q1.y) / 2 + off;
    pts = [A, p1, { x: p1.x, y: my }, { x: q1.x, y: my }, q1, B];
  }
  return roundedPath(pts, 14);
}

function renderWires() {
  const res = S.res;
  const out = [];
  const count = {};
  const bump = k => { count[k] = (count[k] || 0) + 1; };
  // barra de neutro: todos os bornes são o MESMO ponto elétrico → desenha o trilho
  const bn = PART_BY_ID.BN;
  if (S.placed.BN) out.push(`<polyline class="busbar" points="${bn.terms.map(t => t.x + ',' + t.y).join(' ')}"/>`);
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

  let title, count, pct, sub, objStep, objCount, objText;
  if (manut) {
    const d = S.defect;
    title = 'Ordem de serviço'; count = S._fixed ? '1 / 1' : '0 / 1'; pct = S._fixed ? 100 : 0;
    sub = 'Diagnostique o defeito pelos sintomas e devolva a fiação ao esquema.';
    objStep = 'Manutenção'; objCount = d ? d.os : '';
    objText = d ? d.sintoma : '';
  } else if (S.etapa === 1) {
    const feitos = Object.keys(S.placed).length, total = PARTS.length;
    title = 'Etapa 1 — Fixar componentes'; count = `${feitos} / ${total}`; pct = feitos / total * 100;
    sub = 'Arraste cada peça da caixa de componentes para o contorno tracejado dela na placa.';
    objStep = 'Etapa 1'; objCount = `${feitos} / ${total}`;
    objText = feitos ? 'Continue fixando os componentes que faltam na placa.'
      : 'Arraste os componentes da caixa para os contornos tracejados da placa.';
  } else if (S.etapa === 2) {
    const cur = currentMission();
    title = 'Etapa 2 — Ligar os cabos'; count = `${S.done.size} / ${MISSIONS.length}`;
    pct = S.done.size / MISSIONS.length * 100;
    sub = 'Clique num borne e depois no outro para passar o cabo. A cor segue o potencial elétrico.';
    objStep = `Ligação ${Math.min(S.done.size + 1, MISSIONS.length)}`;
    objCount = SEC_LABEL[cur ? cur.m.sec : 'sig'];
    objText = cur ? `${missionLabel(cur.i)} — ${cur.m.hint}` : 'Montagem concluída!';
  } else {
    const cur = currentTest();
    title = 'Etapa 3 — Teste de funcionamento'; count = `${S.testDone.size} / ${TEST_STEPS.length}`;
    pct = S.testDone.size / TEST_STEPS.length * 100;
    sub = 'Repita a sequência do esquema: energizar, frente, parada, ré, sobrecarga e rearme.';
    objStep = 'Teste'; objCount = `${S.testDone.size} / ${TEST_STEPS.length}`;
    objText = cur ? `${cur.title}: ${cur.task}` : 'Sequência de funcionamento concluída.';
  }
  $('#pane-title').textContent = title;
  $('#pane-count').textContent = count;
  $('#pane-bar').style.width = pct + '%';
  $('#pane-sub').textContent = sub;
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
    if (m.sec !== lastSec) { lastSec = m.sec; list.push(`<div class="sec-head">${SEC_LABEL[m.sec]}</div>`); }
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

function coachShow(title, msg) {
  $('#coach-title').textContent = title;
  $('#coach-desc').textContent = msg;
  $('#coach').classList.remove('hidden');
}

/* ---------------- etapa 3 — teste de funcionamento (do esquema) ----------- */
/* Repete a sequela "Funcionamento" do esquema. Cada passo é conferido na
   bancada: S1 → K1 (frente) · S0 → parada · S2 → K2 (ré) · sobrecarga → F1. */
const TEST_STEPS = [
  {
    id: 'energ', title: 'Energizar o circuito de comando',
    task: 'Ligue Q1 e depois Q2 na bancada.',
    why: 'Com o Q2 fechado a fase L1 chega ao relé F1 e à barra das lâmpadas.',
    ok: res => S.q1 && S.q2 && !S.f1Tripped && res.lamps.H1,
  },
  {
    id: 'frente', title: 'Partida frente — S1',
    task: 'Aperte S1 (botão verde ou tecla 1).',
    why: 'K1 energiza pelo contato NF 11-12 do K2, o motor gira no sentido horário e a lâmpada verde acende.',
    ok: res => res.coils.K1 && !res.coils.K2 && res.motor.dir > 0 && res.lamps.H2,
  },
  {
    id: 'parada', title: 'Parada — S0',
    task: 'Aperte S0 (botão vermelho ou tecla 0).',
    why: 'O NF do S0 abre o circuito do comando: os contatores caem e o motor para (só a lâmpada de alimentação fica acesa).',
    ok: res => !res.coils.K1 && !res.coils.K2 && res.motor.state === 'parado',
  },
  {
    id: 're', title: 'Partida ré — S2',
    task: 'Aperte S2 (botão preto ou tecla 2).',
    why: 'Agora é o K2 que energiza: duas fases entram cruzadas, o motor gira ao contrário e a lâmpada amarela acende.',
    ok: res => res.coils.K2 && !res.coils.K1 && res.motor.dir < 0 && res.lamps.H3,
  },
  {
    id: 'sobrecarga', title: 'Proteção por sobrecarga — F1',
    task: 'Com o motor girando, selecione a carga “Sobrecarga ⚠” e espere o relé atuar.',
    why: 'O contato 95-96 abre (desliga os contatores) e o 97-98 fecha, acendendo a lâmpada vermelha de falha.',
    ok: res => S.f1Tripped && res.motor.state === 'parado' && res.lamps.H4,
  },
  {
    id: 'rearme', title: 'Rearme do relé térmico',
    task: 'Aperte REARMAR no F1 e volte a carga para “Carga nominal”.',
    why: 'Rearmado, o 95-96 fecha de novo, o 97-98 abre e a lâmpada de falha apaga — o quadro volta a funcionar.',
    ok: res => !S.f1Tripped && !res.lamps.H4,
  },
];

function currentTest() {
  return TEST_STEPS.find(s => !S.testDone.has(s.id)) || null;
}

function renderTests() {
  const cur = currentTest();
  $('#test-list').innerHTML = TEST_STEPS.map((s, i) => {
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
  if (!cur.ok(res)) return;
  S.testDone.add(cur.id);
  S.score += 15;
  SFX.ok(); flashScore();
  logMsg('ok', `✔ ${cur.title} — ${cur.why}`);
  renderTests();
  const nx = currentTest();
  if (nx) coachShow(`Teste ${S.testDone.size}/${TEST_STEPS.length}`, nx.task);
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

/** fiação de referência (a do esquema), com os neutros distribuídos na barra */
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

/** compara a fiação atual com a do esquema (aceita qualquer borne da barra de neutro) */
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
    coachShow('Já ligado', 'Já existe um cabo entre esses dois bornes.');
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
      coachShow('Ops!', `Não é essa ligação agora. ${cur ? 'A missão é: ' + missionLabel(cur.i) : ''}`);
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
  renderMissions(); paintTargets(); refresh();
  const cur = currentMission();
  if (cur) coachShow('Ligação ' + (S.done.size) + '/' + MISSIONS.length, cur.m.hint);
  else coachShow('Montagem concluída!', 'Ligue Q1 e Q2 e aperte S1 ou S2 para fazer o motor girar.');
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
  S._coils = { K1: res.coils.K1, K2: res.coils.K2 };

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
  ['K1', 'K2'].forEach(k => {
    const el = $(`.part[data-part="${k}"]`);
    el?.classList.toggle('energized', res.coils[k]);
  });
  ['H1', 'H2', 'H3', 'H4'].forEach(h => {
    const el = $(`.part[data-part="${h}"]`);
    if (!el) return;
    const on = res.lamps[h];
    el.classList.toggle('lamp-on', on);
    const c = { H1: '#f6f6e8', H2: '#39e07a', H3: '#ffd12e', H4: '#ff4d3d' }[h];
    el.style.setProperty('--glow', c);
  });
  const m = $('.part[data-part="M1"]');
  if (m) {
    let sp = m.querySelector('.shaft');
    if (!sp) {
      sp = document.createElement('div');
      sp.className = 'shaft';
      sp.style.cssText = 'position:absolute;right:-28px;top:74px;width:56px;height:56px;border-radius:50%;' +
        'border:5px dashed rgba(40,60,80,.55);opacity:0;transition:opacity .2s';
      m.appendChild(sp);
    }
    const on = res.motor.state === 'girando';
    sp.style.opacity = on ? '1' : '0';
    sp.style.animation = on ? `spin ${res.motor.dir > 0 ? 1 : 1}s linear infinite` : 'none';
    sp.style.animationDirection = res.motor.dir > 0 ? 'normal' : 'reverse';
    sp.style.borderColor = on ? (res.motor.dir > 0 ? 'rgba(46,204,113,.85)' : 'rgba(255,170,40,.9)') : 'transparent';
  }
}

/* --------------------------------- HUD ------------------------------------ */
function updateUI(res) {
  $('#hud-score').textContent = S.score;
  const manut = S.mode === 'manutencao';
  const prog = manut
    ? { n: S._fixed ? 1 : 0, t: 1 }
    : (S.etapa === 3
      ? { n: S.testDone.size, t: TEST_STEPS.length }
      : { n: S.done.size, t: MISSIONS.length });
  $('#hud-progress').textContent = `${prog.n} / ${prog.t}`;
  $('#hud-bar').style.width = (prog.n / prog.t * 100) + '%';
  $('#hud-label-prog').textContent = manut ? 'Reparo' : (S.etapa === 3 ? 'Testes' : 'Ligações');
  $('#hud-etapa').textContent = manut
    ? (S._fixed ? 'O.S. encerrada — reparo OK' : 'Manutenção — diagnosticar o defeito')
    : (S.etapa === 1 ? '1 / 3 — Fixar componentes'
      : S.etapa === 2 ? '2 / 3 — Ligar os cabos' : '3 / 3 — Teste de funcionamento');

  $('#st-motor').textContent = {
    'parado': 'Motor parado', 'girando': 'Motor girando', 'falta-fase': 'Não parte (falta fase)',
  }[res.motor.state];
  $('#st-rot').textContent = res.motor.state === 'girando'
    ? (res.motor.dir > 0 ? 'sentido horário (frente)' : 'sentido anti-horário (ré)') : '—';

  const k1 = $('#st-k1'), k2 = $('#st-k2');
  k1.textContent = res.coils.K1 ? 'energizado' : 'desligado';
  k1.className = 'pill ' + (res.coils.K1 ? 'on' : 'off');
  k2.textContent = res.coils.K2 ? 'energizado' : 'desligado';
  k2.className = 'pill ' + (res.coils.K2 ? 'on' : 'off');

  const f1 = $('#st-f1');
  f1.textContent = S.f1Tripped ? 'ATUADO (sobrecarga)' : 'normal';
  f1.className = 'pill ' + (S.f1Tripped ? 'err' : 'ok');

  const lampDef = [['H1', 'Alimentação', '#f6f6e8'], ['H2', 'Frente', '#39e07a'],
  ['H3', 'Ré', '#ffd12e'], ['H4', 'Falha', '#ff4d3d']];
  $('#st-lamps').innerHTML = lampDef.map(([id, nm, c]) =>
    `<div class="lamp ${res.lamps[id] ? 'on' : ''}" style="--c:${c}">
       <div class="bulb"></div>${nm}</div>`).join('');

  // motor sidebar
  const svg = $('#motor-svg');
  svg.classList.toggle('on', res.motor.state === 'girando');
  svg.classList.toggle('fault', res.motor.state === 'falta-fase' || res.short);
  $('#motor-txt').textContent = S.short ? 'CURTO'
    : (res.motor.state === 'girando' ? (res.motor.dir > 0 ? 'FWD' : 'REV')
      : (res.motor.state === 'falta-fase' ? 'FAULT' : 'OFF'));
  const rotor = $('#motor-rotor');
  rotor.style.transformOrigin = '60px 60px';
  rotor.style.animation = res.motor.state === 'girando'
    ? `spin ${res.motor.dir > 0 ? 1.1 : 1.1}s linear infinite` : 'none';
  rotor.style.animationDirection = res.motor.dir > 0 ? 'normal' : 'reverse';

  // bancada
  const ctrlLive = !S.f1Tripped && S.q2;
  $('#ro-voltage').innerHTML = `Tensão no comando: <b>${ctrlLive ? 'L1 presente ~220 V' : '0 V'}</b>`;
  const rv2 = $('#ro-voltage2'); if (rv2) rv2.textContent = ctrlLive ? '220 V' : '0 V';
  let msg = 'Ligue Q1 e Q2 para energizar o quadro.';
  if (S.short) msg = 'Curto-circuito detectado: rearme o disjuntor depois de corrigir a fiação.';
  else if (S.f1Tripped) msg = 'Relé térmico atuou. Aperte REARMAR no F1 e reduza a carga.';
  else if (res.motor.state === 'girando') msg = res.motor.dir > 0
    ? 'Motor girando no sentido horário (K1 / frente).' : 'Motor girando no sentido anti-horário (K2 / ré).';
  else if (res.motor.state === 'falta-fase') msg = 'O motor não parte: falta uma fase ou há fio trocado.';
  else if (S.q1 && S.q2) msg = 'Quadro energizado. Aperte S1 (frente) ou S2 (ré).';
  $('#ro-msg').textContent = msg;

  // botões da bancada
  $('#ctl-q1').classList.toggle('on', S.q1);
  $('#ctl-q1').querySelector('b').textContent = S.q1 ? 'LIGADO' : 'OFF';
  $('#ctl-q2').classList.toggle('on', S.q2);
  $('#ctl-q2').querySelector('b').textContent = S.q2 ? 'LIGADO' : 'OFF';

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
  let drag = null;

  const onDown = e => {
    const item = e.target.closest('[data-tray]');
    if (!item) return;
    e.preventDefault();
    const id = item.dataset.tray, p = PART_BY_ID[id];
    drag = { id, ghost: document.createElement('div') };
    drag.ghost.className = 'dragghost';
    drag.ghost.style.cssText = `position:fixed;width:${p.w}px;height:${p.h}px;pointer-events:none;z-index:500;
       transform:translate(-50%,-50%);opacity:.9;filter:drop-shadow(0 12px 18px rgba(0,0,0,.6))`;
    drag.ghost.innerHTML = p.img ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:contain">` : '';
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    document.body.appendChild(drag.ghost);
    item.style.opacity = '.4';
    const scale = parseFloat($('#zoom-val').textContent) / 100;
    drag.ghost.style.transform = `translate(-50%,-50%) scale(${scale})`;
  };

  const onMove = e => {
    if (!drag) return;
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    const sp = toStage(e.clientX, e.clientY);
    const p = PART_BY_ID[drag.id];
    const inZone = sp.x > p.x - 60 && sp.x < p.x + p.w + 60 && sp.y > p.y - 60 && sp.y < p.y + p.h + 60;
    $(`[data-ghost="${drag.id}"]`)?.classList.toggle('over', inZone);
  };

  const onUp = e => {
    if (!drag) return;
    const p = PART_BY_ID[drag.id];
    const sp = toStage(e.clientX, e.clientY);
    const inZone = sp.x > p.x - 60 && sp.x < p.x + p.w + 60 && sp.y > p.y - 60 && sp.y < p.y + p.h + 60;
    drag.ghost.remove();
    $(`[data-ghost="${drag.id}"]`)?.classList.remove('over');
    if (inZone) placePart(drag.id, true);
    else { const el = $(`[data-tray="${drag.id}"]`); if (el) el.style.opacity = ''; }
    drag = null;
  };

  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
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
function fitBoard() {
  const wrap = $('#board-wrap').getBoundingClientRect();
  const tray = $('#tray').classList.contains('hidden') ? 0 : $('#tray').offsetHeight;
  const z = Math.max(.05, Math.min((wrap.width - 34) / STAGE.w, (wrap.height - tray - 30) / STAGE.h));
  VIEW.z = z; VIEW.tx = 0; VIEW.ty = 0;
  applyView();
}
/** zoom em torno de um ponto (px relativo à área do quadro) */
function zoomBy(f, cx, cy) {
  const wrap = $('#board-wrap').getBoundingClientRect();
  const nx = clamp(VIEW.z * f, .08, 4);
  const dx = (cx === undefined ? wrap.width / 2 : cx) - wrap.width / 2 - VIEW.tx;
  const dy = (cy === undefined ? wrap.height / 2 : cy) - wrap.height / 2 - VIEW.ty;
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
  const wrap = $('#board-wrap').getBoundingClientRect();
  const tray = $('#tray').classList.contains('hidden') ? 0 : $('#tray').offsetHeight;
  const z = clamp(Math.min(wrap.width / (Math.abs(A.x - B.x) + 520),
    (wrap.height - tray) / (Math.abs(A.y - B.y) + 360)), .28, 1.35);
  VIEW.z = z;
  VIEW.tx = (STAGE.w / 2 - mx) * z;
  VIEW.ty = (STAGE.h / 2 - my) * z - tray * .18;
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
      <p>Você montou e operou o comando de motor trifásico com reversão
         <b>seguindo o esquema elétrico</b>: potência, comando e sinalização,
         mais a sequência de funcionamento (frente, parada, ré, sobrecarga e rearme).</p>
      <div class="big">${S.score} pts</div>
      <p>Tempo: <b>${t}</b> · Ligações: <b>${S.wires.length}</b> · Tentativas erradas: <b>${S.errors}</b></p>
      <p style="color:#9fb6c9;font-size:13px">Desafios extras: monte sem o intertravamento (11-12 cruzados) e veja
         o curto-circuito; troque duas fases na saída do Q2 para o K2 e confira a rotação invertida.</p>
      <button class="btn" onclick="window.print()">🖨 Imprimir</button>
    </div>`;
  $('#modal').classList.remove('hidden');
  SFX.ok();
}

/* --------------------------------- modais --------------------------------- */
function showSchematic() {
  $('#modal-title').textContent = 'Esquema elétrico de referência';
  $('#modal-body').innerHTML = `
    <p style="color:#9fb6c9;font-size:13px;margin-top:0">
      Comando de motor trifásico com reversão de rotação (Frente/Ré) — proteção por relé térmico e sinalização luminosa.
      Use estas imagens como referência para todas as ligações.</p>
    <img class="schem" src="assets/esquema-1.jpg" alt="Esquema elétrico">
    <div class="legend">
      ${[['Q1', 'Chave seccionadora / disjuntor da potência (3 polos)'],
      ['Q2', 'Disjuntor do circuito de comando (1 ou 2 polos)'],
      ['K1', 'Contator de sentido frente'],
      ['K2', 'Contator de sentido ré'],
      ['F1', 'Relé térmico — proteção contra sobrecarga'],
      ['M3', 'Motor trifásico'],
      ['S0', 'Botão de parada (NF)'], ['S1', 'Botão de partida frente (NA)'],
      ['S2', 'Botão de partida ré (NA)'],
      ['13-14', 'Contato auxiliar NA (auto-retenção)'],
      ['11-12', 'Contato auxiliar NF (intertravamento)'],
      ['95-96', 'Contato NF do relé térmico'], ['97-98', 'Contato NA do relé térmico'],
      ['A1/A2', 'Bobina do contator'],
      ['H1…H4', 'Lâmpadas de sinalização (alimentação / frente / ré / falha)']]
      .map(([a, b]) => `<div><b>${a}</b> — ${b}</div>`).join('')}
    </div>
    <img class="schem" style="margin-top:14px" src="assets/esquema-2.jpg" alt="Poster do esquema">`;
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
        <b>S2</b> gira para trás e <b>S0</b> para o motor. Sobrecarga atua no F1 e acende a lâmpada de falha.</div>`;
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
    rows.push(`<div class="check">Teste de funcionamento: com Q1 e Q2 ligados, <b>S1</b> → K1 (frente) e H2 acende;
      <b>S2</b> → K2 (ré) e H3 acende; <b>S0</b> desliga tudo. O relé térmico só atua em sobrecarga.</div>`);
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
    // para "BN:*" o robô escolhe um borne de neutro ainda livre (como no esquema,
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
  S.f1Tripped = false; S.sel = null; S.score = 0; S.errors = 0;
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
  buildGhosts(); buildTray(); renderMissions(); renderTests(); paintMeter(); refresh(); fitBoard();
  coachShow('Etapa 1 — Fixar componentes', 'Arraste cada componente da caixa para o contorno tracejado na placa.');
}

/* ------------------------------- controles -------------------------------- */
function bindUI() {
  $('#ctl-q1').onclick = () => { S.q1 = !S.q1; SFX.clack(); refresh(); };
  $('#ctl-q2').onclick = () => { S.q2 = !S.q2; SFX.clack(); refresh(); };
  $('#ctl-f1').onclick = () => {
    if (!S.f1Tripped) { logMsg('warn', 'O relé térmico não está atuado.'); return; }
    S.f1Tripped = false; SFX.clack(); logMsg('ok', 'Relé térmico rearmado (95-96 fechado).'); refresh();
  };
  $('#ctl-load').onchange = e => { S.load = e.target.value; S.overload = 0; };

  [['S0', '#ctl-s0'], ['S1', '#ctl-s1'], ['S2', '#ctl-s2']].forEach(([n, sel]) => {
    const el = $(sel);
    el.addEventListener('pointerdown', e => { e.preventDefault(); pressButton(n, true); });
    el.addEventListener('pointerup', () => pressButton(n, false));
    el.addEventListener('pointerleave', () => pressButton(n, false));
  });

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
  $('#btn-reset').onclick = () => {
    if (confirm('Recomeçar a montagem do zero?')) resetAll();
  };
  $('#btn-pular').onclick = () => PARTS.forEach(p => placePart(p.id));
  $('#btn-panel').onclick = () => openSidebar(!$('#sidebar').classList.contains('open'));
  $('#coach-x').onclick = () => $('#coach').classList.add('hidden');
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
    if (S.overload % 1000 < 100) logMsg('warn', `Corrente alta... relé térmico aquecendo (${(S.overload / 1000).toFixed(1)}s)`);
    if (S.overload > 3200) tripF1('sobrecarga do motor');
  } else if (!running) S.overload = 0;
}

/* --------------------------------- init ----------------------------------- */
function init() {
  // girar o eixo do motor / rotor do painel
  const st = document.createElement('style');
  st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(st);

  buildPaint();
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

  // modo de inspeção: index.html?view=1 (tudo montado) | &z=1.2&tx=0&ty=0 (zoom num trecho)
  const q = new URLSearchParams(location.search);
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
