/* ============================================================================
   data.js — MISSÕES (quadros reais) do jogo.

   Cada missão é um PROJETO de quadro completo: componentes com os bornes nas
   coordenadas da placa, os dispositivos internos (contatos, bobinas, fonte de
   24 V, relé de saída), as ligações que reproduzem o esquema, os testes de
   funcionamento e os defeitos do modo manutenção.

   M1 — REVERSÃO DE ROTAÇÃO (esquema de referência enviado):
        comando de motor trifásico com frente/ré, relé térmico e sinalização.
        A rede entra só com L1/L2/L3; o Q2 é bipolar — polo 1 devolve o comando
        pela barra de retorno (L1) e o polo 2 leva a fase (L2) ao comando e às
        lâmpadas; na ré as fases trocam na SAÍDA do K2. Comando em 380 V.

   M2 — QUADRO COM INVERSOR CFW 500:
        Q1 protege o ramal do inversor, K1 é o contator de linha (comando em
        380 V, com o contato NF do relé do inversor em série: falha = contator
        cai), o drive alimenta o motor em U/V/W e o comando do drive é em 24 V
        (fonte interna): DI1 = partida (3 fios), DI2 = parada, DI3 = habilitação
        geral (contato auxiliar do K1), DI4 = sentido; a referência de
        velocidade vem do potenciômetro RP1 no AI1.
   ========================================================================== */

const STAGE = { w: 1700, h: 1290 };

/* ---------------------------- helpers de fiação --------------------------- */
/* qualquer borne da barra de retorno vale: normaliza RET:R3 → RET:* */
const canonKey = k => k.replace(/^RET:R\d+$/, 'RET:*');
const wireKey = (a, b) => [canonKey(a), canonKey(b)].sort().join('~');
const rmWire = (list, a, b) => list.filter(w => wireKey(w.a, w.b) !== wireKey(a, b));
const addWire = (list, a, b) => list.concat([{ a, b, ok: false, mission: null, id: 900 + list.length }]);

/* ============================================================================
   MISSÃO 01 — QUADRO DE REVERSÃO DE ROTAÇÃO
   ========================================================================== */
const M1_REVERSAO = {
  id: 'reversao',
  missao: 'Missão 01',
  nome: 'Comando de reversão',
  titulo: 'Quadro de comando de motor trifásico com reversão',
  resumo: 'Frente / ré com intertravamento elétrico, relé térmico e sinalização luminosa em 380 V.',
  aplicacao: 'Ponte rolante, esteira reversível, transportador de carga, portão basculante, talha.',
  nivel: 'Intermediário',
  duracao: '~45 min',
  entregas: [
    'Cadeia de potência com seccionadora Q1, contatores K1/K2 e relé térmico F1',
    'Circuito de comando com auto-retenção 13-14 e intertravamento NF 11-12 cruzado',
    'Sinalização: falha (AM SC), motor parado (VM MD) e as duas marchas (VD ML / VD 2R)',
    'Sequência de funcionamento conferida na bancada (frente, parada, ré, sobrecarga e rearme)',
  ],
  materiais: [
    'Q1 — seccionadora tripolar', 'Q2 — disjuntor bipolar do comando',
    'K1 / K2 — contatores com 4 blocos auxiliares',
    'F1 — relé térmico 95-96 / 97-98', 'S0 NF · S1 e S2 NA — botões 22 mm',
    'H1…H4 — lâmpadas de sinalização', 'M1 — motor trifásico, 6 pontas',
  ],
  bench: {
    switches: [{ id: 'q1', label: 'Q1' }, { id: 'q2', label: 'Q2' }],
    buttons: [
      { id: 's1', name: 'S1', sub: 'FRENTE', cls: 'green', key: '1' },
      { id: 's2', name: 'S2', sub: 'RÉ', cls: 'dark', key: '2' },
      { id: 's0', name: 'S0', sub: 'PARADA', cls: 'red', key: '0' },
    ],
    protection: 'f1', drive: false, pot: false, load: true, trip: 'f1',
  },
  schematic: { imgs: ['assets/esquema-1.jpg', 'assets/esquema-2.jpg'] },
  paint: {
    rails: [{ x: 278, y: 190, w: 168 }, { x: 1115, y: 160, w: 138 },
    { x: 160, y: 505, w: 610 }, { x: 706, y: 820, w: 300 }],
    zones: [
      { x: 30, y: 20, w: 1000, h: 1150, t: 'CIRCUITO DE POTÊNCIA' },
      { x: 1060, y: 20, w: 270, h: 580, t: 'COMANDO' },
      { x: 1060, y: 660, w: 620, h: 560, t: 'SINALIZAÇÃO' },
    ],
  },

  parts: [
    {
      id: 'ENT', name: 'Borneira de entrada', note: 'L1 · L2 · L3', sub: 'rede',
      kind: 'strip', x: 40, y: 60, w: 150, h: 300,
      terms: [
        { id: 'L1', x: 190, y: 110, dir: 'right', label: 'L1' },
        { id: 'L2', x: 190, y: 180, dir: 'right', label: 'L2' },
        { id: 'L3', x: 190, y: 250, dir: 'right', label: 'L3' },
      ],
    },
    {
      id: 'Q1', name: 'Q1 — Chave seccionadora 3 polos', sub: '3 polos', img: 'assets/disjuntor-3p.png',
      /* a caixa encosta nos bornes: entrada em cima (y=94) e saída em baixo
         (y=310) — assim o cabo sai do componente sem atravessar o desenho */
      x: 290, y: 100, w: 140, h: 216,
      terms: [
        { id: '1', x: 318, y: 94, dir: 'up', label: '1' },
        { id: '3', x: 360, y: 94, dir: 'up', label: '3' },
        { id: '5', x: 402, y: 94, dir: 'up', label: '5' },
        { id: '2', x: 318, y: 310, dir: 'down', label: '2' },
        { id: '4', x: 360, y: 310, dir: 'down', label: '4' },
        { id: '6', x: 402, y: 310, dir: 'down', label: '6' },
      ],
    },
    {
      id: 'K1', name: 'K1 — Contator (frente)', sub: 'frente', img: 'assets/contator.png',
      x: 170, y: 400, w: 180, h: 218,
      terms: [
        { id: '1', x: 215, y: 394, dir: 'up', label: '1' },
        { id: '3', x: 260, y: 394, dir: 'up', label: '3' },
        { id: '5', x: 305, y: 394, dir: 'up', label: '5' },
        { id: '2', x: 215, y: 612, dir: 'down', label: '2' },
        { id: '4', x: 260, y: 612, dir: 'down', label: '4' },
        { id: '6', x: 305, y: 612, dir: 'down', label: '6' },
        { id: 'A1', x: 200, y: 686, dir: 'down', label: 'A1', small: true },
        { id: 'A2', x: 320, y: 686, dir: 'down', label: 'A2', small: true },
        /* 13-14 = NA da auto-retenção · 11-12 = NF do intertravamento
           21-22 = NF da sinalização (motor parado) · 23-24 = NA da sinalização */
        { id: '13', x: 424, y: 430, dir: 'right', label: '13', small: true },
        { id: '14', x: 424, y: 462, dir: 'right', label: '14', small: true },
        { id: '11', x: 424, y: 494, dir: 'right', label: '11', small: true },
        { id: '12', x: 424, y: 526, dir: 'right', label: '12', small: true },
        { id: '21', x: 424, y: 558, dir: 'right', label: '21', small: true },
        { id: '22', x: 424, y: 590, dir: 'right', label: '22', small: true },
        { id: '23', x: 424, y: 622, dir: 'right', label: '23', small: true },
        { id: '24', x: 424, y: 654, dir: 'right', label: '24', small: true },
        /* 4º polo do contator (7-8): existe no desenho, mas não é usado */
        { id: '7', x: 350, y: 430, dir: 'right', label: '7', small: true },
        { id: '8', x: 350, y: 585, dir: 'right', label: '8', small: true },
      ],
    },
    { id: 'K1x', name: 'Bloco auxiliar K1', kind: 'aux', x: 380, y: 415, w: 80, h: 260, terms: [] },
    {
      id: 'K2', name: 'K2 — Contator (ré)', sub: 'ré', img: 'assets/contator.png',
      x: 520, y: 400, w: 180, h: 218,
      terms: [
        { id: '1', x: 565, y: 394, dir: 'up', label: '1' },
        { id: '3', x: 610, y: 394, dir: 'up', label: '3' },
        { id: '5', x: 655, y: 394, dir: 'up', label: '5' },
        { id: '2', x: 565, y: 612, dir: 'down', label: '2' },
        { id: '4', x: 610, y: 612, dir: 'down', label: '4' },
        { id: '6', x: 655, y: 612, dir: 'down', label: '6' },
        { id: 'A1', x: 550, y: 686, dir: 'down', label: 'A1', small: true },
        { id: 'A2', x: 670, y: 686, dir: 'down', label: 'A2', small: true },
        { id: '13', x: 774, y: 430, dir: 'right', label: '13', small: true },
        { id: '14', x: 774, y: 462, dir: 'right', label: '14', small: true },
        { id: '11', x: 774, y: 494, dir: 'right', label: '11', small: true },
        { id: '12', x: 774, y: 526, dir: 'right', label: '12', small: true },
        { id: '21', x: 774, y: 558, dir: 'right', label: '21', small: true },
        { id: '22', x: 774, y: 590, dir: 'right', label: '22', small: true },
        { id: '23', x: 774, y: 622, dir: 'right', label: '23', small: true },
        { id: '24', x: 774, y: 654, dir: 'right', label: '24', small: true },
        { id: '7', x: 700, y: 430, dir: 'right', label: '7', small: true },
        { id: '8', x: 700, y: 585, dir: 'right', label: '8', small: true },
      ],
    },
    { id: 'K2x', name: 'Bloco auxiliar K2', kind: 'aux', x: 730, y: 415, w: 80, h: 260, terms: [] },
    {
      id: 'F1', name: 'F1 — Relé térmico 95-96 / 97-98', sub: '95-98', img: 'assets/rele-termico.png',
      x: 150, y: 760, w: 180, h: 206,
      terms: [
        { id: '1', x: 198, y: 754, dir: 'up', label: '1' },
        { id: '3', x: 235, y: 754, dir: 'up', label: '3' },
        { id: '5', x: 272, y: 754, dir: 'up', label: '5' },
        { id: '2', x: 198, y: 960, dir: 'down', label: '2' },
        { id: '4', x: 235, y: 960, dir: 'down', label: '4' },
        { id: '6', x: 272, y: 960, dir: 'down', label: '6' },
        { id: '95', x: 385, y: 782, dir: 'right', label: '95', small: true },
        { id: '96', x: 385, y: 822, dir: 'right', label: '96', small: true },
        { id: '97', x: 385, y: 866, dir: 'right', label: '97', small: true },
        { id: '98', x: 385, y: 906, dir: 'right', label: '98', small: true },
      ],
    },
    { id: 'F1x', name: 'Auxiliares do relé térmico', kind: 'aux', x: 340, y: 760, w: 85, h: 160, terms: [] },
    {
      id: 'M1', name: 'M1 — Motor trifásico (M3~)', sub: 'M3 ~', img: 'assets/motor.png',
      x: 105, y: 1020, w: 270, h: 193,
      terms: [
        { id: 'U', x: 150, y: 1012, dir: 'up', label: 'U' },
        { id: 'V', x: 213, y: 1012, dir: 'up', label: 'V' },
        { id: 'W', x: 276, y: 1012, dir: 'up', label: 'W' },
      ],
    },
    {
      id: 'Q2', name: 'Q2 — Disjuntor do comando (2 polos)', sub: 'comando', img: 'assets/disjuntor-2p.png',
      x: 700, y: 200, w: 105, h: 162,
      terms: [
        { id: '1', x: 725, y: 194, dir: 'up', label: '1' },
        { id: '3', x: 780, y: 194, dir: 'up', label: '3' },
        { id: '2', x: 725, y: 356, dir: 'down', label: '2' },
        { id: '4', x: 780, y: 356, dir: 'down', label: '4' },
      ],
    },
    {
      id: 'S0', name: 'S0 — Botão de parada (NF)', sub: 'NF parada', img: 'assets/botao-s0.png',
      x: 880, y: 440, w: 120, h: 130, button: 'S0',
      terms: [
        { id: '11', x: 908, y: 580, dir: 'down', label: '11' },
        { id: '12', x: 948, y: 580, dir: 'down', label: '12' },
      ],
    },
    {
      id: 'S1', name: 'S1 — Botão frente (NA)', sub: 'NA frente', img: 'assets/botao-s1.png',
      x: 760, y: 700, w: 120, h: 130, button: 'S1',
      terms: [
        { id: '13', x: 788, y: 840, dir: 'down', label: '13' },
        { id: '14', x: 828, y: 840, dir: 'down', label: '14' },
      ],
    },
    {
      id: 'S2', name: 'S2 — Botão ré (NA)', sub: 'NA ré', img: 'assets/botao-s2.png',
      x: 1000, y: 700, w: 120, h: 130, button: 'S2',
      terms: [
        { id: '13', x: 1028, y: 840, dir: 'down', label: '13' },
        { id: '14', x: 1068, y: 840, dir: 'down', label: '14' },
      ],
    },
    {
      id: 'H1', name: 'H1 — Lâmpada AM SC (amarela)', sub: 'falha', img: 'assets/lampada-amarela.png',
      x: 1240, y: 690, w: 110, h: 140, lamp: 'H1',
      terms: [
        { id: 'X1', x: 1265, y: 840, dir: 'down', label: 'X1', small: true },
        { id: 'X2', x: 1305, y: 840, dir: 'down', label: 'X2', small: true },
      ],
    },
    {
      id: 'H2', name: 'H2 — Lâmpada VM MD (vermelha)', sub: 'motor parado', img: 'assets/lampada-vermelha.png',
      x: 1350, y: 690, w: 110, h: 140, lamp: 'H2',
      terms: [
        { id: 'X1', x: 1375, y: 840, dir: 'down', label: 'X1', small: true },
        { id: 'X2', x: 1415, y: 840, dir: 'down', label: 'X2', small: true },
      ],
    },
    {
      id: 'H3', name: 'H3 — Lâmpada VD ML (verde)', sub: 'marcha frente', img: 'assets/lampada-verde.png',
      x: 1460, y: 690, w: 110, h: 140, lamp: 'H3',
      terms: [
        { id: 'X1', x: 1485, y: 840, dir: 'down', label: 'X1', small: true },
        { id: 'X2', x: 1525, y: 840, dir: 'down', label: 'X2', small: true },
      ],
    },
    {
      id: 'H4', name: 'H4 — Lâmpada VD 2R (verde)', sub: 'marcha ré', img: 'assets/lampada-verde.png',
      x: 1570, y: 690, w: 110, h: 140, lamp: 'H4',
      terms: [
        { id: 'X1', x: 1595, y: 840, dir: 'down', label: 'X1', small: true },
        { id: 'X2', x: 1635, y: 840, dir: 'down', label: 'X2', small: true },
      ],
    },
    {
      id: 'RET', name: 'Barra de retorno do comando', sub: 'retorno (Q2 polo 1)', kind: 'bus',
      x: 660, y: 1200, w: 1000, h: 62,
      terms: [700, 820, 940, 1060, 1180, 1300, 1420, 1540, 1660].map((x, i) => ({
        id: 'R' + (i + 1), x: x, y: 1228, dir: 'up', label: String(i + 1), small: true,
      })),
    },
  ],

  /* fontes de potencial: cada uma liga um nó da rede a um potencial */
  sources: { L1: ['ENT:L1'], L2: ['ENT:L2'], L3: ['ENT:L3'] },

  internal: {
    /* contatos de potência do relé térmico: conduzem sempre (só abrem se disparar) */
    statics: [['F1:1', 'F1:2'], ['F1:3', 'F1:4'], ['F1:5', 'F1:6']],
    /* barra de retorno: todos os bornes são o MESMO ponto elétrico */
    buses: [['RET:R1', 'RET:R2', 'RET:R3', 'RET:R4', 'RET:R5', 'RET:R6', 'RET:R7', 'RET:R8', 'RET:R9']],
  },

  /* contatos internos que dependem do estado da bancada ou das bobinas */
  rules: [
    { when: s => s.q1, close: [['Q1:1', 'Q1:2'], ['Q1:3', 'Q1:4'], ['Q1:5', 'Q1:6']] },
    { when: s => s.q2, close: [['Q2:1', 'Q2:2'], ['Q2:3', 'Q2:4']] },
    {
      when: c => c.coils.K1,
      close: [['K1:1', 'K1:2'], ['K1:3', 'K1:4'], ['K1:5', 'K1:6'], ['K1:13', 'K1:14'], ['K1:23', 'K1:24']],
    },
    { when: c => !c.coils.K1, close: [['K1:11', 'K1:12'], ['K1:21', 'K1:22']] },
    {
      when: c => c.coils.K2,
      close: [['K2:1', 'K2:2'], ['K2:3', 'K2:4'], ['K2:5', 'K2:6'], ['K2:13', 'K2:14'], ['K2:23', 'K2:24']],
    },
    { when: c => !c.coils.K2, close: [['K2:11', 'K2:12'], ['K2:21', 'K2:22']] },
    { when: s => !s.pressed.S0, close: [['S0:11', 'S0:12']] },
    { when: s => !!s.pressed.S1, close: [['S1:13', 'S1:14']] },
    { when: s => !!s.pressed.S2, close: [['S2:13', 'S2:14']] },
    { when: s => s.f1Tripped, close: [['F1:97', 'F1:98']] },
    { when: s => !s.f1Tripped, close: [['F1:95', 'F1:96']] },
  ],

  coils: [{ id: 'K1', a: 'K1:A1', b: 'K1:A2' }, { id: 'K2', a: 'K2:A1', b: 'K2:A2' }],

  lamps: [
    { id: 'H1', a: 'H1:X1', b: 'H1:X2', tag: 'AM SC', name: 'falha (relé térmico)', c: '#ffc285' },
    { id: 'H2', a: 'H2:X1', b: 'H2:X2', tag: 'VM MD', name: 'motor parado', c: '#ff7a6a' },
    { id: 'H3', a: 'H3:X1', b: 'H3:X2', tag: 'VD ML', name: 'marcha frente', c: '#6ff0ae' },
    { id: 'H4', a: 'H4:X1', b: 'H4:X2', tag: 'VD 2R', name: 'marcha ré', c: '#6ff0ae' },
  ],

  motor: { u: 'M1:U', v: 'M1:V', w: 'M1:W', nome: 'M1 — motor trifásico (M3~)' },

  sections: { pot: 'Circuito de potência', com: 'Circuito de comando', sig: 'Sinalização' },

  missions: [
    /* ---------- CIRCUITO DE POTÊNCIA ---------- */
    { sec: 'pot', a: 'ENT:L1', b: 'Q1:1', hint: 'Fase L1 na entrada do disjuntor geral Q1 (terminal 1).' },
    { sec: 'pot', a: 'ENT:L2', b: 'Q1:3', hint: 'Fase L2 no terminal 3 do Q1.' },
    { sec: 'pot', a: 'ENT:L3', b: 'Q1:5', hint: 'Fase L3 no terminal 5 do Q1.' },
    { sec: 'pot', a: 'Q1:2', b: 'K1:1', hint: 'Saída 2 do Q1 vai na entrada 1 do contator K1 (frente).' },
    { sec: 'pot', a: 'Q1:4', b: 'K1:3', hint: 'Saída 4 do Q1 na entrada 3 do K1.' },
    { sec: 'pot', a: 'Q1:6', b: 'K1:5', hint: 'Saída 6 do Q1 na entrada 5 do K1.' },
    { sec: 'pot', a: 'Q1:2', b: 'K2:1', hint: 'As entradas do K2 são ligadas direto nas saídas do Q1: 2 → 1.' },
    { sec: 'pot', a: 'Q1:4', b: 'K2:3', hint: 'Saída 4 do Q1 na entrada 3 do K2 (fase central não troca).' },
    { sec: 'pot', a: 'Q1:6', b: 'K2:5', hint: 'Saída 6 do Q1 na entrada 5 do K2.' },
    { sec: 'pot', a: 'K1:2', b: 'F1:1', hint: 'Saída 2 do K1 na entrada 1 do relé térmico F1.' },
    { sec: 'pot', a: 'K1:4', b: 'F1:3', hint: 'Saída 4 do K1 na entrada 3 do F1.' },
    { sec: 'pot', a: 'K1:6', b: 'F1:5', hint: 'Saída 6 do K1 na entrada 5 do F1.' },
    { sec: 'pot', a: 'K2:2', b: 'F1:5', hint: 'Saída 2 do K2 vai no terminal 5 do F1 — é uma das fases trocadas.' },
    { sec: 'pot', a: 'K2:4', b: 'F1:3', hint: 'Saída 4 do K2 no terminal 3 do F1.' },
    { sec: 'pot', a: 'K2:6', b: 'F1:1', hint: 'Saída 6 do K2 no terminal 1 do F1 — a outra fase trocada. É esse cruzamento que faz o motor girar ao contrário.' },
    { sec: 'pot', a: 'F1:2', b: 'M1:U', hint: 'Saída 2 do F1 no borne U do motor.' },
    { sec: 'pot', a: 'F1:4', b: 'M1:V', hint: 'Saída 4 do F1 no borne V do motor.' },
    { sec: 'pot', a: 'F1:6', b: 'M1:W', hint: 'Saída 6 do F1 no borne W do motor.' },

    /* ---------- CIRCUITO DE COMANDO ---------- */
    { sec: 'com', a: 'ENT:L1', b: 'Q2:1', hint: 'Fase L1 na entrada do polo 1 do Q2 (é ele que faz o retorno do comando).' },
    { sec: 'com', a: 'ENT:L2', b: 'Q2:3', hint: 'Fase L2 na entrada do polo 2 do Q2 (fase do comando e das lâmpadas).' },
    { sec: 'com', a: 'Q2:2', b: 'RET:*', hint: 'Saída 2 do Q2 na barra de retorno — é por ela que as bobinas e as lâmpadas fecham o circuito.' },
    { sec: 'com', a: 'Q2:4', b: 'F1:95', hint: 'Saída 4 do Q2 no contato NF 95 do relé térmico (começo do comando).' },
    { sec: 'com', a: 'F1:96', b: 'S0:11', hint: 'Saída 96 do relé térmico no terminal 11 do botão de parada S0.' },
    { sec: 'com', a: 'S0:12', b: 'S1:13', hint: 'Do S0 (12) para o botão frente S1 (13).' },
    { sec: 'com', a: 'S0:12', b: 'S2:13', hint: 'Do S0 (12) para o botão ré S2 (13).' },
    { sec: 'com', a: 'S1:14', b: 'K2:11', hint: 'Saída do S1 passa pelo contato NF 11-12 do K2 — é o intertravamento.' },
    { sec: 'com', a: 'K2:12', b: 'K1:A1', hint: 'Depois do intertravamento, fecha o circuito na bobina A1 do K1.' },
    { sec: 'com', a: 'S0:12', b: 'K1:13', hint: 'Retenção: o contato 13-14 do K1 fica em paralelo com o botão S1.' },
    { sec: 'com', a: 'K2:11', b: 'K1:14', hint: 'Outro lado da retenção do K1 (paralelo com S1).' },
    { sec: 'com', a: 'S2:14', b: 'K1:11', hint: 'Saída do S2 passa pelo contato NF 11-12 do K1 (intertravamento).' },
    { sec: 'com', a: 'K1:12', b: 'K2:A1', hint: 'Depois do intertravamento, fecha na bobina A1 do K2.' },
    { sec: 'com', a: 'S0:12', b: 'K2:13', hint: 'Retenção: contato 13-14 do K2 em paralelo com o botão S2.' },
    { sec: 'com', a: 'K1:11', b: 'K2:14', hint: 'Outro lado da retenção do K2.' },
    { sec: 'com', a: 'K1:A2', b: 'RET:*', hint: 'Retorno da bobina K1 para a barra de retorno (A2 → barra).' },
    { sec: 'com', a: 'K2:A2', b: 'RET:*', hint: 'Retorno da bobina K2 para a barra de retorno (A2 → barra).' },

    /* ---------- SINALIZAÇÃO ---------- */
    { sec: 'sig', a: 'Q2:4', b: 'F1:97', hint: 'A fase da sinalização vai no contato NA 97-98 do relé térmico (lâmpada de falha).' },
    { sec: 'sig', a: 'F1:98', b: 'H1:X1', hint: 'Do contato 98 do F1 para a lâmpada AM SC — ela acende quando o relé atua.' },
    { sec: 'sig', a: 'H1:X2', b: 'RET:*', hint: 'Retorno da lâmpada H1 para a barra.' },
    { sec: 'sig', a: 'Q2:4', b: 'K1:21', hint: 'Fase no contato NF 21-22 do K1 (lâmpada que fica acesa com tudo parado).' },
    { sec: 'sig', a: 'K1:22', b: 'K2:21', hint: 'O NF do K1 passa pelo NF do K2: a lâmpada só acende com os DOIS contatores desligados.' },
    { sec: 'sig', a: 'K2:22', b: 'H2:X1', hint: 'Do segundo NF para a lâmpada VM MD (motor parado).' },
    { sec: 'sig', a: 'H2:X2', b: 'RET:*', hint: 'Retorno da lâmpada H2 para a barra.' },
    { sec: 'sig', a: 'Q2:4', b: 'K1:23', hint: 'Fase no contato NA 23-24 do K1 (lâmpada da marcha frente).' },
    { sec: 'sig', a: 'K1:24', b: 'H3:X1', hint: 'Saída 24 do K1 na lâmpada VD ML (verde da marcha frente).' },
    { sec: 'sig', a: 'H3:X2', b: 'RET:*', hint: 'Retorno da lâmpada H3 para a barra.' },
    { sec: 'sig', a: 'Q2:4', b: 'K2:23', hint: 'Fase no contato NA 23-24 do K2 (lâmpada da marcha ré).' },
    { sec: 'sig', a: 'K2:24', b: 'H4:X1', hint: 'Saída 24 do K2 na lâmpada VD 2R (verde da marcha ré).' },
    { sec: 'sig', a: 'H4:X2', b: 'RET:*', hint: 'Retorno da lâmpada H4 para a barra.' },
  ],

  tests: [
    {
      id: 'energ', title: 'Energizar o circuito de comando',
      task: 'Ligue Q1 e depois Q2 na bancada.',
      why: 'Com o Q2 fechado a fase L2 chega ao relé F1 e à barra das lâmpadas, e o polo 1 fecha o retorno. Com tudo parado acende a VM MD (motor desligado).',
      ok: (S, res) => S.q1 && S.q2 && !S.f1Tripped && res.lamps.H2 && !res.lamps.H1,
    },
    {
      id: 'frente', title: 'Partida frente — S1',
      task: 'Aperte S1 (botão verde ou tecla 1).',
      why: 'K1 energiza pelo contato NF 11-12 do K2, o motor gira no sentido horário e a verde VD ML acende (a VM MD apaga).',
      ok: (S, res) => res.coils.K1 && !res.coils.K2 && res.motor.dir > 0 && res.lamps.H3 && !res.lamps.H2,
    },
    {
      id: 'parada', title: 'Parada — S0',
      task: 'Aperte S0 (botão vermelho ou tecla 0).',
      why: 'O NF do S0 abre o circuito do comando: os contatores caem, o motor para e a lâmpada VM MD volta a acender.',
      ok: (S, res) => !res.coils.K1 && !res.coils.K2 && res.motor.state === 'parado' && res.lamps.H2,
    },
    {
      id: 're', title: 'Partida ré — S2',
      task: 'Aperte S2 (botão preto ou tecla 2).',
      why: 'Agora é o K2 que energiza: as saídas 2 e 6 do K2 trocam as fases, o motor gira ao contrário e a verde VD 2R acende.',
      ok: (S, res) => res.coils.K2 && !res.coils.K1 && res.motor.dir < 0 && res.lamps.H4,
    },
    {
      id: 'sobrecarga', title: 'Proteção por sobrecarga — F1',
      task: 'Com o motor girando, selecione a carga “Sobrecarga” e espere o relé atuar.',
      why: 'O contato 95-96 abre (desliga os contatores) e o 97-98 fecha, acendendo a lâmpada AM SC de falha.',
      ok: (S, res) => S.f1Tripped && res.motor.state === 'parado' && res.lamps.H1,
    },
    {
      id: 'rearme', title: 'Rearme do relé térmico',
      task: 'Aperte REARMAR no F1 e volte a carga para “Carga nominal”.',
      why: 'Rearmado, o 95-96 fecha de novo, o 97-98 abre e a lâmpada de falha apaga — o quadro volta a funcionar.',
      ok: (S, res) => !S.f1Tripped && !res.lamps.H1,
    },
  ],

  defects: [
    {
      id: 'motor-sem-W', os: 'O.S. 1041', titulo: 'Motor não parte',
      sintoma: 'O quadro liga normal, os contatores fecham nas duas marchas e as lâmpadas de sentido acendem — mas o motor não parte: fica parado.',
      causa: 'Cabo faltando entre a saída 6 do relé térmico F1 e o borne W do motor.',
      medir: 'Com Q1 desligado, teste continuidade do borne 6 do F1 até U, V e W do motor — um deles vai dar aberto.',
      montar: w => rmWire(w, 'F1:6', 'M1:W'),
    },
    {
      id: 're-sem-retorno', os: 'O.S. 1042', titulo: 'Marcha ré inoperante',
      sintoma: 'Na frente tudo funciona: K1 fecha e o motor gira. Na ré nada acontece — o contator K2 não fecha e a lâmpada verde da ré não acende.',
      causa: 'Retorno A2 do K2 solto da barra de retorno (o circuito da bobina não fecha).',
      medir: 'Com o quadro desligado, meça continuidade entre A2 do K2 e a barra de retorno: dá aberto. Compare com o A2 do K1.',
      montar: w => rmWire(w, 'K2:A2', 'RET:*'),
    },
    {
      id: 'sem-retencao', os: 'O.S. 1043', titulo: 'Motor só com o botão apertado',
      sintoma: 'Ao apertar S1 o motor parte, mas no instante em que o botão é solto o motor para. Na ré acontece a mesma coisa.',
      causa: 'Faltam os fios dos contatos de auto-retenção 13-14 (K1:14 → 11 do K2 e K2:14 → 11 do K1), que ficam em paralelo com os botões de partida.',
      medir: 'Com o quadro desligado, procure o contato em paralelo com o S1 (13-14 do K1): a continuidade entre 14 do K1 e o ponto do 11 do K2 está aberta.',
      montar: w => rmWire(rmWire(w, 'K2:11', 'K1:14'), 'K1:11', 'K2:14'),
    },
    {
      id: 'comando-sem-fase', os: 'O.S. 1044', titulo: 'Comando morto',
      sintoma: 'Nenhum botão responde e nenhuma lâmpada acende: S1 e S2 não fecham contator nenhum.',
      causa: 'Cabo entre a saída 4 do disjuntor Q2 (polo 2) e o contato 95 do relé térmico está faltando.',
      medir: 'Com Q2 ligado, meça 4 do Q2 → 95 do F1: dá aberto. A fase sai do Q2 mas não chega ao relé.',
      montar: w => rmWire(w, 'Q2:4', 'F1:95'),
    },
    {
      id: 'sinalizacao-trocada', os: 'O.S. 1045', titulo: 'Sinalização invertida',
      sintoma: 'Aperto frente e acende a lâmpada verde da ré; aperto a ré e acende a verde da frente. Os sentidos do motor estão certos.',
      causa: 'Os contatos 24 saíram trocados: o do K1 foi ligado na lâmpada H4 (ré) e o do K2 na H3 (frente).',
      medir: 'Com o quadro desligado, siga o cabo do borne 24 do K1 até a lâmpada: ele não pode chegar no X1 da H4.',
      montar: w => addWire(addWire(rmWire(rmWire(w, 'K1:24', 'H3:X1'), 'K2:24', 'H4:X1'), 'K1:24', 'H4:X1'), 'K2:24', 'H3:X1'),
    },
    {
      id: 'sem-intertravamento', os: 'O.S. 1046', titulo: 'Disjuntor geral desarmando',
      sintoma: 'Girando para frente e apertando a ré em seguida, os dois contatores fecham juntos e o disjuntor geral desarma com estouro (curto-circuito).',
      causa: 'As bobinas foram ligadas direto no ponto de partida, sem passar pelos contatos NF 11-12 cruzados: o intertravamento entre K1 e K2 foi eliminado.',
      medir: 'Com o quadro desligado, veja onde o A1 do K1 está ligado: ele deve vir do 12 do K2 (NF do outro contator) e não direto do S1.',
      montar: w => addWire(addWire(rmWire(rmWire(w, 'K2:12', 'K1:A1'), 'K1:12', 'K2:A1'),
        'K2:11', 'K1:A1'), 'K1:11', 'K2:A1'),
    },
    {
      id: 'falha-sem-retorno', os: 'O.S. 1047', titulo: 'Lâmpada de falha não acende',
      sintoma: 'Provocando sobrecarga, o motor para (correto) e o relé fica atuado, mas a lâmpada AM SC de falha não acende.',
      causa: 'Retorno X2 da lâmpada de falha solto da barra de retorno.',
      medir: 'Com Q2 desligado, meça continuidade entre o X2 das quatro lâmpadas e a barra de retorno: três passam, uma dá aberto.',
      montar: w => rmWire(w, 'H1:X2', 'RET:*'),
    },
    {
      id: 'parado-sem-lampada', os: 'O.S. 1048', titulo: 'Sem indicação de motor parado',
      sintoma: 'Ligando só o Q2 (nada girando) a lâmpada VM MD não acende. Nas marchas o comportamento está certo.',
      causa: 'O fio entre o borne 22 do K1 e o borne 21 do K2 está faltando: falta um dos dois contatos NF em série.',
      medir: 'Com o quadro desligado, meça continuidade entre 22 do K1 e 21 do K2: dá aberto.',
      montar: w => rmWire(w, 'K1:22', 'K2:21'),
    },
  ],
};

/* ============================================================================
   MISSÃO 02 — QUADRO COM INVERSOR DE FREQUÊNCIA (CFW 500)
   ========================================================================== */
const M2_INVERSOR = {
  id: 'inversor',
  missao: 'Missão 02',
  nome: 'Quadro com inversor',
  titulo: 'Quadro de comando com inversor de frequência CFW 500',
  resumo: 'Contator de linha comandado em 380 V, comando do inversor em 24 V pelas entradas digitais e referência de velocidade por potenciômetro.',
  aplicacao: 'Esteira transportadora com velocidade variável, bomba com controle de vazão, exaustor, misturador.',
  nivel: 'Avançado',
  duracao: '~60 min',
  entregas: [
    'Ramal do inversor protegido por Q1 e manobrado pelo contator de linha K1',
    'Relé de saída RL1 do inversor em série com a bobina do K1: falha do drive derruba o contator',
    'Comando em 24 V pela fonte interna do inversor: DI1 partida, DI2 parada, DI3 habilitação geral e DI4 sentido',
    'Referência de velocidade pelo potenciômetro RP1 (10 kΩ) ligado em +10 V / AI1 / GND',
    'Testes de bancada: partida, referência, sentido, parada, falha (F051) e reset',
  ],
  materiais: [
    'Q1 — disjuntor motor tripolar', 'Q2 — disjuntor bipolar do comando 380 V',
    'K1 — contator de linha com contato auxiliar NA (33-34)',
    'CFW 500 — inversor de frequência trifásico',
    'RP1 — potenciômetro de 10 kΩ', 'S0 NF duplo · S1 NA duplo · S2 NA — botões 22 mm',
    'H1 — lâmpada de falha · H2 — lâmpada de quadro energizado',
  ],
  bench: {
    switches: [{ id: 'q1', label: 'Q1' }, { id: 'q2', label: 'Q2' }],
    buttons: [
      { id: 's1', name: 'S1', sub: 'MARCHA', cls: 'green', key: '1' },
      { id: 's2', name: 'S2', sub: 'SENTIDO', cls: 'dark', key: '2' },
      { id: 's0', name: 'S0', sub: 'PARADA', cls: 'red', key: '0' },
    ],
    protection: 'drive', drive: true, pot: true, load: true, trip: 'drive',
  },
  /* parâmetros do inversor que o painel usa — conferir no manual do CFW 500 */
  parametros: [
    ['P100', 'Tipo de controle', 'V/f (0) — modo mais simples para esteira/bomba'],
    ['P133', 'Ganho da referência de velocidade', '1,000 — referência direta do potenciômetro'],
    ['P220', 'Seleção local/remoto', 'remoto (2) — o comando vem da bornes, não do teclado'],
    ['P263', 'Função da DI1', 'partida (start) no comando a 3 fios'],
    ['P264', 'Função da DI2', 'parada (stop) — deve ficar fechada para o drive rodar'],
    ['P265', 'Função da DI3', 'habilitação geral: só arranca com o contator K1 fechado'],
    ['P266', 'Função da DI4', 'sentido de rotação (FWD/REV)'],
    ['P268', 'Função da RL1', 'falha (NF): abre na falha e derruba o contator de linha'],
    ['P136', 'Frequência máxima', '60 Hz — limite da referência'],
  ],
  schematic: null,
  paint: {
    rails: [{ x: 268, y: 240, w: 168 }, { x: 218, y: 510, w: 200 },
    { x: 1100, y: 330, w: 420 }, { x: 780, y: 1058, w: 200 }],
    zones: [
      { x: 30, y: 10, w: 400, h: 1270, t: 'POTÊNCIA' },
      { x: 690, y: 20, w: 990, h: 440, t: 'COMANDO E SINALIZAÇÃO' },
      { x: 720, y: 560, w: 340, h: 520, t: 'INVERSOR CFW 500' },
      { x: 1040, y: 620, w: 620, h: 560, t: 'RETORNO DO COMANDO' },
    ],
  },

  parts: [
    {
      id: 'ENT', name: 'Borneira de entrada', note: 'L1 · L2 · L3', sub: 'rede',
      kind: 'strip', x: 40, y: 60, w: 150, h: 300,
      terms: [
        { id: 'L1', x: 190, y: 110, dir: 'right', label: 'L1' },
        { id: 'L2', x: 190, y: 180, dir: 'right', label: 'L2' },
        { id: 'L3', x: 190, y: 250, dir: 'right', label: 'L3' },
      ],
    },
    {
      id: 'Q1', name: 'Q1 — Disjuntor motor 3 polos', sub: '3 polos', img: 'assets/disjuntor-3p.png',
      x: 250, y: 20, w: 140, h: 180,
      terms: [
        { id: '1', x: 278, y: 14, dir: 'up', label: '1' },
        { id: '3', x: 320, y: 14, dir: 'up', label: '3' },
        { id: '5', x: 362, y: 14, dir: 'up', label: '5' },
        { id: '2', x: 278, y: 200, dir: 'down', label: '2' },
        { id: '4', x: 320, y: 200, dir: 'down', label: '4' },
        { id: '6', x: 362, y: 200, dir: 'down', label: '6' },
      ],
    },
    {
      id: 'K1', name: 'K1 — Contator de linha', sub: 'linha', img: 'assets/contator.png',
      x: 200, y: 300, w: 190, h: 180,
      terms: [
        { id: '1', x: 240, y: 294, dir: 'up', label: '1' },
        { id: '3', x: 285, y: 294, dir: 'up', label: '3' },
        { id: '5', x: 330, y: 294, dir: 'up', label: '5' },
        { id: '2', x: 240, y: 480, dir: 'down', label: '2' },
        { id: '4', x: 285, y: 480, dir: 'down', label: '4' },
        { id: '6', x: 330, y: 480, dir: 'down', label: '6' },
        { id: 'A1', x: 225, y: 550, dir: 'down', label: 'A1', small: true },
        { id: 'A2', x: 330, y: 550, dir: 'down', label: 'A2', small: true },
        /* 13-14 = NA da retenção · 21-22 = NF livre · 33-34 = NA da habilitação geral do inversor */
        { id: '13', x: 430, y: 320, dir: 'right', label: '13', small: true },
        { id: '14', x: 430, y: 352, dir: 'right', label: '14', small: true },
        { id: '21', x: 430, y: 384, dir: 'right', label: '21', small: true },
        { id: '22', x: 430, y: 416, dir: 'right', label: '22', small: true },
        { id: '33', x: 430, y: 448, dir: 'right', label: '33', small: true },
        { id: '34', x: 430, y: 480, dir: 'right', label: '34', small: true },
      ],
    },
    {
      id: 'CFW', name: 'CFW 500 — Inversor de frequência', sub: 'R·S·T / U·V·W', img: 'assets/inversor.png',
      x: 760, y: 620, w: 240, h: 420,
      terms: [
        /* potência: entra em cima (R/S/T) e sai embaixo (U/V/W) */
        { id: 'R', x: 800, y: 612, dir: 'up', label: 'R' },
        { id: 'S', x: 860, y: 612, dir: 'up', label: 'S' },
        { id: 'T', x: 920, y: 612, dir: 'up', label: 'T' },
        { id: 'U', x: 800, y: 1048, dir: 'down', label: 'U' },
        { id: 'V', x: 860, y: 1048, dir: 'down', label: 'V' },
        { id: 'W', x: 920, y: 1048, dir: 'down', label: 'W' },
        /* tira de comando (lateral direita, como no inversor de verdade) */
        { id: 'AI1', x: 1000, y: 650, dir: 'right', label: 'AI1', small: true },
        { id: '+10V', x: 1000, y: 682, dir: 'right', label: '+10V', small: true },
        { id: 'GND', x: 1000, y: 714, dir: 'right', label: 'GND', small: true },
        { id: 'COM', x: 1000, y: 746, dir: 'right', label: 'COM', small: true },
        { id: 'DI1', x: 1000, y: 778, dir: 'right', label: 'DI1', small: true },
        { id: 'DI2', x: 1000, y: 810, dir: 'right', label: 'DI2', small: true },
        { id: 'DI3', x: 1000, y: 842, dir: 'right', label: 'DI3', small: true },
        { id: 'DI4', x: 1000, y: 874, dir: 'right', label: 'DI4', small: true },
        { id: '+24V', x: 1000, y: 906, dir: 'right', label: '+24V', small: true },
        { id: 'RL1-C', x: 1000, y: 938, dir: 'right', label: 'RL1-C', small: true },
        { id: 'RL1-NF', x: 1000, y: 970, dir: 'right', label: 'RL1-NF', small: true },
        { id: 'RL1-NA', x: 1000, y: 1002, dir: 'right', label: 'RL1-NA', small: true },
      ],
    },
    {
      id: 'M1', name: 'M1 — Motor trifásico (M3~)', sub: 'M3 ~', img: 'assets/motor.png',
      x: 400, y: 900, w: 270, h: 190,
      terms: [
        { id: 'U', x: 670, y: 960, dir: 'right', label: 'U' },
        { id: 'V', x: 670, y: 1000, dir: 'right', label: 'V' },
        { id: 'W', x: 670, y: 1040, dir: 'right', label: 'W' },
      ],
    },
    {
      id: 'RP1', name: 'RP1 — Potenciômetro 10 kΩ', sub: 'referência', img: 'assets/potenciometro.png',
      x: 1100, y: 140, w: 110, h: 140,
      terms: [
        { id: '1', x: 1125, y: 290, dir: 'down', label: '1', small: true },
        { id: '2', x: 1165, y: 290, dir: 'down', label: '2', small: true },
        { id: '3', x: 1205, y: 290, dir: 'down', label: '3', small: true },
      ],
    },
    {
      id: 'S0', name: 'S0 — Parada (NF duplo)', sub: 'NF parada', img: 'assets/botao-s0.png',
      x: 1120, y: 400, w: 120, h: 140, button: 'S0',
      terms: [
        { id: '11', x: 1148, y: 540, dir: 'down', label: '11' },
        { id: '12', x: 1188, y: 540, dir: 'down', label: '12' },
        { id: '21', x: 1148, y: 576, dir: 'down', label: '21', small: true },
        { id: '22', x: 1188, y: 576, dir: 'down', label: '22', small: true },
      ],
    },
    {
      id: 'S1', name: 'S1 — Marcha (NA duplo)', sub: 'NA marcha', img: 'assets/botao-s1.png',
      x: 1280, y: 400, w: 120, h: 140, button: 'S1',
      terms: [
        { id: '13', x: 1308, y: 540, dir: 'down', label: '13' },
        { id: '14', x: 1348, y: 540, dir: 'down', label: '14' },
        { id: '23', x: 1308, y: 576, dir: 'down', label: '23', small: true },
        { id: '24', x: 1348, y: 576, dir: 'down', label: '24', small: true },
      ],
    },
    {
      id: 'S2', name: 'S2 — Sentido (NA)', sub: 'NA sentido', img: 'assets/botao-s2.png',
      x: 1440, y: 400, w: 120, h: 140, button: 'S2',
      terms: [
        { id: '13', x: 1468, y: 540, dir: 'down', label: '13' },
        { id: '14', x: 1508, y: 540, dir: 'down', label: '14' },
      ],
    },
    {
      id: 'H1', name: 'H1 — Lâmpada AM SC (falha do inversor)', sub: 'falha', img: 'assets/lampada-amarela.png',
      x: 1250, y: 720, w: 110, h: 140, lamp: 'H1',
      terms: [
        { id: 'X1', x: 1275, y: 860, dir: 'down', label: 'X1', small: true },
        { id: 'X2', x: 1315, y: 860, dir: 'down', label: 'X2', small: true },
      ],
    },
    {
      id: 'H2', name: 'H2 — Lâmpada VD ML (quadro energizado)', sub: 'energizado', img: 'assets/lampada-verde.png',
      x: 1390, y: 720, w: 110, h: 140, lamp: 'H2',
      terms: [
        { id: 'X1', x: 1415, y: 860, dir: 'down', label: 'X1', small: true },
        { id: 'X2', x: 1455, y: 860, dir: 'down', label: 'X2', small: true },
      ],
    },
    {
      id: 'Q2', name: 'Q2 — Disjuntor do comando (2 polos)', sub: 'comando', img: 'assets/disjuntor-2p.png',
      x: 1560, y: 120, w: 105, h: 200,
      terms: [
        { id: '1', x: 1585, y: 114, dir: 'up', label: '1' },
        { id: '3', x: 1640, y: 114, dir: 'up', label: '3' },
        { id: '2', x: 1585, y: 316, dir: 'down', label: '2' },
        { id: '4', x: 1640, y: 316, dir: 'down', label: '4' },
      ],
    },
    {
      id: 'RET', name: 'Barra de retorno do comando', sub: 'retorno (Q2 polo 1)', kind: 'bus',
      x: 1050, y: 1210, w: 610, h: 60,
      terms: [1080, 1170, 1260, 1345, 1430, 1515, 1595].map((x, i) => ({
        id: 'R' + (i + 1), x: x, y: 1238, dir: 'up', label: String(i + 1), small: true,
      })),
    },
  ],

  sources: {
    L1: ['ENT:L1'], L2: ['ENT:L2'], L3: ['ENT:L3'],
    V24: ['CFW:+24V'], V0: ['CFW:COM'],
  },

  internal: {
    statics: [],
    buses: [['RET:R1', 'RET:R2', 'RET:R3', 'RET:R4', 'RET:R5', 'RET:R6', 'RET:R7', 'RET:R8', 'RET:R9', 'RET:R10', 'RET:R11']],
  },

  rules: [
    { when: s => s.q1, close: [['Q1:1', 'Q1:2'], ['Q1:3', 'Q1:4'], ['Q1:5', 'Q1:6']] },
    { when: s => s.q2, close: [['Q2:1', 'Q2:2'], ['Q2:3', 'Q2:4']] },
    {
      when: c => c.coils.K1,
      close: [['K1:1', 'K1:2'], ['K1:3', 'K1:4'], ['K1:5', 'K1:6'], ['K1:13', 'K1:14'], ['K1:33', 'K1:34']],
    },
    { when: s => !s.pressed.S0, close: [['S0:11', 'S0:12'], ['S0:21', 'S0:22']] },
    { when: s => !!s.pressed.S1, close: [['S1:13', 'S1:14'], ['S1:23', 'S1:24']] },
    { when: s => !!s.pressed.S2, close: [['S2:13', 'S2:14']] },
  ],

  /* K1 é contator (medido nos bornes); RUN é a memória interna do inversor
     (mesma histerese de um comando a 3 fios) — resolvida pelo ponto fixo. */
  coils: [
    { id: 'K1', a: 'K1:A1', b: 'K1:A2' },
    { id: 'RUN', fn: (net, coils, state) => !!vfdInfo(net, coils, state).run },
  ],

  /* modelo do inversor: bornes declarados, comportamento descrito em sim.js */
  vfd: {
    part: 'CFW',
    power: { in: ['CFW:R', 'CFW:S', 'CFW:T'], out: ['CFW:U', 'CFW:V', 'CFW:W'] },
    di: { start: 'CFW:DI1', stop: 'CFW:DI2', enable: 'CFW:DI3', dir: 'CFW:DI4' },
    p24: 'CFW:+24V', com: 'CFW:COM',
    relay: { c: 'CFW:RL1-C', nf: 'CFW:RL1-NF', na: 'CFW:RL1-NA' },
    fmax: 60,
  },

  lamps: [
    { id: 'H1', a: 'H1:X1', b: 'H1:X2', tag: 'AM SC', name: 'falha do inversor', c: '#ffc285' },
    { id: 'H2', a: 'H2:X1', b: 'H2:X2', tag: 'VD ML', name: 'quadro energizado', c: '#6ff0ae' },
  ],

  motor: { u: 'M1:U', v: 'M1:V', w: 'M1:W', nome: 'M1 — motor trifásico (M3~) no inversor' },

  sections: {
    pot: 'Potência — ramal do inversor',
    ctl: 'Comando do contator (380 V) e sinalização',
    io: 'Comando do inversor (24 V) e referência',
  },

  missions: [
    /* ---------- POTÊNCIA ---------- */
    { sec: 'pot', a: 'ENT:L1', b: 'Q1:1', hint: 'Fase L1 na entrada 1 do disjuntor motor Q1.' },
    { sec: 'pot', a: 'ENT:L2', b: 'Q1:3', hint: 'Fase L2 na entrada 3 do Q1.' },
    { sec: 'pot', a: 'ENT:L3', b: 'Q1:5', hint: 'Fase L3 na entrada 5 do Q1.' },
    { sec: 'pot', a: 'Q1:2', b: 'K1:1', hint: 'Saída 2 do Q1 na entrada 1 do contator de linha K1.' },
    { sec: 'pot', a: 'Q1:4', b: 'K1:3', hint: 'Saída 4 do Q1 na entrada 3 do K1.' },
    { sec: 'pot', a: 'Q1:6', b: 'K1:5', hint: 'Saída 6 do Q1 na entrada 5 do K1.' },
    { sec: 'pot', a: 'K1:2', b: 'CFW:R', hint: 'Saída 2 do K1 no borne R (entrada) do inversor.' },
    { sec: 'pot', a: 'K1:4', b: 'CFW:S', hint: 'Saída 4 do K1 no borne S do inversor.' },
    { sec: 'pot', a: 'K1:6', b: 'CFW:T', hint: 'Saída 6 do K1 no borne T do inversor.' },
    { sec: 'pot', a: 'CFW:U', b: 'M1:U', hint: 'Saída U do inversor no borne U do motor. Cabo de força, sem cruzamento.' },
    { sec: 'pot', a: 'CFW:V', b: 'M1:V', hint: 'Saída V do inversor no borne V do motor.' },
    { sec: 'pot', a: 'CFW:W', b: 'M1:W', hint: 'Saída W do inversor no borne W do motor. Aqui as fases saem na ordem — quem inverte o sentido é o inversor, não a fiação.' },

    /* ---------- COMANDO 380 V DO CONTATOR ---------- */
    { sec: 'ctl', a: 'ENT:L1', b: 'Q2:1', hint: 'Fase L1 no polo 1 do Q2 (é o retorno do comando).' },
    { sec: 'ctl', a: 'ENT:L2', b: 'Q2:3', hint: 'Fase L2 no polo 2 do Q2 (fase do comando e das lâmpadas).' },
    { sec: 'ctl', a: 'Q2:2', b: 'RET:*', hint: 'Saída 2 do Q2 na barra de retorno: por ela a bobina do K1 e as lâmpadas fecham o circuito.' },
    { sec: 'ctl', a: 'Q2:4', b: 'CFW:RL1-C', hint: 'A fase do comando entra primeiro no contato do relé do inversor (RL1-C).' },
    { sec: 'ctl', a: 'CFW:RL1-NF', b: 'S0:11', hint: 'Do contato NF do relé (fechado sem falha) para o bloco 11-12 do botão de parada S0.' },
    { sec: 'ctl', a: 'S0:12', b: 'S1:13', hint: 'Do S0 (12) para o bloco 13-14 do botão de marcha S1.' },
    { sec: 'ctl', a: 'S1:14', b: 'K1:A1', hint: 'Saída do S1 na bobina A1 do contator K1.' },
    { sec: 'ctl', a: 'S0:12', b: 'K1:13', hint: 'Retenção: o contato NA 13-14 do K1 em paralelo com o botão S1.' },
    { sec: 'ctl', a: 'K1:14', b: 'K1:A1', hint: 'Outro lado da retenção: o contato 14 também alimenta o A1 do K1.' },
    { sec: 'ctl', a: 'K1:A2', b: 'RET:*', hint: 'Retorno da bobina do K1 para a barra (A2 → barra).' },
    { sec: 'ctl', a: 'CFW:RL1-NA', b: 'H1:X1', hint: 'O contato NA do relé (fecha na falha) alimenta a lâmpada AM SC.' },
    { sec: 'ctl', a: 'H1:X2', b: 'RET:*', hint: 'Retorno da lâmpada de falha para a barra.' },
    { sec: 'ctl', a: 'Q2:4', b: 'H2:X1', hint: 'A fase do comando acende a lâmpada de quadro energizado.' },
    { sec: 'ctl', a: 'H2:X2', b: 'RET:*', hint: 'Retorno da lâmpada H2 para a barra.' },

    /* ---------- COMANDO 24 V E REFERÊNCIA ---------- */
    { sec: 'io', a: 'CFW:+24V', b: 'S0:21', hint: 'O +24 V da fonte interna do inversor alimenta o segundo bloco NF do S0.' },
    { sec: 'io', a: 'S0:22', b: 'S1:23', hint: 'Do S0 (22) para o bloco 23-24 do S1: a parada também derruba a partida.' },
    { sec: 'io', a: 'S1:24', b: 'CFW:DI1', hint: 'Impulso de partida no DI1 (comando a 3 fios).' },
    { sec: 'io', a: 'S0:22', b: 'CFW:DI2', hint: 'O DI2 é a entrada de parada: precisa estar energizada para o drive rodar.' },
    { sec: 'io', a: 'CFW:+24V', b: 'K1:33', hint: 'O +24 V passa pelo contato NA 33-34 do contator de linha.' },
    { sec: 'io', a: 'K1:34', b: 'CFW:DI3', hint: 'Habilitação geral (DI3): o drive só arranca com o contator K1 fechado.' },
    { sec: 'io', a: 'CFW:+24V', b: 'S2:13', hint: 'O +24 V alimenta o botão de sentido S2.' },
    { sec: 'io', a: 'S2:14', b: 'CFW:DI4', hint: 'O DI4 muda o sentido de rotação (FWD/REV).' },
    { sec: 'io', a: 'CFW:+10V', b: 'RP1:1', hint: 'Referência de +10 V do inversor no terminal 1 do potenciômetro.' },
    { sec: 'io', a: 'RP1:2', b: 'CFW:AI1', hint: 'O cursor do potenciômetro (2) leva a referência de velocidade ao AI1.' },
    { sec: 'io', a: 'RP1:3', b: 'CFW:GND', hint: 'O terminal 3 do potenciômetro fecha a referência no GND analógico do inversor.' },
  ],

  tests: [
    {
      id: 'energ', title: 'Energizar o quadro',
      task: 'Ligue Q1 e Q2 na bancada.',
      why: 'Com o Q2 fechado a fase chega ao contato do relé do inversor e a lâmpada VD ML de quadro energizado acende. O contator K1 só fecha no botão de marcha.',
      ok: (S, res) => S.q1 && S.q2 && !res.coils.K1 && res.lamps.H2 && !res.lamps.H1,
    },
    {
      id: 'marcha', title: 'Marcha — S1',
      task: 'Aperte S1 (tecla 1) e observe o contator e o painel do inversor.',
      why: 'O S1 fecha o contator K1 (comando 380 V) e, no mesmo toque, dá o impulso de partida no DI1. Com o K1 fechado o contato 33-34 habilita o drive pelo DI3 e o motor parte.',
      ok: (S, res) => res.coils.K1 && res.dev && res.dev.run && res.motor.state === 'girando' && res.motor.dir > 0,
    },
    {
      id: 'referencia', title: 'Referência pelo potenciômetro',
      task: 'Gire o potenciômetro RP1 na bancada e veja a frequência subir no painel do inversor.',
      why: 'O potenciômetro em +10 V / AI1 / GND dá a referência de velocidade: quanto maior a tensão no AI1, maior a frequência de saída e mais rápido o motor.',
      ok: (S, res) => res.dev && res.dev.run && S.ref > 0.5,
    },
    {
      id: 'sentido', title: 'Sentido de rotação — S2',
      task: 'Com o motor girando, aperte S2 (tecla 2).',
      why: 'O DI4 pede o sentido oposto e o inversor troca a sequência de fases na própria saída: o motor inverte sem nenhum contator de ré.',
      ok: (S, res) => res.dev && res.dev.run && res.dev.rev && res.motor.dir < 0,
    },
    {
      id: 'parada', title: 'Parada — S0',
      task: 'Aperte S0 (tecla 0).',
      why: 'O bloco NF derruba o contator K1 (tirando a potência do drive) e o bloco do DI2 manda o inversor parar. O motor para e a lâmpada de quadro energizado continua acesa.',
      ok: (S, res) => !res.coils.K1 && res.motor.state === 'parado' && res.lamps.H2,
    },
    {
      id: 'falha', title: 'Falha do inversor — F051',
      task: 'Com o motor girando, selecione a carga “Sobrecarga” e espere o drive atuar.',
      why: 'A proteção eletrônica do inversor atua (F051 — sobrecorrente), o relé RL1 abre o NF, o contator K1 cai e a lâmpada de falha acende.',
      ok: (S, res) => S.driveFault && !res.coils.K1 && res.motor.state === 'parado' && res.lamps.H1,
    },
    {
      id: 'reset', title: 'Reset da falha',
      task: 'Aperte RESET no painel do inversor e volte a carga para “Carga nominal”.',
      why: 'Com a falha rearmada o relé RL1 volta ao repouso (NF fechado), a lâmpada apaga e um novo toque em S1 parte o motor — o inversor não religa sozinho.',
      ok: (S, res) => !S.driveFault && !res.lamps.H1,
    },
  ],

  defects: [
    {
      id: 'ref-sem-sinal', os: 'O.S. 2001', titulo: 'Motor parado com o inversor em RUN',
      sintoma: 'O contator fecha, o painel do inversor mostra RUN e a frequência fica em 0,0 Hz — o motor não gira. Nas demais funções o drive responde normal.',
      causa: 'Cabo do cursor do potenciômetro (RP1:2 → AI1) faltando: o inversor roda sem referência de velocidade.',
      medir: 'Com o quadro desligado, meça continuidade do cursor do potenciômetro (2) até o borne AI1: dá aberto.',
      montar: w => rmWire(w, 'RP1:2', 'CFW:AI1'),
    },
    {
      id: 'rele-trocado', os: 'O.S. 2002', titulo: 'Comando morto — nada liga',
      sintoma: 'Aperto o S1 e não acontece nada: o contator não fecha, nenhuma lâmpada acende e o inversor fica em READY.',
      causa: 'O contato do relé do inversor foi ligado no NA em vez do NF: sem falha o contato está aberto, então a fase não chega ao comando.',
      medir: 'Com o quadro desligado (sem falha ativa), meça continuidade entre RL1-C e RL1-NF: deve apitar. Se apitar entre C e NA, o relé está invertido.',
      montar: w => addWire(rmWire(w, 'CFW:RL1-NF', 'S0:11'), 'CFW:RL1-NA', 'S0:11'),
    },
    {
      id: 'di3-sem-habilitacao', os: 'O.S. 2003', titulo: 'Inversor em READY e o motor não arranca',
      sintoma: 'O contator K1 fecha normalmente, mas o painel do inversor fica em SEM HABILITAÇÃO e o motor não parte em nenhum sentido.',
      causa: 'Fio entre o contato NA 34 do contator K1 e o borne DI3 (habilitação geral) faltando: o drive nunca é habilitado.',
      medir: 'Com o K1 fechado, meça tensão do borne 34 do K1 até o COM do inversor: deve dar 24 V. Se der 0 V, a habilitação não chega.',
      montar: w => rmWire(w, 'K1:34', 'CFW:DI3'),
    },
    {
      id: 'sentido-sem-fio', os: 'O.S. 2004', titulo: 'Botão de sentido sem efeito',
      sintoma: 'O motor parte e a referência responde, mas apertando S2 o sentido de rotação não muda.',
      causa: 'Cabo do botão de sentido (S2:14 → DI4) faltando.',
      medir: 'Com o quadro desligado, meça continuidade do 14 do S2 até o DI4: dá aberto.',
      montar: w => rmWire(w, 'S2:14', 'CFW:DI4'),
    },
    {
      id: 'fase-motor-trocada', os: 'O.S. 2005', titulo: 'Motor gira ao contrário da seta',
      sintoma: 'Com o inversor em FWD o motor gira no sentido anti-horário (contra a seta da esteira); na ré gira horário. As lâmpadas e o contator estão certos.',
      causa: 'Duas fases trocadas na saída do inversor: o U do drive foi ligado no W do motor e vice-versa.',
      medir: 'Confira a identificação dos cabos: U do inversor deve descer reto no borne U do motor. Troque U e W de volta.',
      montar: w => addWire(addWire(rmWire(rmWire(w, 'CFW:U', 'M1:U'), 'CFW:W', 'M1:W'), 'CFW:U', 'M1:W'), 'CFW:W', 'M1:U'),
    },
    {
      id: 'falha-sempre-acesa', os: 'O.S. 2006', titulo: 'Lâmpada de falha sempre acesa',
      sintoma: 'Com o quadro ligado a lâmpada AM SC fica acesa direto mesmo sem falha nenhuma; o inversor roda normal.',
      causa: 'A fase do comando foi ligada direto no X1 da lâmpada de falha, em paralelo com o contato do relé (a lâmpada virou “quadro energizado”).',
      medir: 'Com o quadro desligado, veja se existe um cabo do Q2:4 direto no X1 da H1: a lâmpada deve receber apenas o contato NA do relé.',
      montar: w => addWire(w, 'Q2:4', 'H1:X1'),
    },
  ],
};

/* ============================================================================
   PROJETO ATIVO — variáveis globais consumidas por sim.js, app.js e tools/
   ========================================================================== */
const PROJECTS = { reversao: M1_REVERSAO, inversor: M2_INVERSOR };

/* deixado como var/let de propósito: applyProject() troca o quadro inteiro */
let PROJECT = null, PARTS = [], MISSIONS = [], INTERNAL = { statics: [], buses: [] },
  RULES = [], COILS = [], LAMPS = [], MOTOR = {}, VFD = null, SECTIONS = {},
  TESTS = [], DEFECTS = [], PAINT = { rails: [], zones: [] }, SOURCES = {};

/** Carrega um projeto (missão) e publica as globais do quadro ativo. */
function applyProject(id) {
  const p = PROJECTS[id] || PROJECTS.reversao;
  PROJECT = p;
  PARTS = p.parts;
  MISSIONS = p.missions;
  INTERNAL = p.internal;
  RULES = p.rules;
  COILS = p.coils;
  LAMPS = p.lamps;
  MOTOR = p.motor;
  VFD = p.vfd || null;
  SECTIONS = p.sections;
  TESTS = p.tests;
  DEFECTS = p.defects;
  PAINT = p.paint;
  SOURCES = p.sources || {};
  STAGE.w = (p.stage && p.stage.w) || 1700;
  STAGE.h = (p.stage && p.stage.h) || 1290;
  return p;
}

/* projeto padrão (M1). Ferramentas e testes chamam applyProject() de novo. */
applyProject('reversao');
