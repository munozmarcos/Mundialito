export function ScoreWithPenalty({
  score,
  penalty,
  className = ""
}: {
  score: number | string | null | undefined;
  penalty?: number | null;
  className?: string;
}) {
  return (
    <span className={`inline-flex h-full w-full items-center justify-center gap-2 text-center font-black ${className}`}>
      <span className="leading-none">{score ?? ""}</span>
      {penalty != null && <span className="leading-none text-ink/55">({penalty})</span>}
    </span>
  );
}
