/**
 * Livro de aberturas.
 *
 * É pequeno de propósito e cobre o que aparece de fato numa partida amadora.
 * A chave é a sequência de lances desde o início, em notação portuguesa.
 *
 * Uma ressalva honesta: isto não é um banco de dados de milhões de partidas.
 * São linhas clássicas com a ideia por trás explicada — o suficiente para
 * entender o que se está fazendo nos primeiros lances, que é onde a maioria
 * joga no automático.
 */

export interface Abertura {
  nome: string;
  ideia: string;
}

/** Sequência de lances (separados por espaço) para nome e ideia. */
export const ABERTURAS: Record<string, Abertura> = {
  e4: {
    nome: "Abertura do Rei",
    ideia:
      "Ocupa o centro e abre caminho para o bispo e para a dama de uma vez só. É o lance mais jogado da história.",
  },
  d4: {
    nome: "Abertura da Dama",
    ideia:
      "Também ocupa o centro, mas com um peão já defendido pela dama. Costuma dar partidas mais fechadas e de manobra.",
  },
  c4: {
    nome: "Abertura Inglesa",
    ideia:
      "Pressiona a casa d5 pelo lado, sem se comprometer com o centro ainda. Jogo mais flexível.",
  },
  Cf3: {
    nome: "Abertura Réti",
    ideia:
      "Desenvolve antes de decidir a estrutura de peões. Deixa as opções em aberto e evita as linhas mais estudadas.",
  },

  "e4 e5": {
    nome: "Jogo Aberto",
    ideia:
      "As pretas respondem no espelho e disputam o centro de igual para igual. Leva às aberturas clássicas.",
  },
  "e4 c5": {
    nome: "Defesa Siciliana",
    ideia:
      "Em vez de copiar, as pretas atacam o centro pelo lado. É a resposta mais popular a 1.e4 e costuma dar jogo desequilibrado.",
  },
  "e4 e6": {
    nome: "Defesa Francesa",
    ideia:
      "Prepara d5 para desafiar o centro no lance seguinte. O preço é o bispo de casas claras, que fica preso atrás dos peões.",
  },
  "e4 c6": {
    nome: "Defesa Caro-Kann",
    ideia:
      "Como a Francesa, prepara d5 — mas mantendo o bispo de casas claras livre. Sólida e difícil de atacar.",
  },
  "d4 d5": {
    nome: "Jogo Fechado",
    ideia: "Centro travado desde o começo. A partida se decide nas manobras.",
  },
  "d4 Cf6": {
    nome: "Defesas Índias",
    ideia:
      "As pretas atrasam d5 e controlam o centro à distância, com as peças. Família enorme de aberturas modernas.",
  },

  "e4 e5 Cf3": {
    nome: "Ataque ao peão e5",
    ideia:
      "Desenvolve com ameaça: o cavalo já ataca o peão e5 e as pretas precisam responder.",
  },
  "e4 e5 Cf3 Cc6": {
    nome: "Defesa do peão",
    ideia: "O cavalo defende e5 e desenvolve ao mesmo tempo. Lance natural.",
  },
  "e4 e5 Cf3 Cc6 Bb5": {
    nome: "Abertura Espanhola (Ruy López)",
    ideia:
      "O bispo mira o cavalo que defende e5. Pressiona sem trocar nada e é estudada há quinhentos anos.",
  },
  "e4 e5 Cf3 Cc6 Bc4": {
    nome: "Abertura Italiana",
    ideia:
      "O bispo aponta para f7, a casa mais fraca das pretas no começo. Jogo direto e franco.",
  },
  "e4 e5 Cf3 Cc6 Bc4 Bc5": {
    nome: "Giuoco Piano",
    ideia:
      "As duas partes desenvolvem apontando para o ponto fraco do adversário. Posição equilibrada e clássica.",
  },
  "e4 e5 Cf3 Cf6": {
    nome: "Defesa Russa (Petrov)",
    ideia:
      "Em vez de defender, as pretas contra-atacam o peão e4. Costuma levar a trocas e posições simétricas.",
  },
  "d4 d5 c4": {
    nome: "Gambito da Dama",
    ideia:
      "Oferece um peão para desviar o peão de d5 e ficar com o centro. Aceitar não é fácil de sustentar.",
  },
  "d4 Cf6 c4": {
    nome: "Índias com c4",
    ideia: "Fecha o centro com dois peões e disputa espaço no flanco da dama.",
  },
  "e4 c5 Cf3": {
    nome: "Siciliana Aberta",
    ideia:
      "Prepara d4 para abrir o centro. É a linha principal contra a Siciliana.",
  },
};

/** Procura a abertura pela sequência de lances jogados. */
export function acharAbertura(historico: string[]): Abertura | null {
  // Da linha mais longa para a mais curta: queremos o nome mais específico.
  for (let n = Math.min(historico.length, 6); n >= 1; n--) {
    const chave = historico.slice(0, n).join(" ");
    if (ABERTURAS[chave]) return ABERTURAS[chave];
  }
  return null;
}
