import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { enviarRecado, listarRecados, type Recado } from "../lib/api";
import { tempoRelativo } from "../lib/tempo";
import { useNomeSalvo } from "../lib/useNomeSalvo";

/** Mesmos limites que o servidor aplica — aqui só para avisar antes de enviar. */
const NOME_MAX = 20;
const TEXTO_MAX = 280;

export default function Mural() {
  const [itens, setItens] = useState<Recado[] | null>(null);
  const [nome, salvarNome] = useNomeSalvo();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarRecados()
      .then((r) => vivo && setItens(r.itens))
      .catch((e: Error) => vivo && setErroCarga(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  const podeEnviar = nome.trim() !== "" && texto.trim() !== "" && !enviando;

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      // O servidor devolve a lista já atualizada, então não precisamos
      // perguntar de novo depois de enviar.
      const r = await enviarRecado(nome.trim(), texto.trim());
      setItens(r.itens);
      setTexto("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-8">
      <h2 className="font-display text-3xl font-bold sm:text-4xl">
        Mural de <span className="text-neon-magenta">recados</span>
      </h2>
      <p className="mt-2 text-sm text-white/45">
        Deixe um recado para quem passar por aqui.
      </p>

      {/* ---------- Formulário ---------- */}
      <form onSubmit={aoEnviar} className="glass mt-6 rounded-2xl p-4 sm:p-5">
        <input
          value={nome}
          onChange={(e) => salvarNome(e.target.value.slice(0, NOME_MAX))}
          placeholder="Seu nome"
          maxLength={NOME_MAX}
          aria-label="Seu nome"
          className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-neon-cyan/50 focus:outline-none"
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, TEXTO_MAX))}
          placeholder="Escreva seu recado…"
          rows={3}
          maxLength={TEXTO_MAX}
          aria-label="Seu recado"
          className="mt-3 w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-neon-cyan/50 focus:outline-none"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <span
            className={`text-xs tabular-nums ${
              texto.length > TEXTO_MAX - 30 ? "text-neon-magenta" : "text-white/30"
            }`}
          >
            {texto.length}/{TEXTO_MAX}
          </span>
          <button
            type="submit"
            disabled={!podeEnviar}
            className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-magenta px-6 py-2.5 font-display text-sm font-semibold text-void transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>

        {erro && (
          <p role="alert" className="mt-3 text-sm text-neon-magenta">
            {erro}
          </p>
        )}
      </form>

      {/* ---------- Lista ---------- */}
      <div className="mt-6 space-y-3">
        {erroCarga && (
          <p className="text-sm text-white/40">
            Não foi possível carregar os recados. {erroCarga}
          </p>
        )}

        {/* Enquanto carrega, mostramos blocos cinzas do tamanho aproximado dos
            recados: a página não "pula" quando o conteúdo real chega. */}
        {itens === null && !erroCarga && (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="glass h-20 animate-pulse rounded-2xl opacity-40"
              />
            ))}
          </>
        )}

        {itens?.length === 0 && (
          <p className="py-8 text-center text-sm text-white/35">
            Nenhum recado ainda. Seja o primeiro.
          </p>
        )}

        <AnimatePresence initial={false}>
          {itens?.map((recado) => (
            <motion.article
              key={recado.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-sm font-semibold text-neon-cyan">
                  {recado.nome}
                </span>
                <span className="shrink-0 text-xs text-white/30">
                  {tempoRelativo(recado.em)}
                </span>
              </div>
              {/* O React já escapa o texto: nada que a pessoa escrever vira
                  código na página. */}
              <p className="mt-2 text-sm leading-relaxed break-words text-white/70">
                {recado.texto}
              </p>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
