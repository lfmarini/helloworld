import { Suspense, lazy } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import PageShell from "../components/PageShell";

// O fundo 3D e carregado por ultimo e em separado: a home aparece na hora,
// e o three.js chega depois sem travar o primeiro desenho da tela.
const HomeScene = lazy(() => import("../components/three/HomeScene"));

const cards = [
  {
    to: "/snake",
    emoji: "🐍",
    title: "Cobrinha 3D",
    desc: "O classico, agora em tres dimensoes, com brilho neon e particulas.",
    accent: "from-neon-cyan/25",
    ring: "group-hover:border-neon-cyan/50",
  },
  {
    to: "/afinador",
    emoji: "🎸",
    title: "Afinador",
    desc: "Afine seu violao pelo microfone, com precisao em cents.",
    accent: "from-neon-magenta/25",
    ring: "group-hover:border-neon-magenta/50",
  },
];

export default function Home() {
  return (
    <PageShell className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Camada 3D de fundo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Suspense fallback={null}>
          <HomeScene />
        </Suspense>
      </div>
      {/* Vinheta escura pra garantir contraste do texto sobre a cena */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-radial-[at_50%_45%] from-transparent to-void/90" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-xs tracking-[0.35em] text-neon-cyan/80 uppercase"
        >
          Feito no navegador
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-4 font-display text-5xl leading-[0.95] font-bold sm:text-7xl"
        >
          Hello
          <span className="bg-gradient-to-r from-neon-cyan to-neon-magenta bg-clip-text text-transparent">
            World
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="mt-5 max-w-md text-base text-white/60 sm:text-lg"
        >
          Duas ferramentas em uma so pagina. Instalavel no celular e funciona
          sem internet.
        </motion.p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {cards.map((card, i) => (
            <motion.div
              key={card.to}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34 + i * 0.08 }}
            >
              <Link
                to={card.to}
                className={`group glass block h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 ${card.ring}`}
              >
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.accent} to-transparent text-2xl`}
                >
                  {card.emoji}
                </div>
                <h2 className="font-display text-xl font-semibold">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {card.desc}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 font-display text-xs tracking-widest text-white/70 uppercase transition-transform group-hover:translate-x-1">
                  Abrir <span aria-hidden>→</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
