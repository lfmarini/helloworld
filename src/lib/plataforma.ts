/**
 * Jogo de plataforma: física, fase e colisões.
 *
 * Como nos outros módulos, aqui não entra React nem three.js — só números.
 * A unidade de medida é o "bloco": o mundo é uma grade, e tudo (velocidade,
 * gravidade, tamanho) é medido em blocos e blocos por segundo.
 */

/* ------------------------------------------------------------------ */
/* Constantes de comportamento                                         */
/* ------------------------------------------------------------------ */

export const GRAVIDADE = 34;
/** Velocidade máxima correndo, em blocos por segundo. */
const VEL_MAX = 6.4;
/** Quanto acelera por segundo ao segurar a direção. */
const ACELERACAO = 30;
/** Quanto freia por segundo ao soltar. */
const ATRITO = 24;
/** Freio extra ao virar para o outro lado — dá a resposta rápida do gênero. */
const ATRITO_VIRADA = 46;
/** Impulso do pulo. Com a gravidade acima, sobe cerca de 3,3 blocos. */
const VEL_PULO = 15;
/**
 * O pulo é de altura variável: soltar o botão no meio da subida corta a
 * velocidade para cima. É esse detalhe que separa um pulinho de um pulo
 * cheio, e é o que dá o controle fino do gênero.
 */
const CORTE_DO_PULO = 0.42;
/** Teto de velocidade de queda, para não atravessar blocos. */
const VEL_MAX_QUEDA = 24;

/**
 * "Tempo do coiote": por um instante depois de sair da beirada, o pulo ainda
 * vale. Sem isso o jogo parece injusto, porque o jogador aperta um quadro
 * tarde demais e não entende por que não pulou.
 */
const TEMPO_COIOTE = 0.09;
/**
 * Pulo adiantado: apertar um pouco antes de encostar no chão continua valendo
 * quando encosta. O outro lado da mesma moeda.
 */
const MEMORIA_DO_PULO = 0.12;

/**
 * Velocidade do inimigo. Bem menor que a do jogador de proposito: andando a
 * 2,3 contra os 6,4 do jogador, os dois se aproximavam a quase 9 blocos por
 * segundo e nao sobrava tempo de reagir. No genero, o inimigo e sempre bem
 * mais lento que o heroi.
 */
const VEL_INIMIGO = 1.5;
/**
 * Distancia maxima que o inimigo se afasta de onde nasceu.
 *
 * Sem limite, ele desce a fase inteira e acaba parando embaixo de um teto
 * baixo ou na beirada de um buraco — lugares onde o encontro vira armadilha.
 * Com patrulha curta, ele fica onde a fase foi desenhada para recebe-lo.
 */
const RAIO_PATRULHA = 3.5;

/** Tamanho do jogador, em blocos. Um pouco menor que um bloco de largura. */
export const LARGURA_JOGADOR = 0.72;
export const ALTURA_JOGADOR = 0.92;
export const TAMANHO_INIMIGO = 0.8;

/** Tempo parado na animação de morte antes de reiniciar. */
const TEMPO_MORTE = 1.4;
/** Duração da fase, em segundos. */
export const TEMPO_LIMITE = 150;

/* ------------------------------------------------------------------ */
/* Fase                                                                */
/* ------------------------------------------------------------------ */

export const VAZIO = 0;
export const SOLIDO = 1;
export const CAIXA = 2;
export const CAIXA_USADA = 3;

export const ALTURA_MAPA = 16;
export const LARGURA_MAPA = 210;

export interface Moeda {
  x: number;
  y: number;
  pega: boolean;
  /** Moeda que saltou de uma caixa: sobe, brilha e some. */
  saltando: number;
}

export interface Inimigo {
  x: number;
  y: number;
  /** Onde nasceu: a patrulha e limitada em volta deste ponto. */
  origem: number;
  vx: number;
  vivo: boolean;
  /** Tempo desde que foi pisado, para a animação de achatar. */
  tempoMorte: number;
}

export interface Fase {
  mapa: Uint8Array;
  moedas: Moeda[];
  inimigos: Inimigo[];
  inicio: { x: number; y: number };
  bandeira: number;
}

const indice = (x: number, y: number) => y * LARGURA_MAPA + x;

/** Lê um bloco do mapa. Fora dos limites conta como vazio. */
export function bloco(mapa: Uint8Array, x: number, y: number): number {
  if (x < 0 || x >= LARGURA_MAPA || y < 0 || y >= ALTURA_MAPA) return VAZIO;
  return mapa[indice(x, y)];
}

export function ehSolido(tipo: number) {
  return tipo !== VAZIO;
}

/**
 * Monta a fase.
 *
 * É escrita com chamadas explícitas em vez de um desenho em texto de propósito:
 * assim o traçado fica alinhado sem contar caractere, e mexer no ritmo da fase
 * depois é só mudar um número.
 */
export function criarFase(): Fase {
  const mapa = new Uint8Array(LARGURA_MAPA * ALTURA_MAPA);
  const moedas: Moeda[] = [];
  const inimigos: Inimigo[] = [];

  const por = (x: number, y: number, tipo: number) => {
    if (x >= 0 && x < LARGURA_MAPA && y >= 0 && y < ALTURA_MAPA) {
      mapa[indice(x, y)] = tipo;
    }
  };
  /** Chão de x1 até x2 (inclusive), com duas fileiras de espessura. */
  const chao = (x1: number, x2: number, altura = 2) => {
    for (let x = x1; x <= x2; x++) {
      for (let y = 0; y < altura; y++) por(x, y, SOLIDO);
    }
  };
  const plataforma = (x1: number, x2: number, y: number, tipo = SOLIDO) => {
    for (let x = x1; x <= x2; x++) por(x, y, tipo);
  };
  const escada = (x: number, altura: number, sentido: 1 | -1) => {
    for (let i = 0; i < altura; i++) {
      const cx = x + i * sentido;
      for (let y = 2; y <= 2 + i; y++) por(cx, y, SOLIDO);
    }
  };
  const moeda = (x: number, y: number) =>
    moedas.push({ x: x + 0.5, y: y + 0.5, pega: false, saltando: 0 });
  /** y e o nivel onde o inimigo pisa: 2 no chao, 7 numa plataforma da linha 6. */
  const inimigo = (x: number, y: number) =>
    inimigos.push({ x: x + 0.5, y, origem: x + 0.5, vx: -VEL_INIMIGO, vivo: true, tempoMorte: 0 });

  /* --- Começo tranquilo: chão limpo para pegar o jeito --- */
  chao(0, 26);
  moeda(12, 3);
  moeda(14, 3);
  moeda(16, 3);

  /* --- Primeiras caixas e o primeiro inimigo --- */
  // O primeiro inimigo fica em ceu aberto, longe dos blocos. Debaixo de teto
  // o encontro exige um pulinho curto e controlado — cobranca demais para o
  // primeiro inimigo que a pessoa ve na vida.
  inimigo(16, 2);
  por(20, 5, CAIXA);
  // A plataforma termina bem antes da beirada de proposito: com teto logo
  // acima do ponto de decolagem, o jogador bate a cabeca e o pulo morre pela
  // metade — cai no buraco sem ter feito nada errado.
  plataforma(21, 23, 5);
  por(22, 5, CAIXA);

  /* --- Primeiro buraco: 3 blocos, dá para passar correndo --- */
  chao(30, 51);
  moeda(31, 3);
  moeda(32, 4);
  moeda(33, 5);
  por(36, 5, CAIXA);
  por(37, 5, SOLIDO);
  por(38, 5, CAIXA);
  inimigo(42, 2);
  inimigo(46, 2);

  /* --- Escadinha para cima, e o topo dela vira o trampolim do buraco ---
     Antes a escada subia e o chao despencava logo depois, deixando um unico
     bloco de pista antes do buraco: nao dava tempo de nada. Agora o salto
     parte do alto, com a altura ajudando. */
  escada(48, 4, 1);
  chao(55, 78);
  plataforma(58, 64, 6);
  moeda(59, 7);
  moeda(61, 7);
  moeda(63, 7);
  inimigo(60, 7);
  por(68, 5, CAIXA);
  por(69, 5, CAIXA);
  inimigo(74, 2);

  /* --- Buraco maior, exige pulo cheio --- */
  chao(84, 108);
  plataforma(80, 82, 3);
  moeda(81, 4);
  por(88, 6, CAIXA);
  plataforma(92, 96, 5);
  moeda(93, 6);
  moeda(95, 6);
  inimigo(94, 6);
  inimigo(100, 2);
  por(86, 5, CAIXA);
  por(87, 5, SOLIDO);

  /* --- Corredor de teto baixo: obriga a correr sem pular --- */
  chao(112, 140);
  plataforma(116, 128, 6);
  moeda(118, 3);
  moeda(120, 3);
  moeda(122, 3);
  inimigo(119, 2);
  inimigo(126, 2);
  plataforma(132, 136, 5);
  moeda(133, 6);
  moeda(135, 6);

  /* --- Ilhas: sequência de pulos precisos --- */
  chao(144, 150);
  chao(154, 159);
  chao(163, 168);
  moeda(147, 4);
  moeda(156, 4);
  moeda(165, 4);
  inimigo(157, 2);

  /* --- Reta final com escada e a bandeira --- */
  chao(172, 209);
  inimigo(180, 2);
  por(184, 5, CAIXA);
  por(185, 5, CAIXA);
  por(186, 5, CAIXA);
  inimigo(190, 2);
  escada(194, 6, 1);

  return {
    mapa,
    moedas,
    inimigos,
    inicio: { x: 3.5, y: 3 },
    bandeira: 205,
  };
}

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

export type StatusFase = "jogando" | "morrendo" | "venceu" | "acabou";

export interface Jogador {
  x: number;
  y: number;
  vx: number;
  vy: number;
  noChao: boolean;
  /** 1 olhando para a direita, -1 para a esquerda. */
  olhando: number;
  /** Tempo desde que saiu do chão, para o "tempo do coiote". */
  desdeOChao: number;
  /** Tempo desde que o pulo foi pedido, para o pulo adiantado. */
  desdeOPedido: number;
  /** Enquanto true, segurar o botão continua valendo o pulo. */
  pulando: boolean;
}

export interface EstadoPlataforma {
  fase: Fase;
  jogador: Jogador;
  moedas: Moeda[];
  inimigos: Inimigo[];
  mapa: Uint8Array;
  moedasPegas: number;
  pontos: number;
  vidas: number;
  tempo: number;
  status: StatusFase;
  tempoMorte: number;
}

export interface ComandosPlataforma {
  /** -1 esquerda, 1 direita, 0 parado. */
  horizontal: number;
  pular: boolean;
}

export function criarEstadoPlataforma(fase = criarFase()): EstadoPlataforma {
  return {
    fase,
    jogador: novoJogador(fase),
    moedas: fase.moedas.map((m) => ({ ...m })),
    inimigos: fase.inimigos.map((i) => ({ ...i })),
    mapa: Uint8Array.from(fase.mapa),
    moedasPegas: 0,
    pontos: 0,
    vidas: 3,
    tempo: TEMPO_LIMITE,
    status: "jogando",
    tempoMorte: 0,
  };
}

function novoJogador(fase: Fase): Jogador {
  return {
    x: fase.inicio.x,
    y: fase.inicio.y,
    vx: 0,
    vy: 0,
    noChao: false,
    olhando: 1,
    desdeOChao: 99,
    desdeOPedido: 99,
    pulando: false,
  };
}

/** Recomeça a fase mantendo os pontos, e desconta uma vida. */
export function reiniciarFase(e: EstadoPlataforma) {
  e.vidas -= 1;
  e.jogador = novoJogador(e.fase);
  e.moedas = e.fase.moedas.map((m) => ({ ...m }));
  e.inimigos = e.fase.inimigos.map((i) => ({ ...i }));
  e.mapa = Uint8Array.from(e.fase.mapa);
  e.tempo = TEMPO_LIMITE;
  e.tempoMorte = 0;
  e.status = e.vidas > 0 ? "jogando" : "acabou";
}

/* ------------------------------------------------------------------ */
/* Colisão                                                             */
/* ------------------------------------------------------------------ */

/** Há bloco sólido em algum ponto do retângulo? */
function encostaEmBloco(
  mapa: Uint8Array,
  x: number,
  y: number,
  largura: number,
  altura: number,
): boolean {
  const x1 = Math.floor(x - largura / 2);
  const x2 = Math.floor(x + largura / 2 - 0.0001);
  const y1 = Math.floor(y);
  const y2 = Math.floor(y + altura - 0.0001);
  for (let by = y1; by <= y2; by++) {
    for (let bx = x1; bx <= x2; bx++) {
      if (ehSolido(bloco(mapa, bx, by))) return true;
    }
  }
  return false;
}

export interface EventosPlataforma {
  pulou: boolean;
  moedas: number;
  caixaBatida: boolean;
  pisouInimigo: boolean;
  morreu: boolean;
  venceu: boolean;
}

const SEM_EVENTOS: EventosPlataforma = {
  pulou: false,
  moedas: 0,
  caixaBatida: false,
  pisouInimigo: false,
  morreu: false,
  venceu: false,
};

function matar(e: EstadoPlataforma, eventos: EventosPlataforma) {
  if (e.status !== "jogando") return;
  e.status = "morrendo";
  e.tempoMorte = TEMPO_MORTE;
  e.jogador.vy = 11; // pulinho de morte, como manda o gênero
  eventos.morreu = true;
}

/** Avança o jogo em um passo de tempo fixo. */
export function passoPlataforma(
  e: EstadoPlataforma,
  c: ComandosPlataforma,
  dt: number,
): EventosPlataforma {
  const eventos = { ...SEM_EVENTOS };
  const j = e.jogador;

  if (e.status === "venceu" || e.status === "acabou") return eventos;

  /* --- Morrendo: a animação corre e a fase reinicia --- */
  if (e.status === "morrendo") {
    e.tempoMorte -= dt;
    j.vy -= GRAVIDADE * dt;
    j.y += j.vy * dt;
    if (e.tempoMorte <= 0) reiniciarFase(e);
    return eventos;
  }

  e.tempo -= dt;
  if (e.tempo <= 0) {
    e.tempo = 0;
    matar(e, eventos);
    return eventos;
  }

  /* --- Movimento horizontal --- */
  if (c.horizontal !== 0) {
    j.olhando = c.horizontal;
    // Virar para o outro lado freia mais forte que apenas acelerar.
    const virando = j.vx !== 0 && Math.sign(j.vx) !== c.horizontal;
    const taxa = virando ? ACELERACAO + ATRITO_VIRADA : ACELERACAO;
    j.vx += c.horizontal * taxa * dt;
    j.vx = Math.max(-VEL_MAX, Math.min(VEL_MAX, j.vx));
  } else {
    const freio = ATRITO * dt;
    j.vx = Math.abs(j.vx) <= freio ? 0 : j.vx - Math.sign(j.vx) * freio;
  }

  /* --- Pulo --- */
  j.desdeOChao += dt;
  j.desdeOPedido += dt;
  if (c.pular) {
    if (!j.pulando) j.desdeOPedido = 0;
  } else if (j.vy > 0) {
    // Soltou no meio da subida: corta o impulso e o pulo fica baixo.
    j.vy *= CORTE_DO_PULO;
  }
  j.pulando = c.pular;

  const podePular = j.desdeOChao <= TEMPO_COIOTE;
  const pediuAgora = j.desdeOPedido <= MEMORIA_DO_PULO;
  if (podePular && pediuAgora) {
    j.vy = VEL_PULO;
    j.noChao = false;
    j.desdeOChao = 99;
    j.desdeOPedido = 99;
    eventos.pulou = true;
  }

  j.vy -= GRAVIDADE * dt;
  if (j.vy < -VEL_MAX_QUEDA) j.vy = -VEL_MAX_QUEDA;

  /* --- Resolve X e depois Y, separadamente ---
     Mover num eixo de cada vez e corrigir antes de passar para o outro é o
     que evita o jogador enroscar em quinas ou atravessar parede na diagonal. */
  const meio = LARGURA_JOGADOR / 2;
  const FOLGA = 0.0001;

  j.x += j.vx * dt;
  if (encostaEmBloco(e.mapa, j.x, j.y, LARGURA_JOGADOR, ALTURA_JOGADOR)) {
    // Encaixa exatamente na borda do bloco, em vez de voltar de pouquinho em
    // pouquinho. Além de mais preciso, evita o laço infinito que acontecia
    // quando a velocidade era exatamente zero e o "passo de volta" também.
    if (j.vx > 0) j.x = Math.floor(j.x + meio) - meio - FOLGA;
    else if (j.vx < 0) j.x = Math.floor(j.x - meio) + 1 + meio + FOLGA;
    j.vx = 0;
  }

  j.y += j.vy * dt;
  j.noChao = false;
  if (encostaEmBloco(e.mapa, j.x, j.y, LARGURA_JOGADOR, ALTURA_JOGADOR)) {
    const subindo = j.vy > 0;
    if (subindo) j.y = Math.floor(j.y + ALTURA_JOGADOR) - ALTURA_JOGADOR - FOLGA;
    else j.y = Math.floor(j.y) + 1 + FOLGA;
    if (subindo) {
      // Bateu com a cabeça: procura uma caixa logo acima.
      const topo = Math.floor(j.y + ALTURA_JOGADOR + 0.05);
      for (const bx of [Math.floor(j.x - 0.2), Math.floor(j.x + 0.2)]) {
        if (bloco(e.mapa, bx, topo) === CAIXA) {
          e.mapa[topo * LARGURA_MAPA + bx] = CAIXA_USADA;
          e.moedas.push({ x: bx + 0.5, y: topo + 1.2, pega: false, saltando: 0.6 });
          eventos.caixaBatida = true;
          break;
        }
      }
    } else {
      j.noChao = true;
      j.desdeOChao = 0;
    }
    j.vy = 0;
  }

  /* --- Caiu no buraco --- */
  if (j.y < -2) {
    matar(e, eventos);
    return eventos;
  }

  /* --- Moedas --- */
  for (const m of e.moedas) {
    if (m.pega) continue;
    if (m.saltando > 0) {
      // Moeda que saiu da caixa: sobe um pouco e é recolhida sozinha.
      m.saltando -= dt;
      m.y += 3 * dt;
      if (m.saltando <= 0) {
        m.pega = true;
        e.moedasPegas += 1;
        e.pontos += 100;
        eventos.moedas += 1;
      }
      continue;
    }
    if (
      Math.abs(m.x - j.x) < 0.5 + LARGURA_JOGADOR / 2 - 0.15 &&
      m.y > j.y - 0.3 &&
      m.y < j.y + ALTURA_JOGADOR + 0.3
    ) {
      m.pega = true;
      e.moedasPegas += 1;
      e.pontos += 100;
      eventos.moedas += 1;
    }
  }

  /* --- Inimigos --- */
  for (const inimigo of e.inimigos) {
    if (!inimigo.vivo) {
      inimigo.tempoMorte += dt;
      continue;
    }

    inimigo.x += inimigo.vx * dt;

    // Vira ao encostar em parede...
    const meio = TAMANHO_INIMIGO / 2;
    if (encostaEmBloco(e.mapa, inimigo.x, inimigo.y, TAMANHO_INIMIGO, TAMANHO_INIMIGO)) {
      inimigo.x -= inimigo.vx * dt; // desfaz o passo e vira
      inimigo.vx *= -1;
    } else {
      // ...na beirada, para não cair sozinho no buraco...
      const frente = inimigo.x + Math.sign(inimigo.vx) * meio;
      const chaoAdiante = ehSolido(
        bloco(e.mapa, Math.floor(frente), Math.floor(inimigo.y - 0.1)),
      );
      // ...e no limite da patrulha.
      const longeDemais =
        Math.abs(inimigo.x - inimigo.origem) > RAIO_PATRULHA &&
        Math.sign(inimigo.x - inimigo.origem) === Math.sign(inimigo.vx);
      if (!chaoAdiante || longeDemais) inimigo.vx *= -1;
    }

    // Encontro com o jogador
    const perto =
      Math.abs(inimigo.x - j.x) < (TAMANHO_INIMIGO + LARGURA_JOGADOR) / 2 &&
      j.y < inimigo.y + TAMANHO_INIMIGO &&
      j.y + ALTURA_JOGADOR > inimigo.y;

    if (perto) {
      // Pisou em cima: precisa estar caindo e vindo de cima do inimigo.
      const pisando = j.vy < 0 && j.y > inimigo.y + TAMANHO_INIMIGO * 0.35;
      if (pisando) {
        inimigo.vivo = false;
        inimigo.tempoMorte = 0;
        e.pontos += 200;
        j.vy = 10; // quique ao pisar
        eventos.pisouInimigo = true;
      } else {
        matar(e, eventos);
        return eventos;
      }
    }
  }

  /* --- Chegada --- */
  if (j.x >= e.fase.bandeira) {
    e.status = "venceu";
    // Sobra de tempo vira ponto, como manda a tradição do gênero.
    e.pontos += Math.floor(e.tempo) * 10;
    eventos.venceu = true;
  }

  return eventos;
}
