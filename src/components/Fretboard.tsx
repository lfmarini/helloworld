import type { GuitarString } from "../lib/tunings";

/** Posições das casas. O espaçamento diminui em direção ao corpo, como no violão real. */
const CASAS = [92, 150, 202, 248, 289];
const TOPO = 18;
const ESPACO = 19;
const INICIO_X = 34;
const FIM_X = 316;

/**
 * Diagrama do braço visto de frente, com a corda ativa acesa.
 *
 * A 6ª corda (mais grave e mais grossa) fica em cima, que é como quase todo
 * diagrama de violão é desenhado.
 */
export default function Fretboard({
  strings,
  activeIndex,
  color,
}: {
  strings: GuitarString[];
  /** Corda detectada, ou -1 quando não há nota. */
  activeIndex: number;
  /** Cor da corda ativa, refletindo o quão afinada ela está. */
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 330 132"
      className="w-full"
      role="img"
      aria-label="Braço do violão com as seis cordas"
    >
      <defs>
        <filter id="brilho-corda" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="2.4" result="borrado" />
          <feMerge>
            <feMergeNode in="borrado" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Escala (a madeira) */}
      <rect
        x={INICIO_X}
        y={TOPO - 10}
        width={FIM_X - INICIO_X}
        height={ESPACO * 5 + 20}
        rx="4"
        fill="#0b1120"
        stroke="#1b2740"
      />

      {/* Pestana */}
      <rect x={INICIO_X - 6} y={TOPO - 12} width="6" height={ESPACO * 5 + 24} rx="2" fill="#4b5a76" />

      {/* Divisões das casas */}
      {CASAS.map((x) => (
        <line
          key={x}
          x1={x}
          y1={TOPO - 10}
          x2={x}
          y2={TOPO + ESPACO * 5 + 10}
          stroke="#1e2c46"
          strokeWidth="2"
        />
      ))}

      {/* Marcadores das casas 3 e 5 */}
      {[121, 225].map((x) => (
        <circle key={x} cx={x} cy={TOPO + ESPACO * 2.5} r="4" fill="#1b2740" />
      ))}

      {strings.map((corda, i) => {
        const y = TOPO + i * ESPACO;
        const ativa = i === activeIndex;
        // A 6ª corda é a mais grossa; a 1ª, a mais fina.
        const espessura = 2.6 - i * 0.32;
        return (
          <g key={corda.note}>
            <text
              x={INICIO_X - 14}
              y={y + 4}
              textAnchor="end"
              fontSize="12"
              fontWeight="600"
              fill={ativa ? color : "#64748b"}
            >
              {corda.label}
            </text>
            <line
              x1={INICIO_X}
              y1={y}
              x2={FIM_X}
              y2={y}
              stroke={ativa ? color : "#3d4b66"}
              strokeWidth={ativa ? espessura + 1 : espessura}
              strokeLinecap="round"
              filter={ativa ? "url(#brilho-corda)" : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
