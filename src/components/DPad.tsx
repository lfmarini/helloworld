import type { Dir } from "../lib/snake";

/**
 * Cruz direcional para telas de toque.
 *
 * Disparamos no `pointerdown` e não no `click`: o clique só acontece quando o
 * dedo levanta, o que num jogo rápido dá a sensação de atraso.
 */
export default function DPad({ onPress }: { onPress: (dir: Dir) => void }) {
  const press = (dir: Dir) => (e: React.PointerEvent) => {
    e.preventDefault();
    onPress(dir);
  };

  return (
    <div
      className="grid grid-cols-3 grid-rows-3 gap-2 select-none"
      // O swipe é detectado no tabuleiro inteiro; aqui bloqueamos a propagação
      // para um toque no botão não virar também um gesto no tabuleiro.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <span />
      <Key label="↑" onPointerDown={press("up")} />
      <span />
      <Key label="←" onPointerDown={press("left")} />
      <span />
      <Key label="→" onPointerDown={press("right")} />
      <span />
      <Key label="↓" onPointerDown={press("down")} />
      <span />
    </div>
  );
}

function Key({
  label,
  onPointerDown,
}: {
  label: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <button
      onPointerDown={onPointerDown}
      aria-label={label}
      // 56px de lado: abaixo disso o alvo fica difícil de acertar com o polegar.
      className="glass h-14 w-14 rounded-2xl text-xl text-white/70 transition-colors active:bg-neon-cyan/25 active:text-white"
    >
      {label}
    </button>
  );
}
