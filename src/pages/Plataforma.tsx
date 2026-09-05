import { Suspense, lazy, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageShell from "../components/PageShell";
import BackLink from "../components/BackLink";
import Loader from "../components/Loader";
import { usePlataforma } from "../lib/usePlataforma";
import { useTelaAcesa, useToque } from "../lib/useToque";

const PlataformaScene = lazy(
  () => import("../components/three/PlataformaScene"),
);

export default function Plataforma() {
  const jogo = usePlataforma();
  const { comandosRef, status, painel, recorde, comecar, alternarPausa } = jogo;
  const teclas = useRef(new Set<string>());
  const toque = useToque();

  useTelaAcesa(status === "jogando");

  /* ---------- Teclado ---------- */
  useEffect(() => {
    const aplicar = () => {
      const t = teclas.current;
      const esquerda = t.has("arrowleft") || t.has("a");
      const direita = t.has("arrowright") || t.has("d");
      comandosRef.current.horizontal = esquerda ? -1 : direita ? 1 : 0;
      comandosRef.current.pular =
        t.has(" ") || t.has("arrowup") || t.has("w") || t.has("z");
    };

    const aoApertar = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) {
        // Sem isso as setas e o espaço rolam a página durante o jogo.
        e.preventDefault();
      }
      if (k === "p" || k === "escape") {
        alternarPausa();
        return;
      }
      if (k === "enter" && status !== "jogando" && status !== "pausado") {
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
    // Ao perder o foco esquecemos as teclas: senão o personagem sairia
    // correndo sozinho, porque o "soltou" nunca chegaria.
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

  const jogando = status === "jogando";

  return (
    <PageShell className="relative h-dvh overflow-hidden bg-void select-none">
      <div
        className="absolute inset-0 touch-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <Suspense fallback={<Loader />}>
          <PlataformaScene jogo={jogo} />
        </Suspense>
      </div>

      {/* ---------- Painel ---------- */}
      <header
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4"
        style={{
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        }}
      >
        <div className="pointer-events-auto flex items-center gap-2">
          <BackLink />
          <Placar rotulo="Pontos" valor={painel.pontos} destaque />
        </div>

        <div className="flex items-start gap-2">
          <Placar rotulo="Moedas" valor={`🪙 ${painel.moedas}`} />
          <Placar rotulo="Vidas" valor={"❤".repeat(Math.max(0, painel.vidas))} />
          <Placar rotulo="Tempo" valor={Math.ceil(painel.tempo)} />
        </div>
      </header>

      {/* ---------- Progresso na fase ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-[62px] mx-auto w-36 sm:w-52">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta transition-[width] duration-150"
            style={{ width: `${painel.progresso * 100}%` }}
          />
        </div>
      </div>

      {/* ---------- Controles de toque ---------- */}
      {jogando && toque && (
        <>
          <div
            className="absolute bottom-0 left-0 flex gap-3 p-4"
            style={{
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            }}
          >
            <BotaoDirecao comandos={comandosRef} valor={-1} rotulo="←" />
            <BotaoDirecao comandos={comandosRef} valor={1} rotulo="→" />
          </div>
          <div
            className="absolute right-0 bottom-0 p-4"
            style={{
              paddingRight: "max(1rem, env(safe-area-inset-right))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            }}
          >
            <BotaoPular comandos={comandosRef} />
          </div>
        </>
      )}

      {jogando && !toque && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-white/25">
          ← → andam · Espaço pula (segure para pular mais alto) · P pausa
        </p>
      )}

      {/* ---------- Camadas sobrepostas ---------- */}
      <AnimatePresence>
        {status === "pronto" && (
          <Sobreposicao key="pronto">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Salto <span className="text-neon-cyan">Neon</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Corra até a bandeira. Pise nos inimigos para derrubá-los, bata de
              baixo nas caixas amarelas e não caia nos buracos.
            </p>
            <p className="mt-3 text-xs text-white/40">
              Segurar o botão de pulo pula mais alto — é assim que se passa pelos
              vãos maiores.
            </p>
            <Botao onClick={comecar}>Começar</Botao>
            {recorde > 0 && (
              <p className="mt-3 text-xs text-white/30">
                Seu recorde: {recorde} pontos
              </p>
            )}
          </Sobreposicao>
        )}

        {status === "pausado" && (
          <Sobreposicao key="pausado">
            <h2 className="font-display text-2xl font-bold">Pausado</h2>
            <p className="mt-2 text-sm text-white/55">
              O jogo pausa sozinho quando você troca de aba.
            </p>
            <Botao onClick={alternarPausa}>Continuar</Botao>
          </Sobreposicao>
        )}

        {status === "venceu" && (
          <Sobreposicao key="venceu">
            <p className="font-display text-xs tracking-[0.3em] text-neon-cyan uppercase">
              Chegou na bandeira
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tabular-nums">
              {painel.pontos}
            </h2>
            <p className="mt-2 text-sm text-white/50">
              {painel.moedas} moedas ·{" "}
              {painel.pontos >= recorde ? "novo recorde! 🏁" : `recorde: ${recorde}`}
            </p>
            <Botao onClick={comecar}>Jogar de novo</Botao>
          </Sobreposicao>
        )}

        {status === "acabou" && (
          <Sobreposicao key="acabou">
            <p className="font-display text-xs tracking-[0.3em] text-neon-magenta uppercase">
              Fim de jogo
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tabular-nums">
              {painel.pontos}
            </h2>
            <p className="mt-2 text-sm text-white/50">
              As três vidas acabaram. Recorde: {recorde}
            </p>
            <Botao onClick={comecar}>Tentar de novo</Botao>
          </Sobreposicao>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */

function Placar({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string | number;
  destaque?: boolean;
}) {
  return (
    <div className="glass rounded-xl px-3 py-2 text-right">
      <p className="font-display text-[9px] tracking-widest text-white/40 uppercase">
        {rotulo}
      </p>
      <p
        className={`font-display text-base leading-none font-bold tabular-nums ${
          destaque ? "text-neon-cyan" : "text-white"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

/**
 * Botões que valem enquanto estão pressionados.
 *
 * Capturamos o ponteiro para o comando não ficar preso ligado quando o dedo
 * escorrega para fora do botão.
 */
function BotaoDirecao({
  comandos,
  valor,
  rotulo,
}: {
  comandos: React.RefObject<{ horizontal: number }>;
  valor: number;
  rotulo: string;
}) {
  const ligar = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    comandos.current.horizontal = valor;
  };
  const desligar = () => {
    // Só zera se o outro lado não tiver sido apertado no meio tempo.
    if (comandos.current.horizontal === valor) comandos.current.horizontal = 0;
  };

  return (
    <button
      onPointerDown={ligar}
      onPointerUp={desligar}
      onPointerCancel={desligar}
      onLostPointerCapture={desligar}
      aria-label={valor < 0 ? "Esquerda" : "Direita"}
      className="glass h-16 w-16 rounded-2xl text-2xl text-white/70 active:bg-neon-cyan/25 active:text-white"
    >
      {rotulo}
    </button>
  );
}

function BotaoPular({
  comandos,
}: {
  comandos: React.RefObject<{ pular: boolean }>;
}) {
  const ligar = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    comandos.current.pular = true;
  };
  const desligar = () => {
    comandos.current.pular = false;
  };

  return (
    <button
      onPointerDown={ligar}
      onPointerUp={desligar}
      onPointerCancel={desligar}
      onLostPointerCapture={desligar}
      aria-label="Pular"
      className="glass h-20 w-24 rounded-2xl font-display text-sm font-bold tracking-wider text-neon-magenta active:bg-neon-magenta/35 active:text-white"
    >
      PULAR
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
