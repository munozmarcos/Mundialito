type PointsPillProps = {
  points: number;
  label?: string;
  className?: string;
};

export function pointsPillClass(points: number) {
  if (points >= 3) return "border-grass/30 bg-emerald-950/55 text-grass";
  if (points > 0) return "border-blue-300/30 bg-blue-950/45 text-blue-200";
  return "border-line bg-field text-ink/55";
}

export function PointsPill({ points, label, className = "" }: PointsPillProps) {
  return (
    <span className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-black ${pointsPillClass(points)} ${className}`}>
      {label ?? `${points} Pts`}
    </span>
  );
}
