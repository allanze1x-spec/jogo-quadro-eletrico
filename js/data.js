/* ============================================================================
   QUADRO ELÉTRICO — Comando de motor trifásico com reversão (Frente / Ré)
   data.js — definição dos componentes, terminais e das ligações do esquema
   ========================================================================== */

const STAGE = { w: 1700, h: 1290 };

/* ---------------------------------------------------------------------------
   Componentes já fixados na placa.
   As coordenadas dos terminais são ABSOLUTAS dentro do palco (STAGE).
   dir = direção por onde o fio sai do terminal (para o roteamento dos cabos)
--------------------------------------------------------------------------- */
const PARTS = [
  {
    id: 'ENT', name: 'Borneira de entrada', note: 'L1 · L2 · L3 · N', sub: 'rede',
    kind: 'strip', x: 40, y: 60, w: 150, h: 300,
    terms: [
      { id: 'L1', x: 190, y: 100, dir: 'right', label: 'L1' },
      { id: 'L2', x: 190, y: 165, dir: 'right', label: 'L2' },
      { id: 'L3', x: 190, y: 230, dir: 'right', label: 'L3' },
      { id: 'N', x: 190, y: 295, dir: 'right', label: 'N' },
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
      { id: '13', x: 424, y: 446, dir: 'right', label: '13', small: true },
      { id: '14', x: 424, y: 480, dir: 'right', label: '14', small: true },
      { id: '11', x: 424, y: 514, dir: 'right', label: '11', small: true },
      { id: '12', x: 424, y: 548, dir: 'right', label: '12', small: true },
      { id: '23', x: 424, y: 582, dir: 'right', label: '23', small: true },
      { id: '24', x: 424, y: 616, dir: 'right', label: '24', small: true },
    ],
  },
  {
    id: 'K1x', name: 'Bloco auxiliar K1', kind: 'aux', x: 380, y: 430, w: 80, h: 220, terms: [],
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
      { id: '13', x: 774, y: 446, dir: 'right', label: '13', small: true },
      { id: '14', x: 774, y: 480, dir: 'right', label: '14', small: true },
      { id: '11', x: 774, y: 514, dir: 'right', label: '11', small: true },
      { id: '12', x: 774, y: 548, dir: 'right', label: '12', small: true },
      { id: '23', x: 774, y: 582, dir: 'right', label: '23', small: true },
      { id: '24', x: 774, y: 616, dir: 'right', label: '24', small: true },
    ],
  },
  {
    id: 'K2x', name: 'Bloco auxiliar K2', kind: 'aux', x: 730, y: 430, w: 80, h: 220, terms: [],
  },
  {
    id: 'F1', name: 'F1 — Relé térmico 95-96 / 97-98', sub: '95-98', img: 'assets/rele-termico.png',
    x: 720, y: 700, w: 180, h: 249,
    terms: [
      { id: '1', x: 768, y: 694, dir: 'up', label: '1' },
      { id: '3', x: 805, y: 694, dir: 'up', label: '3' },
      { id: '5', x: 842, y: 694, dir: 'up', label: '5' },
      { id: '2', x: 768, y: 900, dir: 'down', label: '2' },
      { id: '4', x: 805, y: 900, dir: 'down', label: '4' },
      { id: '6', x: 842, y: 900, dir: 'down', label: '6' },
      { id: '95', x: 955, y: 722, dir: 'right', label: '95', small: true },
      { id: '96', x: 955, y: 762, dir: 'right', label: '96', small: true },
      { id: '97', x: 955, y: 806, dir: 'right', label: '97', small: true },
      { id: '98', x: 955, y: 846, dir: 'right', label: '98', small: true },
    ],
  },
  {
    id: 'F1x', name: 'Auxiliares do relé térmico', kind: 'aux', x: 910, y: 700, w: 85, h: 160, terms: [],
  },
  {
    id: 'M1', name: 'M1 — Motor trifásico (M3~)', sub: 'M3 ~', img: 'assets/motor.png',
    x: 730, y: 970, w: 270, h: 193,
    terms: [
      { id: 'U', x: 775, y: 962, dir: 'up', label: 'U' },
      { id: 'V', x: 838, y: 962, dir: 'up', label: 'V' },
      { id: 'W', x: 901, y: 962, dir: 'up', label: 'W' },
    ],
  },
  {
    id: 'Q2', name: 'Q2 — Disjuntor do comando', sub: 'comando', img: 'assets/disjuntor-2p.png',
    x: 1130, y: 70, w: 105, h: 204,
    terms: [
      { id: '1', x: 1155, y: 64, dir: 'up', label: '1' },
      { id: '3', x: 1210, y: 64, dir: 'up', label: '3' },
      { id: '2', x: 1155, y: 226, dir: 'down', label: '2' },
      { id: '4', x: 1210, y: 226, dir: 'down', label: '4' },
    ],
  },
  {
    id: 'S0', name: 'S0 — Botão de parada (NF)', sub: 'NF parada', img: 'assets/botao-s0.png',
    x: 1120, y: 300, w: 120, h: 130, button: 'S0',
    terms: [
      { id: '11', x: 1148, y: 440, dir: 'down', label: '11' },
      { id: '12', x: 1188, y: 440, dir: 'down', label: '12' },
    ],
  },
  {
    id: 'S1', name: 'S1 — Botão frente (NA)', sub: 'NA frente', img: 'assets/botao-s1.png',
    x: 990, y: 480, w: 120, h: 130, button: 'S1',
    terms: [
      { id: '13', x: 1018, y: 620, dir: 'down', label: '13' },
      { id: '14', x: 1058, y: 620, dir: 'down', label: '14' },
    ],
  },
  {
    id: 'S2', name: 'S2 — Botão ré (NA)', sub: 'NA ré', img: 'assets/botao-s2.png',
    x: 1230, y: 480, w: 120, h: 130, button: 'S2',
    terms: [
      { id: '13', x: 1258, y: 620, dir: 'down', label: '13' },
      { id: '14', x: 1298, y: 620, dir: 'down', label: '14' },
    ],
  },
  {
    id: 'H1', name: 'H1 — Lâmpada alimentação', sub: 'alimentação', img: 'assets/lampada-branca.png',
    x: 1240, y: 690, w: 110, h: 140, lamp: 'H1',
    terms: [
      { id: 'X1', x: 1265, y: 840, dir: 'down', label: 'X1', small: true },
      { id: 'X2', x: 1305, y: 840, dir: 'down', label: 'X2', small: true },
    ],
  },
  {
    id: 'H2', name: 'H2 — Lâmpada frente (verde)', sub: 'frente', img: 'assets/lampada-verde.png',
    x: 1350, y: 690, w: 110, h: 140, lamp: 'H2',
    terms: [
      { id: 'X1', x: 1375, y: 840, dir: 'down', label: 'X1', small: true },
      { id: 'X2', x: 1415, y: 840, dir: 'down', label: 'X2', small: true },
    ],
  },
  {
    id: 'H3', name: 'H3 — Lâmpada ré (amarela)', sub: 'ré', img: 'assets/lampada-amarela.png',
    x: 1460, y: 690, w: 110, h: 140, lamp: 'H3',
    terms: [
      { id: 'X1', x: 1485, y: 840, dir: 'down', label: 'X1', small: true },
      { id: 'X2', x: 1525, y: 840, dir: 'down', label: 'X2', small: true },
    ],
  },
  {
    id: 'H4', name: 'H4 — Lâmpada falha (vermelha)', sub: 'falha', img: 'assets/lampada-vermelha.png',
    x: 1570, y: 690, w: 110, h: 140, lamp: 'H4',
    terms: [
      { id: 'X1', x: 1595, y: 840, dir: 'down', label: 'X1', small: true },
      { id: 'X2', x: 1635, y: 840, dir: 'down', label: 'X2', small: true },
    ],
  },
  {
    id: 'BN', name: 'Barra de neutro (N)', sub: 'neutro N', kind: 'bus', x: 170, y: 1200, w: 1480, h: 62,
    terms: [230, 400, 570, 740, 910, 1080, 1250, 1420, 1590].map((x, i) => ({
      id: 'N' + (i + 1), x: x, y: 1228, dir: 'up', label: String(i + 1), small: true,
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
  // barra de neutro: todos os bornes são o mesmo ponto elétrico
  BN: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9'].map(n => 'BN:' + n),
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
  { sec: 'pot', a: 'Q1:2', b: 'K2:5', hint: 'ATENÇÃO: na ré as fases são cruzadas. Saída 2 do Q1 vai no terminal 5 do K2.' },
  { sec: 'pot', a: 'Q1:4', b: 'K2:3', hint: 'Saída 4 do Q1 no terminal 3 do K2 (fase central não troca).' },
  { sec: 'pot', a: 'Q1:6', b: 'K2:1', hint: 'Saída 6 do Q1 no terminal 1 do K2. É o cruzamento que inverte a rotação.' },
  { sec: 'pot', a: 'K1:2', b: 'F1:1', hint: 'Saída 2 do K1 na entrada 1 do relé térmico F1.' },
  { sec: 'pot', a: 'K1:4', b: 'F1:3', hint: 'Saída 4 do K1 na entrada 3 do F1.' },
  { sec: 'pot', a: 'K1:6', b: 'F1:5', hint: 'Saída 6 do K1 na entrada 5 do F1.' },
  { sec: 'pot', a: 'K2:2', b: 'F1:1', hint: 'Saída 2 do K2 também chega na entrada 1 do F1 (mesmo ponto do K1).' },
  { sec: 'pot', a: 'K2:4', b: 'F1:3', hint: 'Saída 4 do K2 na entrada 3 do F1.' },
  { sec: 'pot', a: 'K2:6', b: 'F1:5', hint: 'Saída 6 do K2 na entrada 5 do F1.' },
  { sec: 'pot', a: 'F1:2', b: 'M1:U', hint: 'Saída 2 do F1 no borne U do motor.' },
  { sec: 'pot', a: 'F1:4', b: 'M1:V', hint: 'Saída 4 do F1 no borne V do motor.' },
  { sec: 'pot', a: 'F1:6', b: 'M1:W', hint: 'Saída 6 do F1 no borne W do motor.' },

  // ---------- CIRCUITO DE COMANDO ----------
  { sec: 'com', a: 'ENT:L1', b: 'Q2:1', hint: 'Fase L1 na entrada do disjuntor do comando Q2 (terminal 1).' },
  { sec: 'com', a: 'ENT:L1', b: 'Q2:3', hint: 'A mesma fase L1 alimenta o 2º polo do Q2 — é ele que alimenta as lâmpadas.' },
  { sec: 'com', a: 'ENT:N', b: 'BN:*', hint: 'Neutro da entrada na barra de neutro.' },
  { sec: 'com', a: 'Q2:2', b: 'F1:95', hint: 'Saída 2 do Q2 na entrada 95 do contato NF do relé térmico.' },
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
  { sec: 'com', a: 'K1:A2', b: 'BN:*', hint: 'Retorno da bobina K1 para o neutro (A2 → barra N).' },
  { sec: 'com', a: 'K2:A2', b: 'BN:*', hint: 'Retorno da bobina K2 para o neutro (A2 → barra N).' },

  // ---------- SINALIZAÇÃO ----------
  // No esquema cada lâmpada tem o SEU contato auxiliar próprio:
  // a barra do 2º polo do Q2 alimenta o contato e o contato alimenta a lâmpada.
  { sec: 'sig', a: 'Q2:4', b: 'H1:X1', hint: 'Lâmpada de alimentação H1 direto na saída 4 do Q2 (acesa sempre que o comando estiver energizado).' },
  { sec: 'sig', a: 'H1:X2', b: 'BN:*', hint: 'Retorno da lâmpada H1 para o neutro.' },
  { sec: 'sig', a: 'Q2:4', b: 'K1:23', hint: 'A fase da sinalização entra no contato NA 23-24 do K1 (o contato próprio da lâmpada verde).' },
  { sec: 'sig', a: 'K1:24', b: 'H2:X1', hint: 'Saída 24 do contato do K1 na lâmpada verde (frente).' },
  { sec: 'sig', a: 'H2:X2', b: 'BN:*', hint: 'Retorno da lâmpada H2 para o neutro.' },
  { sec: 'sig', a: 'Q2:4', b: 'K2:23', hint: 'A mesma fase entra no contato NA 23-24 do K2 (contato próprio da lâmpada amarela).' },
  { sec: 'sig', a: 'K2:24', b: 'H3:X1', hint: 'Saída 24 do contato do K2 na lâmpada amarela (ré).' },
  { sec: 'sig', a: 'H3:X2', b: 'BN:*', hint: 'Retorno da lâmpada H3 para o neutro.' },
  { sec: 'sig', a: 'Q2:4', b: 'F1:97', hint: 'A fase da sinalização também vai no contato NA 97-98 do relé térmico (lâmpada de falha).' },
  { sec: 'sig', a: 'F1:98', b: 'H4:X1', hint: 'Do contato 98 do F1 para a lâmpada vermelha de falha.' },
  { sec: 'sig', a: 'H4:X2', b: 'BN:*', hint: 'Retorno da lâmpada H4 para o neutro.' },
];

const SEC_LABEL = { pot: 'Circuito de Potência', com: 'Circuito de Comando', sig: 'Sinalização' };

/* ============================================================================
   MODO MANUTENÇÃO — defeitos escondidos plantados na montagem pronta.
   Cada defeito descreve o SINTOMA (o que o operador relata), a CAUSA e como
   MEDIR com o multímetro. `montar` recebe a fiação correta e devolve a com
   defeito — removendo cabo (rmWire) ou acrescentando o cabo errado (addWire).
   ========================================================================== */

/* qualquer borne da barra de neutro serve: normaliza BN:N1..N9 → BN:* */
const canonKey = k => k.replace(/^BN:N\d+$/, 'BN:*');
const wireKey = (a, b) => [canonKey(a), canonKey(b)].sort().join('~');
const rmWire = (list, a, b) => list.filter(w => wireKey(w.a, w.b) !== wireKey(a, b));
const addWire = (list, a, b) => list.concat([{ a, b, ok: false, mission: null, id: 900 + list.length }]);

const DEFECTS = [
  {
    id: 'motor-sem-W', os: 'O.S. 1041', titulo: 'Motor não parte',
    sintoma: 'O quadro liga normal (lâmpada branca acesa), os contatores fecham nas duas marchas e as lâmpadas de sentido acendem — mas o motor não parte: fica parado.',
    causa: 'Cabo faltando entre a saída 6 do relé térmico F1 e o borne W do motor.',
    medir: 'Com Q1 desligado, teste continuidade do borne 6 do F1 até U, V e W do motor — um deles vai dar aberto.',
    montar: w => rmWire(w, 'F1:6', 'M1:W'),
  },
  {
    id: 're-sem-neutro', os: 'O.S. 1042', titulo: 'Marcha ré inoperante',
    sintoma: 'Na frente tudo funciona: K1 fecha e o motor gira. Na ré nada acontece — o contator K2 não fecha e a lâmpada amarela não acende.',
    causa: 'Retorno A2 do K2 solto da barra de neutro (o circuito da bobina não fecha).',
    medir: 'Com o quadro desligado, meça continuidade entre A2 do K2 e a barra de neutro: dá aberto. Compare com o A2 do K1.',
    montar: w => rmWire(w, 'K2:A2', 'BN:*'),
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
    sintoma: 'A lâmpada de alimentação acende, mas nenhum botão responde: S1 e S2 não fecham contator nenhum.',
    causa: 'Cabo entre a saída 2 do disjuntor Q2 e o contato 95 do relé térmico está faltando.',
    medir: 'Com Q2 ligado, meça 2 do Q2 → 95 do F1: dá aberto. O resto do comando está energizado, mas a fase não chega ao relé.',
    montar: w => rmWire(w, 'Q2:2', 'F1:95'),
  },
  {
    id: 'sinalizacao-trocada', os: 'O.S. 1045', titulo: 'Sinalização invertida',
    sintoma: 'Aperto frente e acende a lâmpada amarela; aperto a ré e acende a verde. Os sentidos do motor estão certos.',
    causa: 'Os contatos 24 saíram trocados: o do K1 foi ligado na lâmpada amarela (H3) e o do K2 na verde (H2).',
    medir: 'Com o quadro desligado, siga o cabo do borne 24 do K1 até a lâmpada: ele não pode chegar no X1 da amarela.',
    montar: w => addWire(addWire(rmWire(rmWire(w, 'K1:24', 'H2:X1'), 'K2:24', 'H3:X1'), 'K1:24', 'H3:X1'), 'K2:24', 'H2:X1'),
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
    id: 'falha-sem-neutro', os: 'O.S. 1047', titulo: 'Lâmpada de falha não acende',
    sintoma: 'Provocando sobrecarga, o motor para (correto) e o relé fica atuado, mas a lâmpada vermelha de falha não acende.',
    causa: 'Retorno X2 da lâmpada de falha solto da barra de neutro.',
    medir: 'Com Q2 desligado, meça continuidade entre o X2 das quatro lâmpadas e a barra de neutro: três passam, uma dá aberto.',
    montar: w => rmWire(w, 'H4:X2', 'BN:*'),
  },
];
