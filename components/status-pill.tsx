import type { MatchStatus } from "@/lib/types";

const labels: Record<MatchStatus, string> = {
  scheduled: "Programado",
  open: "Abierto",
  closing_soon: "Cierra pronto",
  locked: "Bloqueado",
  final: "Finalizado"
};

const styles: Record<MatchStatus, string> = {
  scheduled: "border-slate-500/30 bg-slate-900/70 text-slate-200",
  open: "border-emerald-500/30 bg-emerald-950/70 text-emerald-200",
  closing_soon: "border-gold/35 bg-yellow-950/70 text-gold",
  locked: "border-sky-500/25 bg-slate-800/80 text-sky-100",
  final: "border-blue-500/30 bg-blue-950/70 text-blue-100"
};

export function StatusPill({ status }: { status: MatchStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${styles[status] ?? styles.scheduled}`}>
      {labels[status] ?? status}
    </span>
  );
}
