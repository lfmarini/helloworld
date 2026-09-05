import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adversaria,
  aplicar,
  corDa,
  escreverLance,
  lancesLegais,
  posicaoInicial,
  situacao,
  type Cor,
  type Lance,
  type Posicao,
  type Resultado,
} from "./xadrez";
import { analisar, explicarLance, melhorLance, type Analise } from "./xadrezIA";
import { acharAbertura, type Abertura } from "./xadrezAberturas";

export type Nivel = "facil" | "medio" | "dificil";

/** Profundidade de busca por nível. Cada nível a mais multiplica o tempo. */
const PROFUNDIDADE: Record<Nivel, number> = {
  facil: 1,
  medio: 3,
  dificil: 4,
};

export interface LanceJogado {
  texto: string;
  cor: Cor;
  explicacao: string;
}

const CHAVE_NIVEL = "helloworld:xadrez:nivel";

export function useXadrez() {
  const [posicao, setPosicao] = useState<Posicao>(posicaoInicial);
  /**
   * Posições anteriores, para poder voltar atrás.
   *
   * Fica em estado, e não em ref, porque a tela depende dela: o botão de
   * voltar precisa acender e apagar. Ref não provoca nova renderização, e o
   * botão ficaria desatualizado.
   */
  const [anteriores, setAnteriores] = useState<Posicao[]>([]);
  const [historico, setHistorico] = useState<LanceJogado[]>([]);
  const [pensando, setPensando] = useState(false);
  const [assistente, setAssistente] = useState(true);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [nivel, setNivel] = useState<Nivel>(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_NIVEL);
      return salvo === "facil" || salvo === "dificil" ? salvo : "medio";
    } catch {
      return "medio";
    }
  });

  /** O jogador é sempre das brancas nesta versão. */
  const minhaCor: Cor = "brancas";
  const resultado: Resultado = useMemo(() => situacao(posicao), [posicao]);
  const acabou = resultado !== "emAndamento";
  const minhaVez = posicao.vez === minhaCor && !acabou && !pensando;

  const abertura: Abertura | null = useMemo(
    () => acharAbertura(historico.map((h) => h.texto)),
    [historico],
  );

  const escolherNivel = useCallback((n: Nivel) => {
    setNivel(n);
    try {
      localStorage.setItem(CHAVE_NIVEL, n);
    } catch {
      /* sem preferência salva, o jogo continua igual */
    }
  }, []);

  const reiniciar = useCallback(() => {
    setAnteriores([]);
    setPosicao(posicaoInicial());
    setHistorico([]);
    setAnalise(null);
    setPensando(false);
  }, []);

  /** Aplica um lance e registra no histórico. */
  const registrar = useCallback((antes: Posicao, lance: Lance) => {
    const texto = escreverLance(antes, lance);
    const explicacao = explicarLance(antes, lance);
    const cor = corDa(antes.tabuleiro[lance.de])!;
    setAnteriores((a) => [...a, antes]);
    setHistorico((h) => [...h, { texto, cor, explicacao }]);
    setPosicao(aplicar(antes, lance));
  }, []);

  const jogar = useCallback(
    (lance: Lance) => {
      if (!minhaVez) return;
      setAnalise(null);
      registrar(posicao, lance);
    },
    [minhaVez, posicao, registrar],
  );

  /** Volta o lance do jogador e a resposta do computador, de uma vez. */
  const desfazer = useCallback(() => {
    if (pensando || anteriores.length === 0) return;
    // Volta dois lances: o meu e a resposta do computador. Voltar só um
    // devolveria a vez para ele, e ele jogaria de novo na hora.
    const quantos = Math.min(2, anteriores.length);
    setPosicao(anteriores[anteriores.length - quantos]);
    setAnteriores((a) => a.slice(0, -quantos));
    setHistorico((h) => h.slice(0, -quantos));
    setAnalise(null);
  }, [pensando, anteriores]);

  /* --- Vez do computador --- */
  useEffect(() => {
    if (acabou || posicao.vez === minhaCor) return;
    setPensando(true);
    // Um respiro antes de responder: sem isso o lance aparece no mesmo
    // instante do clique e não dá para acompanhar o que aconteceu.
    const tempo = setTimeout(() => {
      const lance = melhorLance(posicao, PROFUNDIDADE[nivel]);
      if (lance) registrar(posicao, lance);
      setPensando(false);
    }, 350);
    return () => clearTimeout(tempo);
  }, [posicao, acabou, nivel, registrar]);

  /* --- Análise para o jogador --- */
  useEffect(() => {
    if (!assistente || !minhaVez) return;
    // Adiada um instante para a jogada do computador aparecer na tela antes
    // de a análise travar o navegador por alguns milissegundos.
    const tempo = setTimeout(() => {
      setAnalise(analisar(posicao, Math.min(3, PROFUNDIDADE[nivel]), 3));
    }, 120);
    return () => clearTimeout(tempo);
  }, [assistente, minhaVez, posicao, nivel]);

  const legais = useMemo(
    () => (minhaVez ? lancesLegais(posicao) : []),
    [minhaVez, posicao],
  );

  /**
   * Casas que mudaram no último lance, para destacar no tabuleiro.
   * Comparar as duas posições cobre roque e en passant de graça, que mexem em
   * mais de duas casas.
   */
  const ultimoLance = useMemo(() => {
    if (anteriores.length === 0) return null;
    const antes = anteriores[anteriores.length - 1];
    const mudadas: number[] = [];
    for (let casa = 0; casa < 64; casa++) {
      if (antes.tabuleiro[casa] !== posicao.tabuleiro[casa]) mudadas.push(casa);
    }
    return mudadas;
  }, [posicao, anteriores]);

  return {
    posicao,
    historico,
    legais,
    minhaCor,
    minhaVez,
    pensando,
    acabou,
    resultado,
    abertura,
    analise,
    assistente,
    setAssistente,
    nivel,
    escolherNivel,
    ultimoLance,
    podeDesfazer: anteriores.length > 0 && !pensando,
    jogar,
    desfazer,
    reiniciar,
    adversario: adversaria(minhaCor),
  };
}

export type Xadrez = ReturnType<typeof useXadrez>;
