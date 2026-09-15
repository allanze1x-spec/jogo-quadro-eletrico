/* ============================================================================
   QUADRO ELÉTRICO — Comando de motor trifásico com reversão (Frente / Ré)
   data.js — definição dos componentes, terminais e das ligações do esquema

   Este arquivo segue LITERALMENTE o esquema elétrico de referência:
   · a rede entra só com L1, L2 e L3 (NÃO existe neutro no esquema);
   · o Q2 é bipolar: o polo 1 (1-2) é o RETORNO do comando (vem de L1) e o
     polo 2 (3-4) é a FASE do comando e da sinalização (vem de L2);
   · na ré as fases trocam na SAÍDA do K2 (2→F1:5 e 6→F1:1);
   · cada lâmpada de sinalização tem o seu próprio contato auxiliar.
   ========================================================================== */

const STAGE = { w: 1700, h: 1290 };

/* ---------------------------------------------------------------------------
   Componentes já fixados na placa.
   As coordenadas dos terminais são ABSOLUTAS dentro do palco (STAGE).
   dir = direção por onde o fio sai do terminal (para o roteamento dos cabos)
--------------------------------------------------------------------------- */
const PARTS = [
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
    x: 290, y: 100, w: 140, h: 279,
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
    x: 170, y: 400, w: 180, h: 270,
    terms: [
      { id: '1', x: 215, y: 394, dir: 'up', label: '1' },
      { id: '3', x: 260, y: 394, dir: 'up', label: '3' },
      { id: '5', x: 305, y: 394, dir: 'up', label: '5' },
      { id: '2', x: 215, y: 612, dir: 'down', label: '2' },
      { id: '4', x: 260, y: 612, dir: 'down', label: '4' },
      { id: '6', x: 305, y: 612, dir: 'down', label: '6' },
      { id: 'A1', x: 200, y: 686, dir: 'down', label: 'A1', small: true },
      { id: 'A2', x: 320, y: 686, dir: 'down', label: 'A2', small: true },
      // 13-14 = NA da auto-retenção · 11-12 = NF do intertravamento
      // 21-22 = NF da sinalização (lâmpada com tudo desligado) · 23-24 = NA da sinalização
      { id: '13', x: 424, y: 430, dir: 'right', label: '13', small: true },
      { id: '14', x: 424, y: 462, dir: 'right', label: '14', small: true },
      { id: '11', x: 424, y: 494, dir: 'right', label: '11', small: true },
      { id: '12', x: 424, y: 526, dir: 'right', label: '12', small: true },
      { id: '21', x: 424, y: 558, dir: 'right', label: '21', small: true },
      { id: '22', x: 424, y: 590, dir: 'right', label: '22', small: true },
      { id: '23', x: 424, y: 622, dir: 'right', label: '23', small: true },
      { id: '24', x: 424, y: 654, dir: 'right', label: '24', small: true },
      // 4º polo do contator (7-8): existe no desenho do esquema, mas não é usado
      { id: '7', x: 350, y: 430, dir: 'right', label: '7', small: true },
      { id: '8', x: 350, y: 585, dir: 'right', label: '8', small: true },
    ],
  },
  {
    id: 'K1x', name: 'Bloco auxiliar K1', kind: 'aux', x: 380, y: 415, w: 80, h: 260, terms: [],
  },
  {
    id: 'K2', name: 'K2 — Contator (ré)', sub: 'ré', img: 'assets/contator.png',
    x: 520, y: 400, w: 180, h: 270,
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
      // 4º polo do contator (7-8): livre, como no esquema
      { id: '7', x: 700, y: 430, dir: 'right', label: '7', small: true },
      { id: '8', x: 700, y: 585, dir: 'right', label: '8', small: true },
    ],
  },
  {
    id: 'K2x', name: 'Bloco auxiliar K2', kind: 'aux', x: 730, y: 415, w: 80, h: 260, terms: [],
  },
  {
    /* F1 fica na coluna de potência, logo abaixo do K1 — como no esquema */
    id: 'F1', name: 'F1 — Relé térmico 95-96 / 97-98', sub: '95-98', img: 'assets/rele-termico.png',
    x: 150, y: 760, w: 180, h: 249,
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
  {
    id: 'F1x', name: 'Auxiliares do relé térmico', kind: 'aux', x: 340, y: 760, w: 85, h: 160, terms: [],
  },
  {
    /* o motor pendura no F1, no pé da coluna de potência (canto inferior esquerdo) */
    id: 'M1', name: 'M1 — Motor trifásico (M3~)', sub: 'M3 ~', img: 'assets/motor.png',
    x: 105, y: 1020, w: 270, h: 193,
    terms: [
      { id: 'U', x: 150, y: 1012, dir: 'up', label: 'U' },
      { id: 'V', x: 213, y: 1012, dir: 'up', label: 'V' },
      { id: 'W', x: 276, y: 1012, dir: 'up', label: 'W' },
    ],
  },
  {
    /* Q2 abre a coluna de comando; a saída 2 (polo 1) desce reta até a barra
       de retorno, igual ao fio que desce do 2 do Q2 no esquema */
    id: 'Q2', name: 'Q2 — Disjuntor do comando (2 polos)', sub: 'comando', img: 'assets/disjuntor-2p.png',
    x: 700, y: 200, w: 105, h: 204,
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
];

/* ---------------------------------------------------------------------------
   Ligações internas dos componentes (contatos fechados / bobinas)
   chaves: "PART:TERM"
--------------------------------------------------------------------------- */
const INTERNAL = {
  // contatos de potência do relé térmico: conduzem sempre (só desligam se disparar)
  F1_power: [['F1:1', 'F1:2'], ['F1:3', 'F1:4'], ['F1:5', 'F1:6']],
  // barra de retorno: todos os bornes são o mesmo ponto elétrico
  RET: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'].map(n => 'RET:' + n),
};

/* ---------------------------------------------------------------------------
   MISSÕES — ordem exata do esquema elétrico
   a / b aceitam "PART:TERM" ou "PART:*" (qualquer terminal da peça)
--------------------------------------------------------------------------- */
const MISSIONS = [
  // ---------- CIRCUITO DE POTÊNCIA ----------
  { sec: 'pot', a: 'ENT:L1', b: 'Q1:1', hint: 'Fase L1 na entrada do disjuntor geral Q1 (terminal 1).' },
  { sec: 'pot', a: 'ENT:L2', b: 'Q1:3', hint: 'Fase L2 no terminal 3 do Q1.' },
  { sec: 'pot', a: 'ENT:L3', b: 'Q1:5', hint: 'Fase L3 no terminal 5 do Q1.' },
  { sec: 'pot', a: 'Q1:2', b: 'K1:1', hint: 'Saída 2 do Q1 vai na entrada 1 do contator K1 (frente).' },
  { sec: 'pot', a: 'Q1:4', b: 'K1:3', hint: 'Saída 4 do Q1 na entrada 3 do K1.' },
  { sec: 'pot', a: 'Q1:6', b: 'K1:5', hint: 'Saída 6 do Q1 na entrada 5 do K1.' },
  // Na ré a entrada do K2 é direta — quem cruza as fases é a SAÍDA (2 e 6).
  { sec: 'pot', a: 'Q1:2', b: 'K2:1', hint: 'As entradas do K2 são ligadas direto nas saídas do Q1: 2 → 1.' },
  { sec: 'pot', a: 'Q1:4', b: 'K2:3', hint: 'Saída 4 do Q1 na entrada 3 do K2 (fase central não troca).' },
  { sec: 'pot', a: 'Q1:6', b: 'K2:5', hint: 'Saída 6 do Q1 na entrada 5 do K2.' },
  { sec: 'pot', a: 'K1:2', b: 'F1:1', hint: 'Saída 2 do K1 na entrada 1 do relé térmico F1.' },
  { sec: 'pot', a: 'K1:4', b: 'F1:3', hint: 'Saída 4 do K1 na entrada 3 do F1.' },
  { sec: 'pot', a: 'K1:6', b: 'F1:5', hint: 'Saída 6 do K1 na entrada 5 do F1.' },
  // ATENÇÃO: o cruzamento que inverte a rotação está aqui, na saída do K2.
  { sec: 'pot', a: 'K2:2', b: 'F1:5', hint: 'Saída 2 do K2 vai no terminal 5 do F1 — é uma das fases trocadas.' },
  { sec: 'pot', a: 'K2:4', b: 'F1:3', hint: 'Saída 4 do K2 no terminal 3 do F1.' },
  { sec: 'pot', a: 'K2:6', b: 'F1:1', hint: 'Saída 6 do K2 no terminal 1 do F1 — a outra fase trocada. É esse cruzamento que faz o motor girar ao contrário.' },
  { sec: 'pot', a: 'F1:2', b: 'M1:U', hint: 'Saída 2 do F1 no borne U do motor.' },
  { sec: 'pot', a: 'F1:4', b: 'M1:V', hint: 'Saída 4 do F1 no borne V do motor.' },
  { sec: 'pot', a: 'F1:6', b: 'M1:W', hint: 'Saída 6 do F1 no borne W do motor.' },

  // ---------- CIRCUITO DE COMANDO ----------
  // O Q2 é bipolar: o polo 2 (3-4) leva a FASE (L2) para o comando e para a
  // sinalização; o polo 1 (1-2) é o RETORNO (L1) por onde tudo fecha.
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

  // ---------- SINALIZAÇÃO ----------
  // A fase (saída 4 do Q2) chega no contato e o contato alimenta a lâmpada;
  // o X2 de cada lâmpada desce para a barra de retorno.
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
];

const SEC_LABEL = { pot: 'Circuito de Potência', com: 'Circuito de Comando', sig: 'Sinalização' };

/* ============================================================================
   MODO MANUTENÇÃO — defeitos escondidos plantados na montagem pronta.
   Cada defeito descreve o SINTOMA (o que o operador relata), a CAUSA e como
   MEDIR com o multímetro. `montar` recebe a fiação correta e devolve a com
   defeito — removendo cabo (rmWire) ou acrescentando o cabo errado (addWire).
   ========================================================================== */

/* qualquer borne da barra de retorno serve: normaliza RET:R1..R9 → RET:* */
const canonKey = k => k.replace(/^RET:R\d+$/, 'RET:*');
const wireKey = (a, b) => [canonKey(a), canonKey(b)].sort().join('~');
const rmWire = (list, a, b) => list.filter(w => wireKey(w.a, w.b) !== wireKey(a, b));
const addWire = (list, a, b) => list.concat([{ a, b, ok: false, mission: null, id: 900 + list.length }]);

const DEFECTS = [
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
];
