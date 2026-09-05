/**
 * Regras do xadrez.
 *
 * Como nos outros módulos, aqui não entra React nem desenho: só as regras.
 * Isso permite conferir a geração de lances com o teste clássico do xadrez de
 * computador (o "perft"), que conta todas as posições possíveis até uma certa
 * profundidade e compara com números conhecidos há décadas. É um teste
 * implacável: qualquer regra errada — roque, en passant, cravada — muda a
 * contagem.
 *
 * O tabuleiro é um vetor de 64 casas. A casa 0 é a8 (canto superior esquerdo,
 * como aparece na tela) e a 63 é h1. As brancas jogam "para cima", ou seja,
 * subtraindo 8.
 */

export type Cor = "brancas" | "pretas";

/** Peças em letra: maiúscula é branca, minúscula é preta. Vazio é ".". */
export type Peca = string;

export const VAZIO = ".";

export interface Lance {
  de: number;
  para: number;
  /** Peça escolhida ao promover o peão ("Q", "R", "B", "N" na cor de quem joga). */
  promocao?: string;
  /** Marca lances especiais, para o executor saber o que mais mexer. */
  especial?: "roquePequeno" | "roqueGrande" | "enPassant" | "duploDePeao";
}

export interface Posicao {
  tabuleiro: Peca[];
  vez: Cor;
  /** Direitos de roque que ainda existem. */
  roque: { brancasRei: boolean; brancasDama: boolean; pretasRei: boolean; pretasDama: boolean };
  /** Casa que pode ser capturada en passant neste lance, ou -1. */
  enPassant: number;
  /** Lances sem captura nem movimento de peão, para a regra dos 50 lances. */
  meiosLances: number;
  /** Número do lance completo. */
  lance: number;
}

/* ------------------------------------------------------------------ */
/* Utilidades de casa                                                  */
/* ------------------------------------------------------------------ */

export const linha = (casa: number) => casa >> 3;
export const coluna = (casa: number) => casa & 7;
export const dentro = (casa: number) => casa >= 0 && casa < 64;

const COLUNAS = "abcdefgh";

/** Converte casa em notação: 0 vira "a8". */
export function nomeDaCasa(casa: number): string {
  return COLUNAS[coluna(casa)] + (8 - linha(casa));
}

export function casaPeloNome(nome: string): number {
  const c = COLUNAS.indexOf(nome[0]);
  const l = 8 - Number(nome[1]);
  return l * 8 + c;
}

export const ehBranca = (p: Peca) => p !== VAZIO && p === p.toUpperCase();
export const ehPreta = (p: Peca) => p !== VAZIO && p === p.toLowerCase();
export const corDa = (p: Peca): Cor | null =>
  p === VAZIO ? null : ehBranca(p) ? "brancas" : "pretas";
export const adversaria = (c: Cor): Cor => (c === "brancas" ? "pretas" : "brancas");

/* ------------------------------------------------------------------ */
/* Posição inicial                                                     */
/* ------------------------------------------------------------------ */

export function posicaoInicial(): Posicao {
  const tabuleiro = [
    ..."rnbqkbnr",
    ..."pppppppp",
    ...VAZIO.repeat(8),
    ...VAZIO.repeat(8),
    ...VAZIO.repeat(8),
    ...VAZIO.repeat(8),
    ..."PPPPPPPP",
    ..."RNBQKBNR",
  ];
  return {
    tabuleiro,
    vez: "brancas",
    roque: { brancasRei: true, brancasDama: true, pretasRei: true, pretasDama: true },
    enPassant: -1,
    meiosLances: 0,
    lance: 1,
  };
}

export function copiar(p: Posicao): Posicao {
  return {
    tabuleiro: [...p.tabuleiro],
    vez: p.vez,
    roque: { ...p.roque },
    enPassant: p.enPassant,
    meiosLances: p.meiosLances,
    lance: p.lance,
  };
}

/* ------------------------------------------------------------------ */
/* Geração de lances                                                   */
/* ------------------------------------------------------------------ */

/** Direções em (linha, coluna) para cada tipo de peça que desliza. */
const DIRECOES: Record<string, [number, number][]> = {
  R: [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
  B: [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
  Q: [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
};

const SALTOS_CAVALO: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

const PASSOS_REI: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** Casa a partir de linha e coluna, ou -1 se sair do tabuleiro. */
function casaEm(l: number, c: number): number {
  return l < 0 || l > 7 || c < 0 || c > 7 ? -1 : l * 8 + c;
}

/**
 * Lances possíveis ignorando se o rei fica em xeque.
 * A checagem de xeque acontece depois, em lancesLegais.
 */
function lancesPseudoLegais(p: Posicao, cor: Cor): Lance[] {
  const lances: Lance[] = [];
  const t = p.tabuleiro;
  const minha = (peca: Peca) => corDa(peca) === cor;

  for (let casa = 0; casa < 64; casa++) {
    const peca = t[casa];
    if (peca === VAZIO || !minha(peca)) continue;
    const tipo = peca.toUpperCase();
    const l = linha(casa);
    const c = coluna(casa);

    if (tipo === "P") {
      const frente = cor === "brancas" ? -1 : 1;
      const linhaInicial = cor === "brancas" ? 6 : 1;
      const linhaPromocao = cor === "brancas" ? 0 : 7;

      // Um passo à frente
      const umPasso = casaEm(l + frente, c);
      if (umPasso >= 0 && t[umPasso] === VAZIO) {
        if (linha(umPasso) === linhaPromocao) {
          for (const q of ["Q", "R", "B", "N"]) {
            lances.push({ de: casa, para: umPasso, promocao: q });
          }
        } else {
          lances.push({ de: casa, para: umPasso });
          // Dois passos, só da linha inicial e com o caminho livre
          if (l === linhaInicial) {
            const doisPassos = casaEm(l + frente * 2, c);
            if (doisPassos >= 0 && t[doisPassos] === VAZIO) {
              lances.push({ de: casa, para: doisPassos, especial: "duploDePeao" });
            }
          }
        }
      }

      // Capturas na diagonal, inclusive en passant
      for (const dc of [-1, 1]) {
        const alvo = casaEm(l + frente, c + dc);
        if (alvo < 0) continue;
        const naCasa = t[alvo];
        if (naCasa !== VAZIO && corDa(naCasa) !== cor) {
          if (linha(alvo) === linhaPromocao) {
            for (const q of ["Q", "R", "B", "N"]) {
              lances.push({ de: casa, para: alvo, promocao: q });
            }
          } else {
            lances.push({ de: casa, para: alvo });
          }
        } else if (alvo === p.enPassant && naCasa === VAZIO) {
          lances.push({ de: casa, para: alvo, especial: "enPassant" });
        }
      }
      continue;
    }

    if (tipo === "N") {
      for (const [dl, dc] of SALTOS_CAVALO) {
        const alvo = casaEm(l + dl, c + dc);
        if (alvo >= 0 && !minha(t[alvo])) lances.push({ de: casa, para: alvo });
      }
      continue;
    }

    if (tipo === "K") {
      for (const [dl, dc] of PASSOS_REI) {
        const alvo = casaEm(l + dl, c + dc);
        if (alvo >= 0 && !minha(t[alvo])) lances.push({ de: casa, para: alvo });
      }
      continue;
    }

    // Torre, bispo e dama deslizam até esbarrar em alguém
    for (const [dl, dc] of DIRECOES[tipo]) {
      let ll = l + dl;
      let cc = c + dc;
      while (true) {
        const alvo = casaEm(ll, cc);
        if (alvo < 0) break;
        const naCasa = t[alvo];
        if (naCasa === VAZIO) {
          lances.push({ de: casa, para: alvo });
        } else {
          if (!minha(naCasa)) lances.push({ de: casa, para: alvo });
          break;
        }
        ll += dl;
        cc += dc;
      }
    }
  }

  // Roque: só entra aqui, porque depende de xeque e de casas atacadas.
  adicionaRoque(p, cor, lances);
  return lances;
}

function adicionaRoque(p: Posicao, cor: Cor, lances: Lance[]) {
  const t = p.tabuleiro;
  const linhaBase = cor === "brancas" ? 7 : 0;
  const rei = casaEm(linhaBase, 4);
  const pecaRei = cor === "brancas" ? "K" : "k";
  if (t[rei] !== pecaRei) return;
  // Não se roca estando em xeque.
  if (casaAtacada(p, rei, adversaria(cor))) return;

  const podeRei = cor === "brancas" ? p.roque.brancasRei : p.roque.pretasRei;
  const podeDama = cor === "brancas" ? p.roque.brancasDama : p.roque.pretasDama;
  const torre = cor === "brancas" ? "R" : "r";

  if (podeRei) {
    const f1 = casaEm(linhaBase, 5);
    const g1 = casaEm(linhaBase, 6);
    const h1 = casaEm(linhaBase, 7);
    if (
      t[f1] === VAZIO &&
      t[g1] === VAZIO &&
      t[h1] === torre &&
      // O rei não pode passar por casa atacada.
      !casaAtacada(p, f1, adversaria(cor)) &&
      !casaAtacada(p, g1, adversaria(cor))
    ) {
      lances.push({ de: rei, para: g1, especial: "roquePequeno" });
    }
  }

  if (podeDama) {
    const d1 = casaEm(linhaBase, 3);
    const c1 = casaEm(linhaBase, 2);
    const b1 = casaEm(linhaBase, 1);
    const a1 = casaEm(linhaBase, 0);
    if (
      t[d1] === VAZIO &&
      t[c1] === VAZIO &&
      t[b1] === VAZIO &&
      t[a1] === torre &&
      !casaAtacada(p, d1, adversaria(cor)) &&
      !casaAtacada(p, c1, adversaria(cor))
    ) {
      lances.push({ de: rei, para: c1, especial: "roqueGrande" });
    }
  }
}

/** A casa está atacada por alguma peça da cor indicada? */
export function casaAtacada(p: Posicao, casa: number, porCor: Cor): boolean {
  const t = p.tabuleiro;
  const l = linha(casa);
  const c = coluna(casa);

  // Peões: atacam na diagonal, na direção em que andam.
  const frente = porCor === "brancas" ? -1 : 1;
  const peao = porCor === "brancas" ? "P" : "p";
  for (const dc of [-1, 1]) {
    // Quem ataca esta casa está uma linha "atrás" na direção de avanço.
    const origem = casaEm(l - frente, c + dc);
    if (origem >= 0 && t[origem] === peao) return true;
  }

  const cavalo = porCor === "brancas" ? "N" : "n";
  for (const [dl, dc] of SALTOS_CAVALO) {
    const origem = casaEm(l + dl, c + dc);
    if (origem >= 0 && t[origem] === cavalo) return true;
  }

  const rei = porCor === "brancas" ? "K" : "k";
  for (const [dl, dc] of PASSOS_REI) {
    const origem = casaEm(l + dl, c + dc);
    if (origem >= 0 && t[origem] === rei) return true;
  }

  const torre = porCor === "brancas" ? "R" : "r";
  const bispo = porCor === "brancas" ? "B" : "b";
  const dama = porCor === "brancas" ? "Q" : "q";

  for (const [dl, dc] of DIRECOES.R) {
    let ll = l + dl;
    let cc = c + dc;
    while (true) {
      const origem = casaEm(ll, cc);
      if (origem < 0) break;
      const peca = t[origem];
      if (peca !== VAZIO) {
        if (peca === torre || peca === dama) return true;
        break;
      }
      ll += dl;
      cc += dc;
    }
  }

  for (const [dl, dc] of DIRECOES.B) {
    let ll = l + dl;
    let cc = c + dc;
    while (true) {
      const origem = casaEm(ll, cc);
      if (origem < 0) break;
      const peca = t[origem];
      if (peca !== VAZIO) {
        if (peca === bispo || peca === dama) return true;
        break;
      }
      ll += dl;
      cc += dc;
    }
  }

  return false;
}

export function casaDoRei(p: Posicao, cor: Cor): number {
  const rei = cor === "brancas" ? "K" : "k";
  return p.tabuleiro.indexOf(rei);
}

export function emXeque(p: Posicao, cor: Cor): boolean {
  const rei = casaDoRei(p, cor);
  return rei >= 0 && casaAtacada(p, rei, adversaria(cor));
}

/** Lances realmente jogáveis: os pseudo-legais que não deixam o rei em xeque. */
export function lancesLegais(p: Posicao, cor: Cor = p.vez): Lance[] {
  return lancesPseudoLegais(p, cor).filter((lance) => {
    const depois = aplicar(p, lance);
    return !emXeque(depois, cor);
  });
}

/* ------------------------------------------------------------------ */
/* Executar um lance                                                   */
/* ------------------------------------------------------------------ */

/** Devolve uma posição nova com o lance aplicado. Não altera a original. */
export function aplicar(p: Posicao, lance: Lance): Posicao {
  const nova = copiar(p);
  const t = nova.tabuleiro;
  const peca = t[lance.de];
  const capturada = t[lance.para];
  const cor = corDa(peca)!;

  t[lance.para] = lance.promocao
    ? cor === "brancas"
      ? lance.promocao.toUpperCase()
      : lance.promocao.toLowerCase()
    : peca;
  t[lance.de] = VAZIO;

  if (lance.especial === "enPassant") {
    // O peão capturado não está na casa de destino, e sim ao lado.
    const atras = cor === "brancas" ? lance.para + 8 : lance.para - 8;
    t[atras] = VAZIO;
  }

  if (lance.especial === "roquePequeno") {
    const base = linha(lance.de) * 8;
    t[base + 5] = t[base + 7];
    t[base + 7] = VAZIO;
  }
  if (lance.especial === "roqueGrande") {
    const base = linha(lance.de) * 8;
    t[base + 3] = t[base + 0];
    t[base + 0] = VAZIO;
  }

  // Mexer o rei ou a torre apaga o direito de roque correspondente.
  const tipo = peca.toUpperCase();
  if (tipo === "K") {
    if (cor === "brancas") {
      nova.roque.brancasRei = false;
      nova.roque.brancasDama = false;
    } else {
      nova.roque.pretasRei = false;
      nova.roque.pretasDama = false;
    }
  }
  if (tipo === "R") {
    if (lance.de === 63) nova.roque.brancasRei = false;
    if (lance.de === 56) nova.roque.brancasDama = false;
    if (lance.de === 7) nova.roque.pretasRei = false;
    if (lance.de === 0) nova.roque.pretasDama = false;
  }
  // Capturar a torre adversária no canto também apaga o direito dela.
  if (lance.para === 63) nova.roque.brancasRei = false;
  if (lance.para === 56) nova.roque.brancasDama = false;
  if (lance.para === 7) nova.roque.pretasRei = false;
  if (lance.para === 0) nova.roque.pretasDama = false;

  nova.enPassant =
    lance.especial === "duploDePeao"
      ? (lance.de + lance.para) / 2
      : -1;

  const mexeuPeao = tipo === "P";
  const houveCaptura = capturada !== VAZIO || lance.especial === "enPassant";
  nova.meiosLances = mexeuPeao || houveCaptura ? 0 : p.meiosLances + 1;

  nova.vez = adversaria(cor);
  if (cor === "pretas") nova.lance = p.lance + 1;

  return nova;
}

/* ------------------------------------------------------------------ */
/* Fim de partida                                                      */
/* ------------------------------------------------------------------ */

export type Resultado =
  | "emAndamento"
  // Nome explicito de proposito: "xequeMateBrancas" dava para ler tanto como
  // "as brancas deram mate" quanto como "as brancas levaram mate".
  | "vitoriaDasBrancas"
  | "vitoriaDasPretas"
  | "afogamento"
  | "materialInsuficiente"
  | "regraDos50";

export function situacao(p: Posicao): Resultado {
  if (lancesLegais(p).length === 0) {
    if (emXeque(p, p.vez)) {
      // Quem não tem lance e está em xeque levou mate: ganha o adversário.
      return p.vez === "brancas" ? "vitoriaDasPretas" : "vitoriaDasBrancas";
    }
    return "afogamento";
  }
  if (p.meiosLances >= 100) return "regraDos50";

  // Material insuficiente: só reis, ou rei e uma peça menor.
  const pecas = p.tabuleiro.filter((x) => x !== VAZIO && x.toUpperCase() !== "K");
  if (pecas.length === 0) return "materialInsuficiente";
  if (pecas.length === 1 && "BNbn".includes(pecas[0])) return "materialInsuficiente";

  return "emAndamento";
}

/* ------------------------------------------------------------------ */
/* Notação                                                             */
/* ------------------------------------------------------------------ */

const LETRA_PT: Record<string, string> = {
  K: "R",
  Q: "D",
  R: "T",
  B: "B",
  N: "C",
  P: "",
};

/**
 * Escreve o lance em notação algébrica portuguesa (R, D, T, B, C).
 * Precisa da posição ANTES do lance para saber de captura e ambiguidade.
 */
export function escreverLance(p: Posicao, lance: Lance): string {
  if (lance.especial === "roquePequeno") return "O-O";
  if (lance.especial === "roqueGrande") return "O-O-O";

  const peca = p.tabuleiro[lance.de];
  const tipo = peca.toUpperCase();
  const captura =
    p.tabuleiro[lance.para] !== VAZIO || lance.especial === "enPassant";

  let texto = LETRA_PT[tipo];

  if (tipo === "P") {
    if (captura) texto += COLUNAS[coluna(lance.de)];
  } else {
    // Se outra peça igual também pode ir para a mesma casa, precisa desambiguar.
    const iguais = lancesLegais(p, p.vez).filter(
      (o) =>
        o.para === lance.para &&
        o.de !== lance.de &&
        p.tabuleiro[o.de].toUpperCase() === tipo,
    );
    if (iguais.length > 0) {
      const mesmaColuna = iguais.some((o) => coluna(o.de) === coluna(lance.de));
      texto += mesmaColuna
        ? String(8 - linha(lance.de))
        : COLUNAS[coluna(lance.de)];
    }
  }

  if (captura) texto += "x";
  texto += nomeDaCasa(lance.para);
  if (lance.promocao) texto += "=" + LETRA_PT[lance.promocao.toUpperCase()];

  const depois = aplicar(p, lance);
  const corAdversaria = adversaria(p.vez);
  if (emXeque(depois, corAdversaria)) {
    texto += lancesLegais(depois, corAdversaria).length === 0 ? "#" : "+";
  }

  return texto;
}

/** Nome da peça por extenso, para as explicações. */
export function nomeDaPeca(peca: Peca): string {
  const nomes: Record<string, string> = {
    K: "rei",
    Q: "dama",
    R: "torre",
    B: "bispo",
    N: "cavalo",
    P: "peão",
  };
  return nomes[peca.toUpperCase()] ?? "peça";
}

/* ------------------------------------------------------------------ */
/* FEN                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Lê uma posição em FEN, a notação padrão do xadrez para descrever um
 * tabuleiro. Serve para montar posições de teste e para guardar a partida.
 */
export function deFEN(fen: string): Posicao {
  const [campoTabuleiro, campoVez, campoRoque, campoEnPassant, meios, lance] =
    fen.trim().split(/\s+/);

  const tabuleiro: Peca[] = [];
  for (const linhaFen of campoTabuleiro.split("/")) {
    for (const c of linhaFen) {
      if (/\d/.test(c)) {
        for (let i = 0; i < Number(c); i++) tabuleiro.push(VAZIO);
      } else {
        tabuleiro.push(c);
      }
    }
  }

  return {
    tabuleiro,
    vez: campoVez === "w" ? "brancas" : "pretas",
    roque: {
      brancasRei: campoRoque.includes("K"),
      brancasDama: campoRoque.includes("Q"),
      pretasRei: campoRoque.includes("k"),
      pretasDama: campoRoque.includes("q"),
    },
    enPassant:
      campoEnPassant && campoEnPassant !== "-" ? casaPeloNome(campoEnPassant) : -1,
    meiosLances: Number(meios ?? 0),
    lance: Number(lance ?? 1),
  };
}

export function paraFEN(p: Posicao): string {
  let campoTabuleiro = "";
  for (let l = 0; l < 8; l++) {
    let vazias = 0;
    for (let c = 0; c < 8; c++) {
      const peca = p.tabuleiro[l * 8 + c];
      if (peca === VAZIO) {
        vazias++;
      } else {
        if (vazias) campoTabuleiro += vazias;
        vazias = 0;
        campoTabuleiro += peca;
      }
    }
    if (vazias) campoTabuleiro += vazias;
    if (l < 7) campoTabuleiro += "/";
  }

  const roque =
    (p.roque.brancasRei ? "K" : "") +
    (p.roque.brancasDama ? "Q" : "") +
    (p.roque.pretasRei ? "k" : "") +
    (p.roque.pretasDama ? "q" : "");

  return [
    campoTabuleiro,
    p.vez === "brancas" ? "w" : "b",
    roque || "-",
    p.enPassant >= 0 ? nomeDaCasa(p.enPassant) : "-",
    p.meiosLances,
    p.lance,
  ].join(" ");
}
