import type { MatchStatus } from "@/lib/types";

const labels: Record<MatchStatus, string> = {
  open: "Abierto",
  locked: "Bloqueado",
  closed: "Cerrado",
  closing_soon: "Cierra pronto",
  playing: "Jugando",
};

const styles: Record<MatchStatus, string> = {
  open: "border-emerald-500/30 bg-emerald-950/70 text-emerald-200",
  locked: "border-sky-500/25 bg-slate-800/80 text-sky-100",
  closed: "border-slate-500/30 bg-slate-900/70 text-slate-200",
  closing_soon: "border-gold/35 bg-yellow-950/70 text-gold",
  playing: "border-blue-400/35 bg-blue-950/80 text-blue-100",
};

export function StatusPill({ status, label }: { status: MatchStatus; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${styles[status] ?? styles.closed}`}>
      {label ?? labels[status] ?? status}
    </span>
  );
}
