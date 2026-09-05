import { useState } from "react";
import { motion } from "framer-motion";
import {
  VAZIO,
  casaDoRei,
  coluna,
  corDa,
  emXeque,
  linha,
  nomeDaCasa,
  type Lance,
  type Peca,
  type Posicao,
} from "../lib/xadrez";

/**
 * Desenho do tabuleiro.
 *
 * É 2D, e não 3D como o resto do site, por um motivo prático: em xadrez você
 * precisa ler a posição inteira num relance, e peça em perspectiva atrapalha
 * exatamente isso. O visual neon fica; a perspectiva sai.
 *
 * As peças usam os símbolos preenchidos do Unicode para as duas cores, mudando
 * só a cor da tinta. Os símbolos "vazados" das brancas quase somem num fundo
 * escuro.
 */
const SIMBOLO: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

export default function Tabuleiro({
  posicao,
  legais,
  minhaVez,
  ultimoLance,
  sugestao,
  aoJogar,
}: {
  posicao: Posicao;
  legais: Lance[];
  minhaVez: boolean;
  /** Casas que mudaram no último lance, para destacar. */
  ultimoLance: number[] | null;
  /** Lance sugerido pelo assistente, destacado em ciano. */
  sugestao: Lance | null;
  aoJogar: (lance: Lance) => void;
}) {
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [promocao, setPromocao] = useState<{ de: number; para: number } | null>(
    null,
  );

  const destinos = legais.filter((l) => l.de === selecionada);
  const reiEmXeque = emXeque(posicao, posicao.vez)
    ? casaDoRei(posicao, posicao.vez)
    : -1;

  function aoClicar(casa: number) {
    if (!minhaVez) return;

    // Clicar numa peça própria seleciona (ou troca a seleção).
    const peca = posicao.tabuleiro[casa];
    if (peca !== VAZIO && corDa(peca) === posicao.vez) {
      setSelecionada(casa === selecionada ? null : casa);
      return;
    }

    if (selecionada === null) return;

    const candidatos = legais.filter(
      (l) => l.de === selecionada && l.para === casa,
    );
    if (candidatos.length === 0) {
      setSelecionada(null);
      return;
    }

    // Promoção: são quatro lances para a mesma casa, então perguntamos.
    if (candidatos.length > 1 && candidatos[0].promocao) {
      setPromocao({ de: selecionada, para: casa });
      return;
    }

    aoJogar(candidatos[0]);
    setSelecionada(null);
  }

  return (
    <div className="relative w-full">
      <div
        className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border border-white/10"
        role="grid"
        aria-label="Tabuleiro de xadrez"
      >
        {Array.from({ length: 64 }, (_, casa) => {
          const peca = posicao.tabuleiro[casa];
          const clara = (linha(casa) + coluna(casa)) % 2 === 0;
          const ehDestino = destinos.some((l) => l.para === casa);
          const noUltimo = ultimoLance?.includes(casa) ?? false;
          const naSugestao =
            sugestao !== null && (sugestao.de === casa || sugestao.para === casa);
          const branca = peca !== VAZIO && corDa(peca) === "brancas";

          return (
            <button
              key={casa}
              onClick={() => aoClicar(casa)}
              aria-label={`${nomeDaCasa(casa)}${peca !== VAZIO ? " com peça" : ""}`}
              className={`relative flex items-center justify-center transition-colors ${
                clara ? "bg-[#1b2740]" : "bg-[#111a2c]"
              } ${casa === selecionada ? "!bg-neon-cyan/35" : ""} ${
                noUltimo ? "bg-neon-magenta/15" : ""
              } ${casa === reiEmXeque ? "!bg-[#f0456e]/40" : ""}`}
            >
              {/* Destaque da sugestão do assistente */}
              {naSugestao && (
                <span className="pointer-events-none absolute inset-0 rounded-sm ring-2 ring-neon-cyan/70 ring-inset" />
              )}

              {/* Marca de destino possível */}
              {ehDestino && (
                <span
                  className={`pointer-events-none absolute ${
                    peca === VAZIO
                      ? "h-1/4 w-1/4 rounded-full bg-neon-cyan/50"
                      : "inset-1 rounded-full ring-4 ring-neon-cyan/50"
                  }`}
                />
              )}

              {peca !== VAZIO && (
                <motion.span
                  layoutId={`peca-${casa}-${peca}`}
                  className={`pointer-events-none leading-none select-none ${
                    branca
                      ? "text-[#e9f7ff] drop-shadow-[0_0_6px_rgba(140,230,255,0.55)]"
                      : "text-[#f56ec8] drop-shadow-[0_0_6px_rgba(240,62,200,0.45)]"
                  }`}
                  style={{ fontSize: "clamp(18px, 6.2vw, 44px)" }}
                >
                  {SIMBOLO[peca.toLowerCase()]}
                </motion.span>
              )}

              {/* Coordenadas discretas nas bordas */}
              {coluna(casa) === 0 && (
                <span className="pointer-events-none absolute top-0.5 left-0.5 text-[8px] text-white/25">
                  {8 - linha(casa)}
                </span>
              )}
              {linha(casa) === 7 && (
                <span className="pointer-events-none absolute right-0.5 bottom-0.5 text-[8px] text-white/25">
                  {"abcdefgh"[coluna(casa)]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Escolha da peça na promoção */}
      {promocao && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="glass rounded-2xl p-4 text-center">
            <p className="mb-3 font-display text-sm text-white/70">
              Promover o peão a:
            </p>
            <div className="flex gap-2">
              {["Q", "R", "B", "N"].map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => {
                    const lance = legais.find(
                      (l) =>
                        l.de === promocao.de &&
                        l.para === promocao.para &&
                        l.promocao === tipo,
                    );
                    if (lance) aoJogar(lance);
                    setPromocao(null);
                    setSelecionada(null);
                  }}
                  className="glass flex h-14 w-14 items-center justify-center rounded-xl text-3xl text-[#e9f7ff] transition-colors hover:bg-neon-cyan/20"
                >
                  {SIMBOLO[tipo.toLowerCase()]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Símbolo de uma peça, para usar fora do tabuleiro. */
export function simboloDaPeca(peca: Peca): string {
  return SIMBOLO[peca.toLowerCase()] ?? "";
}
