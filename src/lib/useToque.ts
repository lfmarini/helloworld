import { useEffect, useState } from "react";

/**
 * Diz se o aparelho é de toque.
 *
 * Não dá para usar a largura da tela para isso, que é o erro fácil: um celular
 * deitado tem 844px de largura, mais que muitos notebooks. Quem decidisse pela
 * largura esconderia os botões de toque justamente no celular em paisagem.
 *
 * "pointer: coarse" pergunta a coisa certa — se o apontador principal é
 * impreciso, ou seja, um dedo.
 */
export function useToque() {
  const [toque, setToque] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches;
  });

  useEffect(() => {
    const consulta = window.matchMedia("(pointer: coarse)");
    const aoMudar = () => setToque(consulta.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  return toque;
}

/**
 * Mantém a tela acesa enquanto estiver ativo.
 *
 * Num jogo em que o dedo fica parado nos botões, o celular entende que ninguém
 * está usando e apaga a tela no meio da corrida.
 */
export function useTelaAcesa(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    let travaAtual: WakeLockSentinel | null = null;
    let cancelado = false;

    const pedir = async () => {
      try {
        travaAtual = await navigator.wakeLock?.request("screen");
      } catch {
        /* nem todo navegador tem; sem isso o jogo continua igual */
      }
    };
    void pedir();

    // O sistema solta a trava sozinho quando a aba perde o foco; ao voltar,
    // precisamos pedir de novo.
    const aoVoltar = () => {
      if (!cancelado && !document.hidden) void pedir();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoVoltar);
      void travaAtual?.release();
    };
  }, [ativo]);
}
