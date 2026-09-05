import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageShell from "../components/PageShell";
import BackLink from "../components/BackLink";
import Loader from "../components/Loader";
import DPad from "../components/DPad";
import PainelRanking from "../components/PainelRanking";
import { useSnakeGame } from "../lib/useSnakeGame";
import { useSwipe } from "../lib/useSwipe";
import { useToque } from "../lib/useToque";
import type { Dir } from "../lib/snake";

// A cena 3D é um pedaço grande de código (three.js). Carregando sob demanda,
// o resto da tela aparece na hora e o 3D chega logo em seguida.
const SnakeScene = lazy(() => import("../components/three/SnakeScene"));

/** Teclas aceitas: setas e WASD. */
const KEYS: Record<string, Dir> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

export default function Snake() {
  const game = useSnakeGame();
  const boardRef = useRef<HTMLDivElement>(null);
  const { status, score, best, start, togglePause, turnTo } = game;
  const [verRanking, setVerRanking] = useState(false);
  const toque = useToque();

  // Comecar uma partida sempre fecha o painel do ranking, senao ele
  // continuaria por cima do jogo ja rodando.
  const jogar = useCallback(() => {
    setVerRanking(false);
    start();
  }, [start]);

  useSwipe(boardRef, turnTo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const dir = KEYS[key];
      if (dir) {
        // Sem o preventDefault, as setas rolariam a página junto com o jogo.
        e.preventDefault();
        turnTo(dir);
        return;
      }
      if (key === " ") {
        e.preventDefault();
        togglePause();
      }
      if (key === "enter" && (status === "ready" || status === "over")) {
        e.preventDefault();
        jogar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turnTo, togglePause, jogar, status]);

  const handleDPad = useCallback((dir: Dir) => turnTo(dir), [turnTo]);

  return (
    <PageShell className="relative flex h-dvh flex-col overflow-hidden bg-void">
      {/* touch-none impede o navegador de rolar a página durante o swipe. */}
      <div ref={boardRef} className="absolute inset-0 touch-none">
        <Suspense fallback={<Loader />}>
          <SnakeScene game={game} />
        </Suspense>
      </div>

      {/* ---------- Painel superior ---------- */}
      <header className="relative z-10 flex items-start justify-between gap-3 p-4 sm:p-6">
        <BackLink />
        <div className="flex gap-2">
          <Stat label="Pontos" value={score} accent />
          <Stat label="Recorde" value={best} />
        </div>
      </header>

      <div className="flex-1" />

      {/* ---------- Controles na tela ----------
          Quem manda aqui e ter toque, nao a largura: um celular deitado passa
          de 800px e, por largura, ficaria sem controle nenhum. */}
      {toque && (
        <div className="relative z-10 flex justify-center p-4">
          <DPad onPress={handleDPad} />
        </div>
      )}

      {!toque && (
        <p className="relative z-10 pb-5 text-center text-xs text-white/30">
          Setas ou WASD para mover · Espaço para pausar
        </p>
      )}

      {/* ---------- Camadas sobrepostas ---------- */}
      <AnimatePresence>
        {status === "ready" && (
          <Overlay key="ready">
            {verRanking ? (
              <PainelRanking
                jogo="cobrinha"
                pontos={0}
                aoVoltar={() => setVerRanking(false)}
              />
            ) : (
              <>
                <h1 className="font-display text-4xl font-bold sm:text-5xl">
                  Cobrinha <span className="text-neon-cyan">3D</span>
                </h1>
                <p className="mt-3 max-w-xs text-sm text-white/55">
                  Coma os cubos rosa para crescer. Bater na parede ou em si mesma
                  encerra a partida — e ela acelera conforme você pontua.
                </p>
                <Button onClick={jogar}>Começar</Button>
                <BotaoSecundario onClick={() => setVerRanking(true)}>
                  Ver ranking
                </BotaoSecundario>
                <p className="mt-4 text-xs text-white/30">
                  Deslize o dedo na tela ou use as setas
                </p>
              </>
            )}
          </Overlay>
        )}

        {status === "paused" && (
          <Overlay key="paused">
            <h2 className="font-display text-3xl font-bold">Pausado</h2>
            <p className="mt-3 text-sm text-white/55">
              O jogo pausa sozinho quando você troca de aba.
            </p>
            <Button onClick={togglePause}>Continuar</Button>
          </Overlay>
        )}

        {status === "over" && (
          <Overlay key="over">
            {verRanking ? (
              <PainelRanking
                jogo="cobrinha"
                pontos={score}
                aoVoltar={() => setVerRanking(false)}
              />
            ) : (
              <>
                <p className="font-display text-xs tracking-[0.3em] text-neon-magenta uppercase">
                  Fim de jogo
                </p>
                <h2 className="mt-3 font-display text-6xl font-bold">{score}</h2>
                <p className="mt-2 text-sm text-white/50">
                  {score >= best && score > 0
                    ? "Novo recorde! 🏆"
                    : `Seu recorde é ${best}`}
                </p>
                <Button onClick={jogar}>Jogar de novo</Button>
                <BotaoSecundario onClick={() => setVerRanking(true)}>
                  {score > 0 ? "Entrar no ranking" : "Ver ranking"}
                </BotaoSecundario>
              </>
            )}
          </Overlay>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="glass min-w-20 rounded-xl px-3 py-2 text-right">
      <p className="font-display text-[10px] tracking-widest text-white/40 uppercase">
        {label}
      </p>
      <p
        className={`font-display text-xl font-bold tabular-nums ${
          accent ? "text-neon-cyan" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-void/70 px-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="glass w-full max-w-sm rounded-3xl p-8 text-center"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Button({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-7 w-full rounded-xl bg-gradient-to-r from-neon-cyan to-neon-magenta px-6 py-3 font-display font-semibold text-void transition-transform hover:scale-[1.03] active:scale-95"
    >
      {children}
    </button>
  );
}

function BotaoSecundario({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-3 w-full rounded-xl bg-white/5 px-6 py-3 font-display font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
