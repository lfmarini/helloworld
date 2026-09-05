import { useCallback, useEffect, useRef, useState } from "react";
import {
  TEMPO_LIMITE,
  criarEstadoPlataforma,
  passoPlataforma,
  type ComandosPlataforma,
  type EstadoPlataforma,
} from "./plataforma";

export type StatusJogo = "pronto" | "jogando" | "pausado" | "venceu" | "acabou";

/** Passo fixo: o jogo se comporta igual em telas de 60Hz e de 144Hz. */
const DT = 1 / 120;

const CHAVE_RECORDE = "helloworld:plataforma:recorde";

function lerRecorde(): number {
  try {
    return Number(localStorage.getItem(CHAVE_RECORDE)) || 0;
  } catch {
    return 0;
  }
}

export interface PainelPlataforma {
  pontos: number;
  moedas: number;
  vidas: number;
  tempo: number;
  progresso: number;
}

export function usePlataforma() {
  const estadoRef = useRef<EstadoPlataforma>(criarEstadoPlataforma());
  const comandosRef = useRef<ComandosPlataforma>({ horizontal: 0, pular: false });
  /**
   * Avisos para a cena 3D. Ficam em ref porque mudam muitas vezes por segundo
   * e não devem provocar re-renderização do React.
   */
  const efeitosRef = useRef({
    versaoMapa: 0,
    moedas: 0,
    pisoes: 0,
    tremor: 0,
  });

  const [status, setStatus] = useState<StatusJogo>("pronto");
  const [painel, setPainel] = useState<PainelPlataforma>({
    pontos: 0,
    moedas: 0,
    vidas: 3,
    tempo: TEMPO_LIMITE,
    progresso: 0,
  });
  const [recorde, setRecorde] = useState(lerRecorde);

  const comecar = useCallback(() => {
    estadoRef.current = criarEstadoPlataforma();
    efeitosRef.current.versaoMapa += 1;
    efeitosRef.current.tremor = 0;
    comandosRef.current.horizontal = 0;
    comandosRef.current.pular = false;
    setStatus("jogando");
  }, []);

  const pausar = useCallback(() => {
    setStatus((s) => (s === "jogando" ? "pausado" : s));
  }, []);

  const alternarPausa = useCallback(() => {
    setStatus((s) => (s === "jogando" ? "pausado" : s === "pausado" ? "jogando" : s));
  }, []);

  const guardarRecorde = useCallback((pontos: number) => {
    setRecorde((atual) => {
      if (pontos <= atual) return atual;
      try {
        localStorage.setItem(CHAVE_RECORDE, String(pontos));
      } catch {
        /* sem recorde salvo, o jogo continua igual */
      }
      return pontos;
    });
  }, []);

  useEffect(() => {
    if (status !== "jogando") return;

    let quadro = 0;
    let anterior = performance.now();
    let acumulado = 0;
    let ultimoPainel = 0;

    const laco = (agora: number) => {
      quadro = requestAnimationFrame(laco);
      const e = estadoRef.current;

      // Trava em 100ms: se a aba ficou congelada, não simulamos vários
      // segundos de uma vez quando ela voltar.
      const delta = Math.min(agora - anterior, 100) / 1000;
      anterior = agora;
      acumulado += delta;

      while (acumulado >= DT) {
        acumulado -= DT;
        const ev = passoPlataforma(e, comandosRef.current, DT);
        if (ev.caixaBatida) efeitosRef.current.versaoMapa += 1;
        if (ev.moedas) efeitosRef.current.moedas += ev.moedas;
        if (ev.pisouInimigo) {
          efeitosRef.current.pisoes += 1;
          efeitosRef.current.tremor = Math.min(1, efeitosRef.current.tremor + 0.3);
        }
        if (ev.morreu) efeitosRef.current.tremor = 1;
        if (ev.venceu) {
          setStatus("venceu");
          guardarRecorde(e.pontos);
        }
        if (e.status === "acabou") {
          setStatus("acabou");
          guardarRecorde(e.pontos);
        }
      }

      // O painel não precisa de 60 atualizações por segundo.
      if (agora - ultimoPainel > 80) {
        ultimoPainel = agora;
        setPainel({
          pontos: e.pontos,
          moedas: e.moedasPegas,
          vidas: e.vidas,
          tempo: Math.max(0, e.tempo),
          progresso: Math.min(1, e.jogador.x / e.fase.bandeira),
        });
      }
    };

    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, [status, guardarRecorde]);

  // Pausa sozinho ao trocar de aba: o cronômetro corre, e voltar para a aba e
  // descobrir que perdeu a vida seria frustrante.
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

export type Plataforma = ReturnType<typeof usePlataforma>;
