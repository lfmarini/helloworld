import { useCallback, useEffect, useRef, useState } from "react";
import { createState, step, tickMs, turn, type Dir, type SnakeState, type Vec } from "./snake";

export type Status = "ready" | "playing" | "paused" | "over";

/**
 * Efeitos visuais que a cena 3D lê a cada quadro. Ficam num ref (e não em
 * estado do React) porque mudam dezenas de vezes por segundo e re-renderizar
 * a página nesse ritmo seria desperdício puro.
 */
export interface Fx {
  /** Contador que sobe a cada comida — a cena compara com o valor anterior. */
  eatSeq: number;
  eatAt: Vec | null;
  /** Intensidade do tremor de tela, de 0 a 1. A cena faz decair. */
  shake: number;
}

const BEST_KEY = "helloworld:snake:best";

function readBest(): number {
  // localStorage pode estourar em aba anônima ou com cookies bloqueados.
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value: number) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* sem recorde salvo, o jogo continua funcionando normalmente */
  }
}

export function useSnakeGame() {
  const stateRef = useRef<SnakeState>(createState());
  /** Fração do passo atual já percorrida (0 a 1), usada para interpolar. */
  const progressRef = useRef(0);
  const fxRef = useRef<Fx>({ eatSeq: 0, eatAt: null, shake: 0 });

  const [status, setStatus] = useState<Status>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);

  const reset = useCallback(() => {
    stateRef.current = createState();
    progressRef.current = 0;
    fxRef.current.eatAt = null;
    fxRef.current.shake = 0;
    setScore(0);
  }, []);

  const start = useCallback(() => {
    reset();
    setStatus("playing");
  }, [reset]);

  const pause = useCallback(() => {
    setStatus((s) => (s === "playing" ? "paused" : s));
  }, []);

  const togglePause = useCallback(() => {
    setStatus((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s));
  }, []);

  /** Vira a cobra. Se o jogo ainda não começou, a primeira seta já dá a partida. */
  const turnTo = useCallback(
    (dir: Dir) => {
      if (status === "ready") {
        start();
        turn(stateRef.current, dir);
        return;
      }
      if (status !== "playing") return;
      turn(stateRef.current, dir);
    },
    [status, start],
  );

  // Laço principal. Roda só enquanto o jogo está em andamento; ao pausar, o
  // efeito é desmontado e o requestAnimationFrame cancelado.
  useEffect(() => {
    if (status !== "playing") return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = stateRef.current;

      // Trava o delta em 100ms: se a aba ficou congelada, não queremos que o
      // jogo avance 30 passos de uma vez ao voltar.
      const dt = Math.min(now - last, 100);
      last = now;
      acc += dt;

      // Acumulador de passo fixo: o jogo anda em intervalos exatos,
      // independente da taxa de quadros da tela (60Hz, 120Hz, o que for).
      let dur = tickMs(s.score);
      while (acc >= dur) {
        acc -= dur;
        const result = step(s);

        if (result.died) {
          progressRef.current = 1;
          fxRef.current.shake = 1;
          setStatus("over");
          setScore(s.score);
          setBest((b) => {
            if (s.score > b) {
              writeBest(s.score);
              return s.score;
            }
            return b;
          });
          cancelAnimationFrame(raf);
          return;
        }

        if (result.ate) {
          fxRef.current.eatSeq += 1;
          fxRef.current.eatAt = { ...s.cells[0] };
          fxRef.current.shake = Math.min(1, fxRef.current.shake + 0.45);
          setScore(s.score);
          dur = tickMs(s.score); // a velocidade sobe já no passo seguinte
        }
      }

      progressRef.current = acc / dur;
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  // Pausa sozinho quando a aba perde o foco — nada pior do que voltar pra aba
  // e descobrir que morreu enquanto respondia uma mensagem.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [pause]);

  return {
    stateRef,
    progressRef,
    fxRef,
    status,
    score,
    best,
    start,
    pause,
    togglePause,
    turnTo,
  };
}

export type Game = ReturnType<typeof useSnakeGame>;
