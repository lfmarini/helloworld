import { useEffect, useRef } from "react";

/**
 * Segue o mouse na janela inteira e devolve a posicao normalizada (-1 a 1).
 *
 * Por que nao usar o `state.pointer` do react-three-fiber? Porque a camada do
 * canvas tem `pointer-events: none` (pra nao roubar os cliques dos botoes da
 * pagina), e sem eventos de ponteiro o fiber nunca atualiza a posicao dele.
 * Escutando na window resolvemos os dois problemas de uma vez.
 *
 * Devolvemos um ref, e nao um state: o mouse mexe dezenas de vezes por segundo
 * e re-renderizar o React a cada movimento seria desperdicio.
 */
export function usePointer() {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    // Quando o ponteiro sai da janela, volta devagar pro centro.
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return pointer;
}
