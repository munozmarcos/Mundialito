import type { MatchStatus } from "@/lib/types";

type PillStatus = MatchStatus | "payment_pending";

const labels: Record<PillStatus, string> = {
  open: "Abierto",
  locked: "Bloqueado",
  closed: "Cerrado",
  closing_soon: "Cierra pronto",
  playing: "Jugando",
  payment_pending: "Pago pendiente",
};

const styles: Record<PillStatus, string> = {
  open: "border-emerald-500/30 bg-emerald-950/70 text-emerald-200",
  locked: "border-sky-500/25 bg-slate-800/80 text-sky-100",
  closed: "border-slate-500/30 bg-slate-900/70 text-slate-200",
  closing_soon: "border-gold/35 bg-yellow-950/70 text-gold",
  playing: "border-blue-400/35 bg-blue-950/80 text-blue-100",
  payment_pending: "border-red-500/35 bg-red-500/15 text-red-200",
};

export function StatusPill({ status, label }: { status: PillStatus; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${styles[status] ?? styles.closed}`}>
      {label ?? labels[status] ?? status}
    </span>
  );
}
