import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COMPRIMENTO,
  criarEstado,
  criarPista,
  passo,
  type Comandos,
  type EstadoCorrida,
} from "./motocross";

export type StatusCorrida = "pronto" | "correndo" | "pausado" | "terminou";

/**
 * Passo de simulação fixo. Física com passo fixo é o que garante que a corrida
 * se comporte igual em telas de 60Hz e de 144Hz — inclusive o recorde.
 */
const DT = 1 / 120;

const CHAVE_RECORDE = "helloworld:corrida:recorde";

function lerRecorde(): number | null {
  try {
    const valor = Number(localStorage.getItem(CHAVE_RECORDE));
    return valor > 0 ? valor : null;
  } catch {
    return null;
  }
}

function gravarRecorde(valor: number) {
  try {
    localStorage.setItem(CHAVE_RECORDE, String(valor));
  } catch {
    /* sem recorde salvo, o jogo continua igual */
  }
}

/** O que a tela precisa mostrar. Atualizado algumas vezes por segundo. */
export interface Painel {
  tempo: number;
  velocidade: number;
  temperatura: number;
  progresso: number;
  fundido: boolean;
  capotado: boolean;
}

export function useCorrida() {
  const pista = useMemo(() => criarPista(), []);
  const estadoRef = useRef<EstadoCorrida>(criarEstado());
  const comandosRef = useRef<Comandos>({
    acelerar: false,
    turbo: false,
    vertical: 0,
  });
  /** Sobe a cada capotada/pouso; a cena usa para disparar efeitos. */
  const efeitosRef = useRef({ capotadas: 0, pousos: 0, tremor: 0 });

  const [status, setStatus] = useState<StatusCorrida>("pronto");
  const [painel, setPainel] = useState<Painel>({
    tempo: 0,
    velocidade: 0,
    temperatura: 0,
    progresso: 0,
    fundido: false,
    capotado: false,
  });
  const [recorde, setRecorde] = useState<number | null>(lerRecorde);

  const comecar = useCallback(() => {
    estadoRef.current = criarEstado();
    efeitosRef.current.tremor = 0;
    comandosRef.current.vertical = 0;
    setStatus("correndo");
  }, []);

  const pausar = useCallback(() => {
    setStatus((s) => (s === "correndo" ? "pausado" : s));
  }, []);

  const alternarPausa = useCallback(() => {
    setStatus((s) =>
      s === "correndo" ? "pausado" : s === "pausado" ? "correndo" : s,
    );
  }, []);

  useEffect(() => {
    if (status !== "correndo") return;

    let quadro = 0;
    let anterior = performance.now();
    let acumulado = 0;
    let ultimoPainel = 0;

    const laco = (agora: number) => {
      quadro = requestAnimationFrame(laco);
      const e = estadoRef.current;

      // Trava em 100ms: se a aba ficou congelada, não queremos simular vários
      // segundos de uma vez quando ela voltar.
      const delta = Math.min(agora - anterior, 100) / 1000;
      anterior = agora;
      acumulado += delta;

      while (acumulado >= DT) {
        acumulado -= DT;
        const ev = passo(e, pista, comandosRef.current, DT);
        if (ev.capotou) {
          efeitosRef.current.capotadas += 1;
          efeitosRef.current.tremor = 1;
        }
        if (ev.pousou) {
          efeitosRef.current.pousos += 1;
          efeitosRef.current.tremor = Math.min(1, efeitosRef.current.tremor + 0.35);
        }
        if (ev.terminou) {
          setStatus("terminou");
          setRecorde((atual) => {
            if (atual === null || e.tempo < atual) {
              gravarRecorde(e.tempo);
              return e.tempo;
            }
            return atual;
          });
        }
      }

      // O painel não precisa de 60 atualizações por segundo: a cada 80ms o
      // número já parece contínuo, e o React re-renderiza bem menos.
      if (agora - ultimoPainel > 80) {
        ultimoPainel = agora;
        setPainel({
          tempo: e.tempo,
          velocidade: e.velocidade,
          temperatura: e.temperatura,
          progresso: Math.min(1, e.x / COMPRIMENTO),
          fundido: e.fundido,
          capotado: e.capotado,
        });
      }
    };

    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, [status, pista]);

  // Pausa sozinho ao trocar de aba — numa corrida contra o relógio, isso
  // evita perder o tempo por causa de uma notificação.
  useEffect(() => {
    const aoEsconder = () => {
      if (document.hidden) pausar();
    };
    window.addEventListener("blur", pausar);
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      window.removeEventListener("blur", pausar);
      document.removeEventListener("visibilitychange", aoEsconder);
    };
  }, [pausar]);

  return {
    pista,
    estadoRef,
    comandosRef,
    efeitosRef,
    status,
    painel,
    recorde,
    comecar,
    pausar,
    alternarPausa,
  };
}

export type Corrida = ReturnType<typeof useCorrida>;
