import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Envolve cada pagina com a animacao de entrada/saida da transicao de rota. */
export default function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.main
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16, filter: "blur(8px)" }}
      transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`min-h-full ${className}`}
    >
      {children}
    </motion.main>
  );
}
