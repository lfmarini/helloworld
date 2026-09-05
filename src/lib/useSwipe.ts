import { useEffect, type RefObject } from "react";
import type { Dir } from "./snake";

/** Distância mínima, em pixels, para o gesto contar como swipe e não como toque. */
const THRESHOLD = 24;

/**
 * Detecta deslizes de dedo dentro de um elemento e traduz em direção.
 *
 * Usamos eventos de ponteiro (pointerdown/pointerup), que funcionam igual para
 * dedo, caneta e mouse — evita ter que escrever o mesmo código duas vezes.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (dir: Dir) => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const down = (e: PointerEvent) => {
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    };

    const up = (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      // Só o eixo dominante conta: um deslize diagonal vira a direção mais
      // "forte", em vez de disparar duas curvas de uma vez.
      if (Math.abs(dx) > Math.abs(dy)) {
        onSwipe(dx > 0 ? "right" : "left");
      } else {
        onSwipe(dy > 0 ? "down" : "up");
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", () => (tracking = false));
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
    };
  }, [ref, onSwipe]);
}
