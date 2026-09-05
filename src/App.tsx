import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router";
import { AnimatePresence } from "framer-motion";
import Home from "./pages/Home";
import Loader from "./components/Loader";

// As telas pesadas (que carregam three.js) so sao baixadas quando o usuario
// entra nelas. Isso mantem o carregamento inicial da home leve.
const Snake = lazy(() => import("./pages/Snake"));
const Tuner = lazy(() => import("./pages/Tuner"));
const Corrida = lazy(() => import("./pages/Corrida"));
const Plataforma = lazy(() => import("./pages/Plataforma"));

export default function App() {
  const location = useLocation();

  return (
    // mode="wait" faz a pagina antiga terminar de sair antes da nova entrar.
    <AnimatePresence mode="wait">
      <Suspense key={location.pathname} fallback={<Loader />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/snake" element={<Snake />} />
          <Route path="/afinador" element={<Tuner />} />
          <Route path="/corrida" element={<Corrida />} />
          <Route path="/plataforma" element={<Plataforma />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}
