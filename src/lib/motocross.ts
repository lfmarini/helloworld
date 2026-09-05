/**
 * Física e pista da corrida de motocross.
 *
 * Como em snake.ts, este arquivo não sabe nada de React nem de three.js: são
 * só números. A parte 3D depois traduz esse estado em imagem. Isso deixa a
 * regra do jogo testável fora do navegador, sem placa de vídeo.
 */

/** Quantas faixas a pista tem, como no clássico do NES. */
export const FAIXAS = 4;
/**
 * Distância entre o centro de duas faixas, em metros.
 *
 * Só afeta o desenho, não a física (as faixas são números inteiros). Medindo
 * o enquadramento, 2,6 m deixava as quatro faixas ocupando 9% da altura da
 * tela — uma fita fina no meio do nada. Com 3,4 m elas ocupam cerca de 25%.
 */
export const LARGURA_FAIXA = 3.4;
/** Comprimento total da prova, em metros. */
export const COMPRIMENTO = 900;

/* ------------------------------------------------------------------ */
/* Constantes de comportamento                                         */
/* ------------------------------------------------------------------ */

/** Velocidade que a moto alcança com o acelerador normal (m/s). */
const V_NORMAL = 17;
/** Velocidade com o turbo. */
const V_TURBO = 26;
/** Teto de velocidade dentro da lama. */
const V_LAMA = 7;
/** O quanto a moto ganha velocidade por segundo. */
const ACELERACAO = 11;
/** O quanto perde quando solta o acelerador. */
const DESACELERACAO = 7;
/** Freio forte: lama e motor fundido. */
const FREIO_FORTE = 26;

/** Gravidade. Bem maior que a real: física de videogame é mais divertida. */
const GRAVIDADE = 26;

/** Quanto o turbo aquece o motor por segundo (a barra vai de 0 a 1). */
const AQUECE = 0.3;
/** Quanto o motor esfria sozinho por segundo. */
const RESFRIA = 0.16;
/** Resfriamento extra em cima das setas azuis da pista. */
const RESFRIA_TURBO = 0.9;
/** Tempo com o motor morto depois de fundir. */
const TEMPO_FUNDIDO = 2.4;
/** Temperatura em que o motor volta a funcionar. */
const TEMP_APOS_FUNDIR = 0.25;

/** Velocidade da troca de faixa (faixas por segundo). */
const TROCA_FAIXA = 4.5;
/** Velocidade com que a moto inclina no ar (radianos por segundo). */
const GIRO_NO_AR = 2.6;
/** Inclinação máxima no ar durante o voo comum. */
const GIRO_MAX = 1.3;
/**
 * Velocidade de giro na manobra.
 *
 * Medindo os saltos da pista, o tempo no ar fica entre 0,8 e 1,4 segundo. A
 * 7,5 rad/s a volta consumia 0,84s — praticamente o salto inteiro, sem sobrar
 * margem para endireitar antes de encostar, e quase toda tentativa terminava
 * em capotada. A 9,5 rad/s a volta fecha em 0,66s e sobra tempo de mirar o
 * pouso, que e onde esta a graca da manobra.
 */
const GIRO_MANOBRA = 9.5;
/** Quanto cada volta completa desconta do tempo final. */
const BONUS_POR_MANOBRA = 2;
/**
 * Diferença máxima, em radianos, entre a inclinação da moto e a do chão para
 * o pouso dar certo. Acima disso, capota. ~34 graus.
 */
const LIMITE_POUSO = 0.6;
/** Tempo parado depois de capotar. */
const TEMPO_CAPOTADO = 1.8;

/* ------------------------------------------------------------------ */
/* Pista                                                               */
/* ------------------------------------------------------------------ */

export interface Rampa {
  x: number;
  comprimento: number;
  altura: number;
  /** -1 significa "atravessa todas as faixas". */
  faixa: number;
}

export interface Lama {
  x: number;
  comprimento: number;
  faixa: number;
}

/** Trecho que resfria o motor depressa (as setas azuis do original). */
export interface Resfriador {
  x: number;
  comprimento: number;
  faixa: number;
}

export interface Pista {
  rampas: Rampa[];
  lamas: Lama[];
  resfriadores: Resfriador[];
}

/**
 * Sorteio com semente fixa.
 *
 * A pista precisa ser sempre a mesma: num jogo contra o relógio, o jogador
 * melhora porque aprende o percurso. Pista sorteada a cada partida tornaria o
 * recorde sem sentido.
 */
function sorteador(semente: number) {
  let estado = semente >>> 0;
  return () => {
    // Gerador linear congruente: simples e suficiente para posicionar obstáculos.
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

export function criarPista(semente = 20260905): Pista {
  const sorteia = sorteador(semente);
  const rampas: Rampa[] = [];
  const lamas: Lama[] = [];
  const resfriadores: Resfriador[] = [];

  // Os primeiros 60 metros ficam limpos, para dar tempo de pegar velocidade.
  let x = 60;
  while (x < COMPRIMENTO - 60) {
    const tipo = sorteia();

    if (tipo < 0.55) {
      // A rampa e definida pelo ANGULO da ponta, nao pelo comprimento: e esse
      // angulo que decide a altura do salto e o quanto a moto sai inclinada.
      // Entre 24 e 40 graus - o suficiente para exigir endireitar no ar.
      const progresso = x / COMPRIMENTO;
      const angulo = 0.42 + sorteia() * 0.28;
      const altura = 1.4 + sorteia() * (1 + progresso * 1.2);
      // Vem da derivada do formato da rampa: inclinacao = altura * 1.5 / comprimento.
      const comprimento = (altura * 1.5) / Math.tan(angulo);
      // Metade atravessa a pista inteira; as outras pegam uma faixa só,
      // então dá para escolher entre saltar e desviar.
      const faixa = sorteia() < 0.5 ? -1 : Math.floor(sorteia() * FAIXAS);
      rampas.push({ x, comprimento, altura, faixa });
      x += comprimento + 12 + sorteia() * 16;
    } else if (tipo < 0.8) {
      const comprimento = 8 + sorteia() * 10;
      lamas.push({ x, comprimento, faixa: Math.floor(sorteia() * FAIXAS) });
      x += comprimento + 10 + sorteia() * 14;
    } else {
      const comprimento = 10 + sorteia() * 8;
      resfriadores.push({
        x,
        comprimento,
        faixa: Math.floor(sorteia() * FAIXAS),
      });
      x += comprimento + 12 + sorteia() * 16;
    }
  }

  return { rampas, lamas, resfriadores };
}

function pegaFaixa(faixaDoObjeto: number, faixa: number) {
  return faixaDoObjeto === -1 || faixaDoObjeto === faixa;
}

/**
 * Altura do chão num ponto da pista.
 *
 * A rampa sobe cada vez mais forte até o fim e aí termina de repente — é essa
 * quebra que arremessa a moto.
 */
export function alturaDoChao(pista: Pista, x: number, faixa: number): number {
  let altura = 0;
  for (const r of pista.rampas) {
    if (!pegaFaixa(r.faixa, faixa)) continue;
    if (x < r.x || x > r.x + r.comprimento) continue;
    const t = (x - r.x) / r.comprimento;
    altura = Math.max(altura, r.altura * Math.pow(t, 1.5));
  }
  return altura;
}

export function temLama(pista: Pista, x: number, faixa: number): boolean {
  return pista.lamas.some(
    (l) => l.faixa === faixa && x >= l.x && x <= l.x + l.comprimento,
  );
}

export function temResfriador(pista: Pista, x: number, faixa: number): boolean {
  return pista.resfriadores.some(
    (r) => r.faixa === faixa && x >= r.x && x <= r.x + r.comprimento,
  );
}

/* ------------------------------------------------------------------ */
/* Estado da moto                                                      */
/* ------------------------------------------------------------------ */

export interface Comandos {
  acelerar: boolean;
  /**
   * O mesmo botão tem dois sentidos: no chão acelera; no ar, gira a moto para
   * a manobra. Reaproveitar o botão evita inventar um controle novo, e a
   * descoberta acontece sozinha — quem segura o turbo no ar vê a moto girar.
   */
  turbo: boolean;
  /** -1 sobe, 1 desce, 0 nada. No chão troca de faixa; no ar, inclina. */
  vertical: number;
}

export interface EstadoCorrida {
  /** Distância percorrida, em metros. */
  x: number;
  velocidade: number;
  /** Faixa de destino (inteiro) e a posição visual, que persegue o destino. */
  faixa: number;
  faixaVisual: number;
  /** Altura e velocidade vertical. */
  y: number;
  vy: number;
  noAr: boolean;
  /** Inclinação da moto, em radianos. Positivo = nariz para cima. */
  inclinacao: number;
  /** Temperatura do motor, de 0 a 1. */
  temperatura: number;
  fundido: boolean;
  tempoFundido: number;
  capotado: boolean;
  tempoCapotado: number;
  tempo: number;
  terminou: boolean;
  /** Quanto a moto já girou neste salto, em radianos (sempre positivo). */
  rotacaoNoSalto: number;
  /** Voltas completas fechadas com pouso limpo, na corrida toda. */
  manobras: number;
  /** Desconto de tempo acumulado pelas manobras, em segundos. */
  bonus: number;
  /** Velocidade vertical imposta pelo chão no passo anterior. */
  vyChao: number;
  /** Impede trocar várias faixas com um toque só. */
  esperaFaixa: number;
}

export function criarEstado(): EstadoCorrida {
  return {
    x: 0,
    velocidade: 0,
    faixa: 1,
    faixaVisual: 1,
    y: 0,
    vy: 0,
    noAr: false,
    inclinacao: 0,
    temperatura: 0,
    fundido: false,
    tempoFundido: 0,
    capotado: false,
    tempoCapotado: 0,
    tempo: 0,
    terminou: false,
    rotacaoNoSalto: 0,
    manobras: 0,
    bonus: 0,
    vyChao: 0,
    esperaFaixa: 0,
  };
}

export interface Eventos {
  decolou: boolean;
  pousou: boolean;
  /** Voltas completas fechadas neste pouso. Zero na maioria dos pousos. */
  manobras: number;
  capotou: boolean;
  fundiu: boolean;
  terminou: boolean;
}

const SEM_EVENTOS: Eventos = {
  decolou: false,
  pousou: false,
  manobras: 0,
  capotou: false,
  fundiu: false,
  terminou: false,
};

/** Inclinação do chão (em radianos) num ponto, medida por diferença finita. */
export function inclinacaoDoChao(pista: Pista, x: number, faixa: number) {
  const d = 0.4;
  const antes = alturaDoChao(pista, x - d, faixa);
  const depois = alturaDoChao(pista, x + d, faixa);
  return Math.atan2(depois - antes, d * 2);
}

/**
 * Avança a simulação em um passo de tempo fixo.
 * Modifica o estado recebido e devolve o que aconteceu de notável.
 */
export function passo(
  estado: EstadoCorrida,
  pista: Pista,
  comandos: Comandos,
  dt: number,
): Eventos {
  const eventos = { ...SEM_EVENTOS };
  if (estado.terminou) return eventos;

  estado.tempo += dt;
  if (estado.esperaFaixa > 0) estado.esperaFaixa -= dt;

  /* --- Capotado: fica parado alguns instantes e volta --- */
  if (estado.capotado) {
    estado.tempoCapotado -= dt;
    estado.velocidade = Math.max(0, estado.velocidade - FREIO_FORTE * dt);
    estado.x += estado.velocidade * dt;
    estado.y = alturaDoChao(pista, estado.x, estado.faixa);
    if (estado.tempoCapotado <= 0) {
      estado.capotado = false;
      estado.inclinacao = 0;
      estado.vy = 0;
      estado.vyChao = 0;
      estado.rotacaoNoSalto = 0;
      estado.noAr = false;
    }
    return eventos;
  }

  /* --- Motor --- */
  if (estado.fundido) {
    estado.tempoFundido -= dt;
    if (estado.tempoFundido <= 0) {
      estado.fundido = false;
      estado.temperatura = TEMP_APOS_FUNDIR;
    }
  } else {
    // No ar o turbo vira manobra, entao nao aquece: a roda nem esta no chao.
    const turbo = comandos.turbo && comandos.acelerar && !estado.noAr;
    if (turbo) {
      estado.temperatura += AQUECE * dt;
      if (estado.temperatura >= 1) {
        estado.temperatura = 1;
        estado.fundido = true;
        estado.tempoFundido = TEMPO_FUNDIDO;
        eventos.fundiu = true;
      }
    } else {
      // Em cima de um resfriador a queda é bem mais rápida: é o convite para
      // usar o turbo sem medo naquele trecho.
      const taxa = temResfriador(pista, estado.x, estado.faixa)
        ? RESFRIA_TURBO
        : RESFRIA;
      estado.temperatura = Math.max(0, estado.temperatura - taxa * dt);
    }
  }

  /* --- Velocidade --- */
  const naLama = !estado.noAr && temLama(pista, estado.x, estado.faixa);
  let alvo = 0;
  if (!estado.fundido && comandos.acelerar) {
    alvo = comandos.turbo ? V_TURBO : V_NORMAL;
  }
  if (naLama) alvo = Math.min(alvo, V_LAMA);

  if (alvo > estado.velocidade) {
    // No ar a moto quase não ganha velocidade: o acelerador não encosta no chão.
    const ganho = estado.noAr ? ACELERACAO * 0.15 : ACELERACAO;
    estado.velocidade = Math.min(alvo, estado.velocidade + ganho * dt);
  } else {
    const perda = estado.fundido || naLama ? FREIO_FORTE : DESACELERACAO;
    estado.velocidade = Math.max(alvo, estado.velocidade - perda * dt);
  }

  estado.x += estado.velocidade * dt;

  /* --- Faixa e inclinação --- */
  if (estado.noAr && comandos.turbo) {
    // Manobra: giro solto e rapido, sem limite de inclinacao. O sentido padrao
    // e para tras (salto mortal); com a seta para baixo, gira para frente.
    const sentido = comandos.vertical > 0 ? -1 : 1;
    const giro = sentido * GIRO_MANOBRA * dt;
    estado.inclinacao += giro;
    estado.rotacaoNoSalto += Math.abs(giro);
  } else if (estado.noAr) {
    // Voo comum: o comando vertical inclina a moto para mirar o pouso.
    estado.inclinacao -= comandos.vertical * GIRO_NO_AR * dt;
    // O limite so vale enquanto nenhuma manobra foi tentada neste salto —
    // senao ele desfaria a volta no instante em que o botao fosse solto.
    if (estado.rotacaoNoSalto === 0) {
      estado.inclinacao = Math.max(
        -GIRO_MAX,
        Math.min(GIRO_MAX, estado.inclinacao),
      );
    }
  } else if (comandos.vertical !== 0 && estado.esperaFaixa <= 0) {
    const destino = estado.faixa + comandos.vertical;
    if (destino >= 0 && destino < FAIXAS) {
      estado.faixa = destino;
      estado.esperaFaixa = 1 / TROCA_FAIXA;
    }
  }

  // A posição visual persegue a faixa escolhida, para o movimento ser suave.
  const passoFaixa = TROCA_FAIXA * dt;
  const diferenca = estado.faixa - estado.faixaVisual;
  estado.faixaVisual +=
    Math.sign(diferenca) * Math.min(Math.abs(diferenca), passoFaixa);

  /* --- Voo e pouso --- */
  const chao = alturaDoChao(pista, estado.x, estado.faixa);

  if (estado.noAr) {
    estado.vy -= GRAVIDADE * dt;
    estado.y += estado.vy * dt;

    if (estado.y <= chao) {
      estado.y = chao;
      estado.noAr = false;
      estado.vy = 0;
      // Sem zerar isto, o quadro seguinte compara com a subida da rampa e
      // acha que a moto decolou de novo, no meio do chao plano.
      estado.vyChao = 0;
      eventos.pousou = true;

      const anguloChao = inclinacaoDoChao(pista, estado.x, estado.faixa);
      // A diferenca precisa dar a volta no circulo: depois de um salto mortal
      // a inclinacao vale 6,3 radianos, que e a mesma coisa que zero. Sem
      // normalizar, toda manobra completa terminaria em capotada.
      const bruta = estado.inclinacao - anguloChao;
      const erro = Math.abs(Math.atan2(Math.sin(bruta), Math.cos(bruta)));

      if (erro > LIMITE_POUSO) {
        estado.capotado = true;
        estado.tempoCapotado = TEMPO_CAPOTADO;
        eventos.capotou = true;
      } else {
        // Pouso torto, mas dentro do limite: perde um pouco de velocidade.
        estado.velocidade *= 1 - (erro / LIMITE_POUSO) * 0.35;
        estado.inclinacao = anguloChao;

        // Volta fechada e pouso limpo: vale desconto no tempo final.
        const voltas = Math.floor(estado.rotacaoNoSalto / (Math.PI * 2));
        if (voltas > 0) {
          estado.manobras += voltas;
          estado.bonus += voltas * BONUS_POR_MANOBRA;
          eventos.manobras = voltas;
        }
      }
      estado.rotacaoNoSalto = 0;
    }
  } else {
    // No chão, a moto acompanha o relevo. Guardamos a velocidade vertical que
    // o terreno impõe: é ela que vira impulso quando a rampa termina.
    const vyChaoAgora = (chao - estado.y) / dt;
    const caindoMaisRapidoQueGravidade =
      vyChaoAgora < estado.vyChao - GRAVIDADE * dt;

    if (caindoMaisRapidoQueGravidade && estado.velocidade > 4) {
      // O chão sumiu debaixo da moto: é uma decolagem.
      estado.noAr = true;
      estado.vy = estado.vyChao;
      eventos.decolou = true;
    } else {
      estado.y = chao;
      estado.vyChao = vyChaoAgora;
      // Parada no chão, a moto se alinha com o relevo.
      const anguloChao = inclinacaoDoChao(pista, estado.x, estado.faixa);
      estado.inclinacao += (anguloChao - estado.inclinacao) * Math.min(1, dt * 10);
    }
  }

  if (estado.x >= COMPRIMENTO) {
    estado.x = COMPRIMENTO;
    estado.terminou = true;
    eventos.terminou = true;
  }

  return eventos;
}

/**
 * Tempo que vale para o recorde: o cronometro menos o desconto das manobras.
 * Nunca fica negativo.
 */
export function tempoFinal(estado: EstadoCorrida): number {
  return Math.max(0, estado.tempo - estado.bonus);
}

/** Formata segundos como "1:23.45". */
export function formataTempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
