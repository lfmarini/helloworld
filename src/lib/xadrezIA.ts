/**
 * O adversário e o assistente.
 *
 * São duas coisas no mesmo arquivo porque usam a mesma avaliação: a máquina
 * escolhe o lance que ela considera melhor, e o assistente traduz esse mesmo
 * raciocínio em português.
 */

import {
  VAZIO,
  adversaria,
  aplicar,
  casaAtacada,
  coluna,
  corDa,
  emXeque,
  lancesLegais,
  linha,
  nomeDaCasa,
  nomeDaPeca,
  situacao,
  type Cor,
  type Lance,
  type Peca,
  type Posicao,
} from "./xadrez";

/* ------------------------------------------------------------------ */
/* Avaliação                                                           */
/* ------------------------------------------------------------------ */

/** Valor das peças em centésimos de peão — a escala usada em xadrez. */
export const VALOR: Record<string, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20000,
};

/**
 * Tabelas de casa por peça: quanto vale ter aquela peça naquela casa.
 *
 * São a forma mais simples de ensinar posicionamento a um programa. Elas
 * codificam conselhos que todo livro repete: cavalo no centro vale mais que
 * na borda, peão que avança vale mais, rei fica melhor no canto na abertura.
 *
 * As tabelas estão na perspectiva das brancas, da 8ª para a 1ª fileira.
 */
const TABELAS: Record<string, number[]> = {
  P: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  N: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  B: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  R: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  Q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  K: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

/** A casa vista do lado da peça: para as pretas, a tabela é espelhada. */
const casaNaTabela = (casa: number, cor: Cor) =>
  cor === "brancas" ? casa : (7 - linha(casa)) * 8 + coluna(casa);

/**
 * Princípios de abertura, valendo só nos primeiros lances.
 *
 * Sem isto o programa joga por material e mais nada — e chega a sugerir sair
 * com a dama no segundo lance porque assim defende um peão. Funciona no
 * cálculo e é péssimo conselho: num jogo que se propõe a ensinar, a sugestão
 * precisa ser um lance que um professor assinaria embaixo.
 *
 * São três regras que todo manual repete: desenvolva as peças menores,
 * não passeie com a dama antes disso, e roque cedo.
 */
function notaDeAbertura(p: Posicao, cor: Cor): number {
  const t = p.tabuleiro;
  const casaDeCasa = cor === "brancas" ? 7 : 0;
  const eu = (letra: string) => (cor === "brancas" ? letra : letra.toLowerCase());
  let nota = 0;
  let menoresEmCasa = 0;

  // Cavalos e bispos que já saíram da primeira fileira
  for (const col of [1, 2, 5, 6]) {
    const peca = t[casaDeCasa * 8 + col];
    if (peca === eu("N") || peca === eu("B")) menoresEmCasa++;
  }
  nota += (4 - menoresEmCasa) * 14;

  /*
   * Dama passeando na abertura: desconto FIXO, e nao proporcional ao atraso.
   *
   * A primeira versao descontava por peca menor ainda em casa. Parecia mais
   * fino, mas a busca descobriu a brecha: como o desconto encolhia a cada peca
   * desenvolvida, saia com a dama, desenvolvia em seguida e recuperava quase
   * tudo. Medindo, "Df3" valia -86 parado e +83 depois da busca. Com desconto
   * fixo nao ha o que recuperar, que e o espirito da regra: dama cedo e ruim
   * enquanto for abertura, ponto.
   */
  const damaEmCasa = t[casaDeCasa * 8 + 3] === eu("Q");
  const temDama = t.includes(eu("Q"));
  if (temDama && !damaEmCasa) nota -= 55;

  // Rei fora do centro, sinal de que rocou
  const casaDoReiAtual = t.indexOf(eu("K"));
  const colunaDoRei = casaDoReiAtual >= 0 ? coluna(casaDoReiAtual) : 4;
  if (colunaDoRei <= 2 || colunaDoRei >= 6) nota += 28;

  return nota;
}

/**
 * Nota da posição, em centésimos de peão.
 * Positivo favorece as brancas; negativo, as pretas.
 */
export function avaliar(p: Posicao): number {
  let nota = 0;
  let pecas = 0;
  for (let casa = 0; casa < 64; casa++) {
    const peca = p.tabuleiro[casa];
    if (peca === VAZIO) continue;
    pecas++;
    const tipo = peca.toUpperCase();
    const cor = corDa(peca)!;
    const valor = VALOR[tipo] + TABELAS[tipo][casaNaTabela(casa, cor)];
    nota += cor === "brancas" ? valor : -valor;
  }

  // Os princípios de abertura só valem enquanto ainda é abertura. Num final
  // com poucas peças, tirar a dama de casa e centralizar o rei é o certo.
  if (pecas >= 26) {
    nota += notaDeAbertura(p, "brancas") - notaDeAbertura(p, "pretas");
  }

  return nota;
}

/* ------------------------------------------------------------------ */
/* Busca                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ordena os lances para a poda funcionar melhor.
 *
 * Alfa-beta corta ramos assim que descobre que eles não podem ser melhores.
 * Se os lances bons vierem primeiro, ela corta muito mais cedo — por isso vale
 * olhar capturas de peça grande por peça pequena antes de qualquer outra coisa.
 */
function ordenar(p: Posicao, lances: Lance[]): Lance[] {
  const nota = (l: Lance) => {
    const capturada = p.tabuleiro[l.para];
    let n = 0;
    if (capturada !== VAZIO) {
      const atacante = p.tabuleiro[l.de].toUpperCase();
      n += 10 * VALOR[capturada.toUpperCase()] - VALOR[atacante];
    }
    if (l.promocao) n += VALOR[l.promocao.toUpperCase()];
    return n;
  };
  return [...lances].sort((a, b) => nota(b) - nota(a));
}

const MATE = 100000;

function buscar(
  p: Posicao,
  profundidade: number,
  alfa: number,
  beta: number,
): number {
  const lances = lancesLegais(p);

  if (lances.length === 0) {
    // Sem lance: ou é mate (péssimo para quem joga) ou afogamento (empate).
    if (emXeque(p, p.vez)) {
      return p.vez === "brancas" ? -MATE - profundidade : MATE + profundidade;
    }
    return 0;
  }
  if (profundidade === 0) return avaliar(p);

  const maximizando = p.vez === "brancas";
  let melhor = maximizando ? -Infinity : Infinity;

  for (const lance of ordenar(p, lances)) {
    const nota = buscar(aplicar(p, lance), profundidade - 1, alfa, beta);
    if (maximizando) {
      melhor = Math.max(melhor, nota);
      alfa = Math.max(alfa, nota);
    } else {
      melhor = Math.min(melhor, nota);
      beta = Math.min(beta, nota);
    }
    if (beta <= alfa) break; // este ramo já não pode mudar o resultado
  }
  return melhor;
}

export interface LanceAvaliado {
  lance: Lance;
  nota: number;
}

/**
 * Desempate por princípio, aplicado só na escolha final.
 *
 * Duas coisas justificam existir. A primeira é que este programa enxerga três
 * lances à frente, e várias diferenças de abertura só aparecem em dez — a
 * conta empata onde o princípio decide. A segunda é o propósito: num jogo que
 * se propõe a ensinar, a sugestão precisa ser um lance que um professor
 * assinaria embaixo, e não o lance que ganha por um centésimo de peão.
 *
 * Vale só na abertura, e o valor é pequeno: qualquer ganho material de
 * verdade passa por cima disto.
 */
function bonusDePrincipio(p: Posicao, lance: Lance): number {
  const pecas = p.tabuleiro.filter((x) => x !== VAZIO).length;
  if (pecas < 26) return 0; // já não é abertura

  const peca = p.tabuleiro[lance.de];
  const tipo = peca.toUpperCase();
  const cor = corDa(peca)!;
  const primeiraFileira = cor === "brancas" ? 7 : 0;

  if (lance.especial === "roquePequeno" || lance.especial === "roqueGrande") {
    return 60;
  }
  if ((tipo === "N" || tipo === "B") && linha(lance.de) === primeiraFileira) {
    return 45; // tira uma peça menor da primeira fileira
  }
  if (tipo === "Q" && linha(lance.de) === primeiraFileira) {
    return -60; // passeio de dama antes da hora
  }
  if (tipo === "K") {
    return -35; // mexer o rei a pé perde o direito de rocar
  }
  return 0;
}

/**
 * Avalia todos os lances da vez e devolve ordenados do melhor para o pior,
 * na perspectiva de quem está jogando.
 */
export function avaliarLances(p: Posicao, profundidade = 3): LanceAvaliado[] {
  const lances = ordenar(p, lancesLegais(p));
  const avaliados = lances.map((lance) => ({
    lance,
    nota: buscar(aplicar(p, lance), profundidade - 1, -Infinity, Infinity),
  }));

  // A nota é absoluta (positivo favorece as brancas); aqui passamos para a
  // perspectiva de quem joga, somamos o princípio e ordenamos.
  const sinal = p.vez === "brancas" ? 1 : -1;
  return avaliados
    .map((a) => ({ ...a, ajustada: sinal * a.nota + bonusDePrincipio(p, a.lance) }))
    .sort((a, b) => b.ajustada - a.ajustada)
    .map(({ lance, nota }) => ({ lance, nota }));
}

export function melhorLance(p: Posicao, profundidade = 3): Lance | null {
  const avaliados = avaliarLances(p, profundidade);
  return avaliados.length ? avaliados[0].lance : null;
}

/* ------------------------------------------------------------------ */
/* Leitura da posição, para as explicações                             */
/* ------------------------------------------------------------------ */

const CENTRO = ["d4", "e4", "d5", "e5"].map((n) => {
  const c = "abcdefgh".indexOf(n[0]);
  const l = 8 - Number(n[1]);
  return l * 8 + c;
});

/** A peça nesta casa está atacada e não tem quem a defenda? */
export function estaPendurada(p: Posicao, casa: number): boolean {
  const peca = p.tabuleiro[casa];
  if (peca === VAZIO) return false;
  const cor = corDa(peca)!;
  const atacada = casaAtacada(p, casa, adversaria(cor));
  if (!atacada) return false;
  // Para saber se está defendida, fingimos que a casa está vazia e vemos se
  // alguém da mesma cor ainda alcança aquela casa.
  const semAPeca = { ...p, tabuleiro: [...p.tabuleiro] };
  semAPeca.tabuleiro[casa] = VAZIO;
  return !casaAtacada(semAPeca, casa, cor);
}

/** Peças de uma cor que estão penduradas, da mais valiosa para a menos. */
export function pecasPenduradas(p: Posicao, cor: Cor): number[] {
  const casas: number[] = [];
  for (let casa = 0; casa < 64; casa++) {
    const peca = p.tabuleiro[casa];
    if (peca === VAZIO || corDa(peca) !== cor) continue;
    if (peca.toUpperCase() === "K") continue;
    if (estaPendurada(p, casa)) casas.push(casa);
  }
  return casas.sort(
    (a, b) =>
      VALOR[p.tabuleiro[b].toUpperCase()] - VALOR[p.tabuleiro[a].toUpperCase()],
  );
}

/** Quais peças adversárias a peça em `casa` está atacando. */
function atacando(p: Posicao, casa: number): number[] {
  const peca = p.tabuleiro[casa];
  if (peca === VAZIO) return [];
  const cor = corDa(peca)!;
  const alvos: number[] = [];
  // Reaproveitamos a geração de lances: aonde ela consegue ir e tem peça
  // adversária, ela está atacando.
  for (const l of lancesLegais(p, cor)) {
    if (l.de !== casa) continue;
    const destino = p.tabuleiro[l.para];
    if (destino !== VAZIO && corDa(destino) !== cor) alvos.push(l.para);
  }
  return alvos;
}

/* ------------------------------------------------------------------ */
/* Explicações                                                         */
/* ------------------------------------------------------------------ */

const ARTIGO: Record<string, string> = {
  rei: "o rei",
  dama: "a dama",
  torre: "a torre",
  bispo: "o bispo",
  cavalo: "o cavalo",
  peão: "o peão",
};

const comArtigo = (peca: Peca) => ARTIGO[nomeDaPeca(peca)] ?? "a peça";

/**
 * Explica um lance em português, olhando o que ele faz de concreto.
 *
 * A ordem importa: primeiro o que decide a partida (mate, xeque, captura
 * grande), depois o que é bom princípio (desenvolver, rocar, centro). É a
 * mesma ordem em que um professor comentaria o lance.
 */
export function explicarLance(p: Posicao, lance: Lance): string {
  const peca = p.tabuleiro[lance.de];
  const cor = corDa(peca)!;
  const capturada = p.tabuleiro[lance.para];
  const depois = aplicar(p, lance);
  const partes: string[] = [];

  const fim = situacao(depois);
  if (fim === "vitoriaDasBrancas" || fim === "vitoriaDasPretas") {
    return "Xeque-mate. A partida acaba aqui.";
  }
  if (fim === "afogamento") {
    return "Cuidado: deixa o adversário afogado, sem lance legal, e a partida empata.";
  }

  // 1. Captura
  if (capturada !== VAZIO) {
    const valorGanho = VALOR[capturada.toUpperCase()];
    const valorArriscado = VALOR[peca.toUpperCase()];
    const seguro = !casaAtacada(depois, lance.para, adversaria(cor));
    if (seguro) {
      partes.push(`ganha ${comArtigo(capturada)} de graça`);
    } else if (valorGanho > valorArriscado) {
      partes.push(
        `troca ${comArtigo(peca)} por ${comArtigo(capturada)}, que vale mais`,
      );
    } else if (valorGanho === valorArriscado) {
      partes.push(`troca ${comArtigo(peca)} por ${comArtigo(capturada)}`);
    } else {
      partes.push(`captura ${comArtigo(capturada)}, mas a casa está defendida`);
    }
  } else if (lance.especial === "enPassant") {
    partes.push("captura o peão en passant");
  }

  // 2. Xeque
  if (emXeque(depois, adversaria(cor))) {
    partes.push("dá xeque e obriga o adversário a responder");
  }

  // 3. Promoção
  if (lance.promocao) {
    partes.push(`promove o peão a ${nomeDaPeca(lance.promocao)}`);
  }

  // 4. Roque
  if (lance.especial === "roquePequeno" || lance.especial === "roqueGrande") {
    partes.push(
      "põe o rei em segurança no canto e traz a torre para o jogo — os dois de uma vez",
    );
  }

  // 5. Tirar peça de perigo
  if (estaPendurada(p, lance.de) && !estaPendurada(depois, lance.para)) {
    partes.push(`tira ${comArtigo(peca)} de um ataque`);
  }

  // 6. Ataque duplo
  const alvos = atacando(depois, lance.para).filter(
    (c) => depois.tabuleiro[c].toUpperCase() !== "K",
  );
  if (alvos.length >= 2) {
    partes.push(
      `ataca duas peças ao mesmo tempo (${alvos.map(nomeDaCasa).join(" e ")}) — o adversário só salva uma`,
    );
  } else if (alvos.length === 1 && estaPendurada(depois, alvos[0])) {
    partes.push(
      `ameaça ${comArtigo(depois.tabuleiro[alvos[0]])} em ${nomeDaCasa(alvos[0])}, que está sem defesa`,
    );
  }

  // 7. Princípios de abertura
  const tipo = peca.toUpperCase();
  const linhaDeCasa = cor === "brancas" ? 7 : 0;
  if (
    (tipo === "N" || tipo === "B") &&
    linha(lance.de) === linhaDeCasa &&
    partes.length === 0
  ) {
    partes.push(
      `desenvolve ${comArtigo(peca)}, tirando mais uma peça da primeira fileira`,
    );
  }
  if (tipo === "P" && CENTRO.includes(lance.para) && partes.length === 0) {
    partes.push("ocupa o centro, que é de onde as peças alcançam mais casas");
  }
  if (
    tipo !== "P" &&
    tipo !== "K" &&
    CENTRO.includes(lance.para) &&
    partes.length === 0
  ) {
    partes.push("leva a peça para o centro, onde ela vale mais");
  }

  if (partes.length === 0) {
    // Nada de marcante: explica pelo ganho de mobilidade.
    const antes = lancesLegais(p, cor).length;
    const agora = lancesLegais({ ...depois, vez: cor }, cor).length;
    partes.push(
      agora > antes
        ? "melhora a posição da peça e abre mais opções para o próximo lance"
        : "lance de arrumação: melhora a peça sem mudar nada de imediato",
    );
  }

  const texto = partes.join("; ");
  return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
}

/* ------------------------------------------------------------------ */
/* Análise da posição                                                  */
/* ------------------------------------------------------------------ */

export interface Analise {
  /** Alertas sobre o que está em risco agora. */
  avisos: string[];
  /** Lances sugeridos, do melhor para o pior, com a explicação de cada um. */
  sugestoes: { lance: Lance; explicacao: string; nota: number }[];
  /** Nota da posição em peões, na perspectiva de quem joga. */
  vantagem: number;
}

export function analisar(p: Posicao, profundidade = 3, quantas = 3): Analise {
  const avisos: string[] = [];
  const cor = p.vez;

  if (emXeque(p, cor)) {
    avisos.push("Você está em xeque: o lance tem que resolver isso.");
  }

  for (const casa of pecasPenduradas(p, cor).slice(0, 2)) {
    const peca = p.tabuleiro[casa];
    avisos.push(
      `${comArtigo(peca).charAt(0).toUpperCase() + comArtigo(peca).slice(1)} em ${nomeDaCasa(casa)} está atacado e sem defesa.`,
    );
  }

  const capturasBoas = pecasPenduradas(p, adversaria(cor))
    .filter((casa) => casaAtacada(p, casa, cor))
    .slice(0, 1);
  for (const casa of capturasBoas) {
    const peca = p.tabuleiro[casa];
    avisos.push(
      `${comArtigo(peca).charAt(0).toUpperCase() + comArtigo(peca).slice(1)} adversário em ${nomeDaCasa(casa)} está sem defesa — dá para pegar.`,
    );
  }

  const avaliados = avaliarLances(p, profundidade).slice(0, quantas);
  const sugestoes = avaliados.map(({ lance, nota }) => ({
    lance,
    explicacao: explicarLance(p, lance),
    nota,
  }));

  const bruta = avaliados.length ? avaliados[0].nota : avaliar(p);
  const vantagem = (cor === "brancas" ? bruta : -bruta) / 100;

  return { avisos, sugestoes, vantagem };
}

/** Frase curta sobre quem está melhor. */
export function resumoDaVantagem(vantagem: number): string {
  const v = Math.abs(vantagem);
  const quem = vantagem > 0 ? "Você está" : "O computador está";
  if (v < 0.4) return "A posição está equilibrada.";
  if (v < 1.2) return `${quem} um pouco melhor.`;
  if (v < 3) return `${quem} claramente melhor.`;
  if (v < 8) return `${quem} ganhando.`;
  return `${quem} com a partida decidida.`;
}
