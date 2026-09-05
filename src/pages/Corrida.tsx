import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageShell from "../components/PageShell";
import BackLink from "../components/BackLink";
import Loader from "../components/Loader";
import { COMPRIMENTO, formataTempo } from "../lib/motocross";
import { useCorrida } from "../lib/useCorrida";

const CorridaScene = lazy(() => import("../components/three/CorridaScene"));

export default function Corrida() {
  const corrida = useCorrida();
  const { comandosRef, status, painel, recorde, comecar, alternarPausa } = corrida;
  const [retrato, setRetrato] = useState(false);
  const teclas = useRef(new Set<string>());

  /* ---------- Orientação ---------- */
  useEffect(() => {
    const verificar = () => {
      // Só cobramos paisagem de tela pequena: num monitor em pé o jogo cabe.
      setRetrato(window.innerHeight > window.innerWidth && window.innerWidth < 820);
    };
    verificar();
    window.addEventListener("resize", verificar);
    window.addEventListener("orientationchange", verificar);
    return () => {
      window.removeEventListener("resize", verificar);
      window.removeEventListener("orientationchange", verificar);
    };
  }, []);

  /* ---------- Teclado ---------- */
  useEffect(() => {
    const aplicar = () => {
      const t = teclas.current;
      const cima = t.has("arrowup") || t.has("w");
      const baixo = t.has("arrowdown") || t.has("s");
      comandosRef.current.vertical = cima ? -1 : baixo ? 1 : 0;
      comandosRef.current.acelerar =
        t.has(" ") || t.has("x") || t.has("arrowright") || t.has("d");
      comandosRef.current.turbo = t.has("shift") || t.has("z");
    };

    const aoApertar = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        ["arrowup", "arrowdown", "arrowright", "arrowleft", " "].includes(k)
      ) {
        // Sem isso as setas e o espaço rolam a página durante a corrida.
        e.preventDefault();
      }
      if (k === "p" || k === "escape") {
        alternarPausa();
        return;
      }
      if (k === "enter" && (status === "pronto" || status === "terminou")) {
        e.preventDefault();
        comecar();
        return;
      }
      teclas.current.add(k);
      aplicar();
    };

    const aoSoltar = (e: KeyboardEvent) => {
      teclas.current.delete(e.key.toLowerCase());
      aplicar();
    };

    // Ao perder o foco, esquecemos as teclas: senão a moto ficaria acelerando
    // sozinha para sempre, porque o "soltou" nunca chegaria.
    const limpar = () => {
      teclas.current.clear();
      aplicar();
    };

    window.addEventListener("keydown", aoApertar);
    window.addEventListener("keyup", aoSoltar);
    window.addEventListener("blur", limpar);
    return () => {
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoSoltar);
      window.removeEventListener("blur", limpar);
    };
  }, [comandosRef, alternarPausa, comecar, status]);

  /* ---------- Tela cheia no celular ---------- */
  const telaCheia = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      // A trava de orientação só funciona em tela cheia, e não em todo
      // navegador — por isso vai dentro de um try próprio.
      const orientacao = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      await orientacao.lock?.("landscape");
    } catch {
      /* sem tela cheia o jogo continua funcionando normalmente */
    }
  }, []);

  const emCorrida = status === "correndo";

  return (
    <PageShell className="relative h-dvh overflow-hidden bg-void select-none">
      <div className="absolute inset-0">
        <Suspense fallback={<Loader />}>
          <CorridaScene corrida={corrida} />
        </Suspense>
      </div>

      {/* ---------- Painel superior ---------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <BackLink />
          <div className="glass rounded-xl px-3 py-2">
            <p className="font-display text-[9px] tracking-widest text-white/40 uppercase">
              Tempo
            </p>
            <p className="font-display text-lg leading-none font-bold tabular-nums text-neon-cyan">
              {formataTempo(painel.tempo)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Medidor
            rotulo="Motor"
            valor={painel.temperatura}
            cor={
              painel.temperatura > 0.8
                ? "#f0456e"
                : painel.temperatura > 0.55
                  ? "#f5d33c"
                  : "#3ce88a"
            }
            aviso={painel.fundido ? "FUNDIU" : undefined}
          />
          <div className="glass rounded-xl px-3 py-2 text-right">
            <p className="font-display text-[9px] tracking-widest text-white/40 uppercase">
              Recorde
            </p>
            <p className="font-display text-lg leading-none font-bold tabular-nums">
              {recorde ? formataTempo(recorde) : "—"}
            </p>
          </div>
        </div>
      </header>

      {/* ---------- Progresso ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-[68px] mx-auto w-40 sm:w-56">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta transition-[width] duration-100"
            style={{ width: `${painel.progresso * 100}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[10px] tabular-nums text-white/30">
          {Math.round(painel.progresso * COMPRIMENTO)} / {COMPRIMENTO} m ·{" "}
          {Math.round(painel.velocidade * 3.6)} km/h
        </p>
      </div>

      {/* ---------- Controles de toque ---------- */}
      {emCorrida && (
        <>
          <div className="absolute bottom-4 left-4 flex flex-col gap-2 sm:hidden">
            <BotaoDirecao comandos={comandosRef} valor={-1} rotulo="↑" />
            <BotaoDirecao comandos={comandosRef} valor={1} rotulo="↓" />
          </div>
          <div className="absolute right-4 bottom-4 flex items-end gap-2 sm:hidden">
            <BotaoPressao
              rotulo="TURBO"
              cor="magenta"
              aoMudar={(v) => (comandosRef.current.turbo = v)}
            />
            <BotaoPressao
              rotulo="ACELERA"
              cor="cyan"
              aoMudar={(v) => (comandosRef.current.acelerar = v)}
            />
          </div>
        </>
      )}

      {/* Dica de teclado, só em tela grande */}
      {emCorrida && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 hidden text-center text-xs text-white/25 sm:block">
          Espaço acelera · Shift dá turbo · ↑ ↓ trocam de faixa e inclinam no ar
          · P pausa
        </p>
      )}

      {/* ---------- Camadas sobrepostas ---------- */}
      <AnimatePresence>
        {retrato && (
          <Sobreposicao key="girar">
            <p className="text-5xl">📱</p>
            <h2 className="mt-4 font-display text-2xl font-bold">
              Vire o celular
            </h2>
            <p className="mt-2 text-sm text-white/55">
              A corrida foi feita para a tela deitada — é assim que dá para ver
              a pista chegando.
            </p>
            <Botao onClick={telaCheia}>Tela cheia</Botao>
          </Sobreposicao>
        )}

        {!retrato && status === "pronto" && (
          <Sobreposicao key="pronto">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Moto<span className="text-neon-magenta">cross</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Acelere até a chegada. O turbo é mais rápido, mas esquenta o motor
              — se ferver, você para. Nas rampas, endireite a moto no ar antes
              de pousar, senão capota.
            </p>
            <Botao onClick={comecar}>Largada</Botao>
            <p className="mt-3 text-xs text-white/30">
              Espaço acelera · Shift dá turbo · ↑ ↓ mudam de faixa
            </p>
          </Sobreposicao>
        )}

        {!retrato && status === "pausado" && (
          <Sobreposicao key="pausado">
            <h2 className="font-display text-2xl font-bold">Pausado</h2>
            <p className="mt-2 text-sm text-white/55">
              A corrida pausa sozinha quando você troca de aba.
            </p>
            <Botao onClick={alternarPausa}>Continuar</Botao>
          </Sobreposicao>
        )}

        {!retrato && status === "terminou" && (
          <Sobreposicao key="terminou">
            <p className="font-display text-xs tracking-[0.3em] text-neon-cyan uppercase">
              Chegada
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tabular-nums">
              {formataTempo(painel.tempo)}
            </h2>
            <p className="mt-2 text-sm text-white/50">
              {recorde !== null && painel.tempo <= recorde
                ? "Novo recorde! 🏁"
                : `Seu recorde é ${recorde ? formataTempo(recorde) : "—"}`}
            </p>
            <Botao onClick={comecar}>Correr de novo</Botao>
          </Sobreposicao>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* Peças da interface                                                  */
/* ------------------------------------------------------------------ */

function Medidor({
  rotulo,
  valor,
  cor,
  aviso,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  aviso?: string;
}) {
  return (
    <div className="glass rounded-xl px-3 py-2">
      <p className="font-display text-[9px] tracking-widest text-white/40 uppercase">
        {aviso ?? rotulo}
      </p>
      <div className="mt-1 h-2 w-16 overflow-hidden rounded-full bg-white/10 sm:w-20">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{ width: `${valor * 100}%`, backgroundColor: cor }}
        />
      </div>
    </div>
  );
}

/**
 * Botão que vale enquanto está pressionado.
 *
 * Usamos eventos de ponteiro e capturamos o ponteiro: sem isso, arrastar o
 * dedo para fora do botão deixaria o comando ligado para sempre.
 */
function BotaoPressao({
  rotulo,
  cor,
  aoMudar,
}: {
  rotulo: string;
  cor: "cyan" | "magenta";
  aoMudar: (ligado: boolean) => void;
}) {
  const [ativo, setAtivo] = useState(false);

  const ligar = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setAtivo(true);
    aoMudar(true);
  };
  const desligar = () => {
    setAtivo(false);
    aoMudar(false);
  };

  return (
    <button
      onPointerDown={ligar}
      onPointerUp={desligar}
      onPointerCancel={desligar}
      onLostPointerCapture={desligar}
      className={`glass h-16 rounded-2xl px-5 font-display text-sm font-bold tracking-wider transition-colors ${
        cor === "cyan"
          ? ativo
            ? "bg-neon-cyan/35 text-white"
            : "text-neon-cyan"
          : ativo
            ? "bg-neon-magenta/35 text-white"
            : "text-neon-magenta"
      }`}
    >
      {rotulo}
    </button>
  );
}

function BotaoDirecao({
  comandos,
  valor,
  rotulo,
}: {
  comandos: React.RefObject<{ vertical: number }>;
  valor: number;
  rotulo: string;
}) {
  const ligar = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    comandos.current.vertical = valor;
  };
  const desligar = () => {
    // Só zera se ninguém tiver apertado o botão oposto no meio tempo.
    if (comandos.current.vertical === valor) comandos.current.vertical = 0;
  };

  return (
    <button
      onPointerDown={ligar}
      onPointerUp={desligar}
      onPointerCancel={desligar}
      onLostPointerCapture={desligar}
      aria-label={valor < 0 ? "Subir" : "Descer"}
      className="glass h-14 w-14 rounded-2xl text-xl text-white/70 active:bg-neon-cyan/25 active:text-white"
    >
      {rotulo}
    </button>
  );
}

function Sobreposicao({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-void/75 px-5 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="glass w-full max-w-md rounded-3xl p-6 text-center sm:p-8"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Botao({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-5 w-full rounded-xl bg-gradient-to-r from-neon-cyan to-neon-magenta px-6 py-3 font-display font-semibold text-void transition-transform hover:scale-[1.03] active:scale-95"
    >
      {children}
    </button>
  );
}
