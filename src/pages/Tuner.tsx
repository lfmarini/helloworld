import PageShell from "../components/PageShell";
import BackLink from "../components/BackLink";

export default function Tuner() {
  return (
    <PageShell className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <BackLink />
      <h1 className="font-display text-3xl font-bold">Afinador</h1>
      <p className="text-white/50">Chega na próxima versão.</p>
    </PageShell>
  );
}
