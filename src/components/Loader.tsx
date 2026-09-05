export default function Loader() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-void">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-neon-cyan" />
        <p className="font-display text-sm tracking-widest text-white/40 uppercase">
          Carregando
        </p>
      </div>
    </div>
  );
}
