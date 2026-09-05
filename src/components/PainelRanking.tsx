import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  enviarPontuacao,
  listarRanking,
  type JogoDoRanking,
  type Pontuacao,
} from "../lib/api";
import { useNomeSalvo } from "../lib/useNomeSalvo";

const NOME_MAX = 20;

/** Medalhas para as três primeiras posições. */
const MEDALHAS = ["🥇", "🥈", "🥉"];

export default function PainelRanking({
  jogo,
  pontos,
  aoVoltar,
  formatar = (v) => String(v),
  rotuloEnvio,
}: {
  jogo: JogoDoRanking;
  /** Marca recém-feita. Zero significa "só vim olhar a lista". */
  pontos: number;
  aoVoltar: () => void;
  /**
   * Como mostrar o valor. Na corrida ele é tempo em centésimos de segundo, e
   * "5436" na tela não diria nada a ninguém.
   */
  formatar?: (valor: number) => string;
  rotuloEnvio?: string;
}) {
  const [itens, setItens] = useState<Pontuacao[] | null>(null);
  const [nome, salvarNome] = useNomeSalvo();
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarRanking(jogo)
      .then((r) => vivo && setItens(r.itens))
      .catch((e: Error) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [jogo]);

  async function entrarNoRanking() {
    if (!nome.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarPontuacao(jogo, nome.trim(), pontos);
      setItens(r.itens);
      setEnviado(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const meuNome = nome.trim().toLowerCase();

  return (
    <div className="text-left">
      <p className="text-center font-display text-xs tracking-[0.3em] text-neon-cyan uppercase">
        Ranking
      </p>

      {/* ---------- Entrar no ranking ---------- */}
      {pontos > 0 && !enviado && (
        <div className="mt-4 flex gap-2">
          <input
            value={nome}
            onChange={(e) => salvarNome(e.target.value.slice(0, NOME_MAX))}
            onKeyDown={(e) => e.key === "Enter" && entrarNoRanking()}
            placeholder="Seu nome"
            maxLength={NOME_MAX}
            aria-label="Seu nome no ranking"
            className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-neon-cyan/50 focus:outline-none"
          />
          <button
            onClick={entrarNoRanking}
            disabled={!nome.trim() || enviando}
            className="shrink-0 rounded-xl bg-neon-cyan/20 px-4 py-2.5 font-display text-sm font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/30 disabled:opacity-40"
          >
            {enviando ? "…" : (rotuloEnvio ?? `Enviar ${formatar(pontos)}`)}
          </button>
        </div>
      )}

      {enviado && (
        <p className="mt-4 text-center text-sm text-neon-cyan">
          Pontuação enviada!
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-center text-sm text-neon-magenta">
          {erro}
        </p>
      )}

      {/* ---------- Lista ---------- */}
      <div className="mt-4 max-h-56 space-y-1 overflow-y-auto pr-1">
        {itens === null && !erro && (
          <p className="py-6 text-center text-sm text-white/30">Carregando…</p>
        )}

        {itens?.length === 0 && (
          <p className="py-6 text-center text-sm text-white/35">
            Ninguém no ranking ainda. Seja o primeiro.
          </p>
        )}

        {itens?.map((item, i) => {
          const meu = item.nome.toLowerCase() === meuNome;
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                meu ? "bg-neon-cyan/10" : ""
              }`}
            >
              <span className="w-6 shrink-0 text-center text-sm tabular-nums text-white/35">
                {MEDALHAS[i] ?? i + 1}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  meu ? "text-neon-cyan" : "text-white/75"
                }`}
              >
                {item.nome}
              </span>
              <span className="shrink-0 font-display text-sm font-bold tabular-nums text-white">
                {formatar(item.pontos)}
              </span>
            </motion.div>
          );
        })}
      </div>

      <button
        onClick={aoVoltar}
        className="mt-5 w-full rounded-xl bg-white/5 px-6 py-3 font-display font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        Voltar
      </button>
    </div>
  );
}
