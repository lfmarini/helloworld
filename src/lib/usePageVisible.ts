import { useEffect, useState } from "react";

/**
 * Diz se a aba esta visivel. Usamos isso pra congelar o loop de renderizacao
 * do three.js quando o usuario troca de aba — economiza CPU e bateria.
 */
export function usePageVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}

/**
 * Limita o devicePixelRatio a 2. Celulares modernos chegam a 3x ou 4x, o que
 * multiplica a quantidade de pixels desenhados e frita a bateria sem ganho
 * visual perceptivel.
 */
export const DPR: [number, number] = [1, 2];
