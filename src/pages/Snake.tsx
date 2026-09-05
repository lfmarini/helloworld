import PageShell from "../components/PageShell";
import BackLink from "../components/BackLink";

export default function Snake() {
  return (
    <PageShell className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <BackLink />
      <h1 className="font-display text-3xl font-bold">Cobrinha 3D</h1>
      <p className="text-white/50">Em construção.</p>
    </PageShell>
  );
}
