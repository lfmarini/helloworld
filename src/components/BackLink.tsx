import { Link } from "react-router";

export default function BackLink() {
  return (
    <Link
      to="/"
      // min-h-11 (44px) e o tamanho minimo confortavel para o polegar; com
      // padding pequeno o alvo ficava em 34px e escapava com facilidade.
      className="glass inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 font-display text-xs tracking-widest text-white/70 uppercase transition-colors hover:text-white"
    >
      <span aria-hidden>←</span> Início
    </Link>
  );
}
