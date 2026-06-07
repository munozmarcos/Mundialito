type Props = {
  exacts: number;
  trends: number;
  championPoints?: number | null;
  runnerUpPoints?: number | null;
  thirdPlacePoints?: number | null;
  className?: string;
};

function StatChip({ value, className }: { value: number; className: string }) {
  return (
    <span className={`inline-grid h-5 min-w-5 place-items-center rounded-full border px-1.5 text-[11px] font-black leading-none ${className}`}>
      {value}
    </span>
  );
}

export function RankingDescription({
  exacts,
  trends,
  championPoints = 0,
  runnerUpPoints = 0,
  thirdPlacePoints = 0,
  className = "text-sm text-ink/60"
}: Props) {
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-1">
        <StatChip value={exacts} className="border-grass/35 bg-emerald-950/45 text-grass" />
        <span>exactos</span>
      </span>
      <span className="text-ink/35">-</span>
      <span className="inline-flex items-center gap-1">
        <StatChip value={trends} className="border-blue-300/35 bg-blue-950/45 text-blue-200" />
        <span>tendencias</span>
      </span>
      <span className="text-ink/35">-</span>
      <span className="inline-flex items-center gap-1">
        <StatChip value={championPoints ?? 0} className="border-yellow-300/45 bg-yellow-300/12 text-yellow-200" />
        <StatChip value={runnerUpPoints ?? 0} className="border-slate-200/45 bg-slate-200/12 text-slate-100" />
        <StatChip value={thirdPlacePoints ?? 0} className="border-orange-300/45 bg-orange-400/12 text-orange-200" />
      </span>
      <span>podio</span>
    </span>
  );
}
