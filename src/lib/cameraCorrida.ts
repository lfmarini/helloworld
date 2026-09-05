/**
 * Enquadramento da câmera da corrida.
 *
 * Fica separado da cena 3D, e sem nada de React, para poder ser conferido no
 * Node — sem navegador e sem placa de vídeo. É a mesma ideia de cameraFit.ts:
 * enquadramento é a parte que quebra em silêncio numa tela de formato
 * diferente, e conta melhor com um teste do que com um olhar.
 */

export interface Enquadramento {
  /** Distância da câmera até o plano da pista. */
  recuo: number;
  posicao: [number, number, number];
  mira: [number, number, number];
}

/**
 * Onde pôr a câmera para uma tela e uma posição da moto.
 *
 * Duas decisões estão embutidas aqui:
 *
 * 1. A câmera e a mira têm o MESMO x. É isso que dá a visão lateral de
 *    rolagem: a linha de visada fica perpendicular à pista, então a pista
 *    corre de lado na tela em vez de fugir na diagonal para o horizonte.
 *
 * 2. Esse x comum fica adiantado em relação à moto. A moto encosta no terço
 *    esquerdo da tela e sobra pista à frente — sem isso o jogador só veria a
 *    rampa quando já estivesse em cima dela.
 */
export function enquadramento(
  largura: number,
  altura: number,
  x: number,
  y: number,
): Enquadramento {
  const proporcao = largura / Math.max(1, altura);
  // Tela estreita enxerga menos pista de uma vez, então a câmera recua mais.
  const recuo = proporcao < 1.4 ? 27 : proporcao < 1.9 ? 24 : 22;
  const adiante = x + recuo * 0.3;

  return {
    recuo,
    // Altura escolhida medindo o resultado: mais baixa que isto e as quatro
    // faixas se espremem numa fita fina; mais alta e a vista deixa de parecer
    // lateral e vira quase de cima.
    //
    // A câmera acompanha a altura da moto só em parte: em saltos grandes o
    // chão continua na tela, o que ajuda a mirar o pouso.
    posicao: [adiante, 11 + y * 0.45, recuo],
    // A mira baixa empurra a pista para cima na tela. Isso importa no
    // celular: os botoes de toque ocupam a faixa de baixo, e com a mira alta a
    // pista ficava justamente atras deles.
    mira: [adiante, 0.4 + y * 0.35, 0],
  };
}
