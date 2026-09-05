import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageShell from "../components/PageShell";
import BackLink from "../components/BackLink";
import Tabuleiro from "../components/Tabuleiro";
import { escreverLance } from "../lib/xadrez";
import { useXadrez, type Nivel } from "../lib/useXadrez";
import { resumoDaVantagem } from "../lib/xadrezIA";

const NOME_DO_NIVEL: Record<Nivel, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

const FIM: Record<string, string> = {
  vitoriaDasBrancas: "Xeque-mate — você ganhou! 🏆",
  vitoriaDasPretas: "Xeque-mate — o computador ganhou.",
  afogamento: "Empate por afogamento: quem joga não tem lance legal.",
  materialInsuficiente: "Empate: não sobrou material para dar mate.",
  regraDos50: "Empate pela regra dos 50 lances.",
};

export default function Xadrez() {
  const jogo = useXadrez();
  const {
    posicao,
    historico,
    legais,
    minhaVez,
    pensando,
    acabou,
    resultado,
    abertura,
    analise,
    assistente,
    setAssistente,
    nivel,
    escolherNivel,
    ultimoLance,
    podeDesfazer,
    jogar,
    desfazer,
    reiniciar,
  } = jogo;

  const [verAlternativas, setVerAlternativas] = useState(false);
  const sugestao = assistente && analise?.sugestoes[0]?.lance;
  const ultimoDoComputador = [...historico]
    .reverse()
    .find((h) => h.cor === "pretas");

  return (
    <PageShell className="min-h-dvh bg-void">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackLink />
            <h1 className="font-display text-xl font-bold sm:text-2xl">
              Xadrez <span className="text-neon-cyan">assistido</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="glass flex rounded-xl p-1">
              {(["facil", "medio", "dificil"] as Nivel[]).map((n) => (
                <button
                  key={n}
                  onClick={() => escolherNivel(n)}
                  className={`rounded-lg px-3 py-1.5 font-display text-xs transition-colors ${
                    n === nivel
                      ? "bg-neon-cyan/20 text-neon-cyan"
                      : "text-white/45 hover:text-white/80"
                  }`}
                >
                  {NOME_DO_NIVEL[n]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAssistente((a) => !a)}
              className={`glass rounded-xl px-3 py-2 font-display text-xs transition-colors ${
                assistente ? "text-neon-cyan" : "text-white/45"
              }`}
            >
              {assistente ? "Assistente ligado" : "Assistente desligado"}
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ---------------- Tabuleiro ---------------- */}
          <div>
            <Tabuleiro
              posicao={posicao}
              legais={legais}
              minhaVez={minhaVez}
              ultimoLance={ultimoLance}
              sugestao={sugestao || null}
              aoJogar={jogar}
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={reiniciar}
                className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 font-display text-sm font-semibold text-void transition-transform hover:scale-[1.03] active:scale-95"
              >
                Nova partida
              </button>
              <button
                onClick={desfazer}
                disabled={!podeDesfazer}
                className="glass rounded-xl px-4 py-2 font-display text-sm text-white/70 transition-colors hover:text-white disabled:opacity-30"
              >
                Voltar lance
              </button>
              <span className="ml-auto text-xs text-white/40">
                {acabou
                  ? "Partida encerrada"
                  : pensando
                    ? "O computador está pensando…"
                    : "Sua vez (peças claras)"}
              </span>
            </div>
          </div>

          {/* ---------------- Painel do assistente ---------------- */}
          <aside className="space-y-3">
            {acabou && (
              <div className="glass rounded-2xl border-neon-cyan/30 p-4">
                <p className="font-display font-semibold text-neon-cyan">
                  {FIM[resultado] ?? "Fim de partida."}
                </p>
              </div>
            )}

            {abertura && historico.length <= 10 && (
              <div className="glass rounded-2xl p-4">
                <p className="font-display text-[10px] tracking-widest text-white/40 uppercase">
                  Abertura
                </p>
                <p className="mt-1 font-display font-semibold text-neon-magenta">
                  {abertura.nome}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  {abertura.ideia}
                </p>
              </div>
            )}

            {ultimoDoComputador && (
              <div className="glass rounded-2xl p-4">
                <p className="font-display text-[10px] tracking-widest text-white/40 uppercase">
                  O computador jogou
                </p>
                <p className="mt-1 font-display text-lg font-bold">
                  {ultimoDoComputador.texto}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  {ultimoDoComputador.explicacao}
                </p>
              </div>
            )}

            {assistente && (
              <AnimatePresence mode="wait">
                {analise ? (
                  <motion.div
                    key="analise"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {analise.avisos.length > 0 && (
                      <div className="glass rounded-2xl border-neon-magenta/30 p-4">
                        <p className="font-display text-[10px] tracking-widest text-neon-magenta uppercase">
                          Atenção
                        </p>
                        <ul className="mt-2 space-y-1">
                          {analise.avisos.map((a) => (
                            <li key={a} className="text-sm text-white/70">
                              • {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analise.sugestoes[0] && (
                      <div className="glass rounded-2xl p-4">
                        <p className="font-display text-[10px] tracking-widest text-white/40 uppercase">
                          Sugestão
                        </p>
                        <p className="mt-1 font-display text-lg font-bold text-neon-cyan">
                          {escreverLance(posicao, analise.sugestoes[0].lance)}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">
                          {analise.sugestoes[0].explicacao}
                        </p>

                        {analise.sugestoes.length > 1 && (
                          <>
                            <button
                              onClick={() => setVerAlternativas((v) => !v)}
                              className="mt-3 font-display text-xs tracking-wider text-white/40 uppercase transition-colors hover:text-white/70"
                            >
                              {verAlternativas ? "Esconder" : "Ver"} outras opções
                            </button>
                            {verAlternativas && (
                              <ul className="mt-2 space-y-2 border-t border-white/10 pt-2">
                                {analise.sugestoes.slice(1).map((s, i) => (
                                  <li key={i} className="text-sm">
                                    <span className="font-display font-semibold text-white/80">
                                      {escreverLance(posicao, s.lance)}
                                    </span>
                                    <span className="text-white/50">
                                      {" "}
                                      — {s.explicacao}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}

                        <p className="mt-3 border-t border-white/10 pt-2 text-xs text-white/40">
                          {resumoDaVantagem(analise.vantagem)}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  !acabou && (
                    <motion.div
                      key="pensando"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="glass rounded-2xl p-4 text-sm text-white/40"
                    >
                      Analisando a posição…
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            )}

            {historico.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <p className="font-display text-[10px] tracking-widest text-white/40 uppercase">
                  Lances
                </p>
                <ol className="mt-2 grid max-h-40 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto text-sm tabular-nums">
                  {historico.map((h, i) => (
                    <li key={i} className="flex gap-2">
                      {i % 2 === 0 && (
                        <span className="text-white/30">{i / 2 + 1}.</span>
                      )}
                      <span
                        className={
                          h.cor === "brancas" ? "text-white/80" : "text-white/55"
                        }
                      >
                        {h.texto}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
