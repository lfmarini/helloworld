import { Link } from "react-router";

export default function BackLink() {
  return (
    <Link
      to="/"
      className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 font-display text-xs tracking-widest text-white/70 uppercase transition-colors hover:text-white"
    >
      <span aria-hidden>←</span> Inicio
    </Link>
  );
}
