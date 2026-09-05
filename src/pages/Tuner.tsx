import { Suspense, lazy, useState } from "react";
import { motion } from "framer-motion";
import PageShell from "../components/PageShell";
import BackLink from "../components/BackLink";
import Fretboard from "../components/Fretboard";
import { TUNINGS } from "../lib/tunings";
import { useTuner, type TunerError } from "../lib/useTuner";

const TunerScene = lazy(() => import("../components/three/TunerScene"));

/** Mesma faixa usada pela agulha 3D. */
const IN_TUNE = 5;

/** Mensagens de erro em português, uma para cada causa provável. */
const ERROS: Record<TunerError, { titulo: string; texto: string }> = {
  denied: {
    titulo: "Permissão negada",
    texto:
      "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço do site e libere o microfone, depois tente de novo.",
  },
  notfound: {
    titulo: "Nenhum microfone encontrado",
    texto:
      "Não achamos nenhum microfone conectado. Ligue um fone com microfone ou verifique as configurações de som do aparelho.",
  },
  unsupported: {
    titulo: "Navegador sem suporte",
    texto:
      "Este navegador não permite capturar áudio. Tente pelo Chrome, Edge, Firefox ou Safari atualizados.",
  },
  insecure: {
    titulo: "Conexão não segura",
    texto:
      "Por segurança, o microfone só funciona em endereços HTTPS. Abra o site pelo endereço com https:// no começo.",
  },
  unknown: {
    titulo: "Não foi possível abrir o microfone",
    texto:
      "Algo deu errado ao acessar o microfone. Verifique se outro programa não está usando ele e tente novamente.",
  },
};

function corDoDesvio(cents: number) {
  const d = Math.abs(cents);
  if (d <= IN_TUNE) return "#3ce88a";
  if (d <= 20) return "#f5d33c";
  return "#f0456e";
}

export default function Tuner() {
  const [tuningId, setTuningId] = useState(TUNINGS[0].id);
  const tuning = TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0];
  const tuner = useTuner(tuning);
  const { status, error, reading, start, stop } = tuner;

  const cents = reading?.cents ?? 0;
  const afinada = reading != null && Math.abs(cents) <= IN_TUNE;
  const cor = reading ? corDoDesvio(cents) : "#64748b";

  // Instrução em português claro. Corda frouxa soa grave (cents negativo) e
  // precisa ser apertada; corda esticada demais soa aguda e precisa soltar.
  const instrucao = !reading
    ? "Toque uma corda"
    : afinada
      ? "Afinada!"
      : cents < 0
        ? "Aperte a corda"
        : "Solte a corda";

  return (
    <PageShell className="flex min-h-dvh flex-col bg-void">
      <header className="flex items-center justify-between gap-3 p-4 sm:p-6">
        <BackLink />
        {status === "listening" && (
          <button
            onClick={stop}
            className="glass rounded-full px-4 py-2 font-display text-xs tracking-widest text-white/60 uppercase transition-colors hover:text-white"
          >
            Desligar microfone
          </button>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-8 sm:px-6">
        {/* ---------- Seletor de afinação ---------- */}
        <div className="glass mb-5 flex gap-1 rounded-2xl p-1">
          {TUNINGS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTuningId(t.id)}
              className={`flex-1 rounded-xl px-2 py-2 text-center transition-colors ${
                t.id === tuningId
                  ? "bg-neon-cyan/15 text-neon-cyan"
                  : "text-white/45 hover:text-white/80"
              }`}
            >
              <span className="block font-display text-xs font-semibold">{t.name}</span>
              <span className="block text-[10px] text-white/30">{t.hint}</span>
            </button>
          ))}
        </div>

        {/* ---------- Mostrador ---------- */}
        <div className="glass relative overflow-hidden rounded-3xl">
          <div className="h-52 sm:h-60">
            {status === "listening" ? (
              <Suspense fallback={null}>
                <TunerScene tuner={tuner} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/35">
                {status === "requesting"
                  ? "Aguardando sua permissão…"
                  : "Ligue o microfone para começar a afinar"}
              </div>
            )}
          </div>

          {/* Leitura numérica sobreposta ao mostrador */}
          {status === "listening" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
              <div>
                <p
                  className="font-display text-5xl leading-none font-bold tabular-nums transition-colors"
                  style={{ color: cor }}
                >
                  {reading ? reading.note : "—"}
                </p>
                <p className="mt-1 text-xs text-white/40 tabular-nums">
                  {reading ? `${reading.frequency.toFixed(1)} Hz` : "sem sinal"}
                </p>
              </div>
              <p
                className="font-display text-2xl font-semibold tabular-nums"
                style={{ color: cor }}
              >
                {reading ? `${cents > 0 ? "+" : ""}${cents.toFixed(0)}` : "—"}
                <span className="ml-1 text-xs text-white/30">cents</span>
              </p>
            </div>
          )}
        </div>

        {/* ---------- Instrução ---------- */}
        {status === "listening" && (
          <div className="mt-5 text-center">
            {/* Sem animação de troca aqui de propósito: num afinador a
                instrução precisa mudar no mesmo instante em que a corda muda.
                Uma transição de entrada/saída, por curta que seja, atrasaria
                o texto justo quando ele mais importa. Só a cor faz transição,
                e o "Afinada!" ganha uma batida sutil de confirmação. */}
            <motion.p
              animate={afinada ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className="font-display text-2xl font-bold transition-colors duration-200"
              style={{ color: reading ? cor : undefined }}
            >
              {instrucao}
            </motion.p>
            {reading && (
              <p className="mt-1 text-sm text-white/40">
                Corda {6 - reading.stringIndex}ª ·{" "}
                {tuning.strings[reading.stringIndex].note}
              </p>
            )}
          </div>
        )}

        {/* ---------- Braço do violão ---------- */}
        <div className="mt-6">
          <Fretboard
            strings={tuning.strings}
            activeIndex={reading ? reading.stringIndex : -1}
            color={cor}
          />
        </div>

        <div className="flex-1" />

        {/* ---------- Botão / erros ---------- */}
        {status === "error" && error && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass mt-6 rounded-2xl border-neon-magenta/25 p-5"
          >
            <p className="font-display font-semibold text-neon-magenta">
              {ERROS[error].titulo}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {ERROS[error].texto}
            </p>
          </motion.div>
        )}

        {status !== "listening" && (
          <button
            onClick={start}
            disabled={status === "requesting"}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-magenta px-6 py-4 font-display text-lg font-semibold text-void transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {status === "requesting"
              ? "Pedindo permissão…"
              : status === "error"
                ? "Tentar de novo"
                : "Ativar microfone"}
          </button>
        )}

        {status === "idle" && (
          <p className="mt-3 text-center text-xs leading-relaxed text-white/30">
            O som não sai do seu aparelho: a análise acontece toda dentro do
            navegador, e nada é gravado ou enviado.
          </p>
        )}
      </div>
    </PageShell>
  );
}
