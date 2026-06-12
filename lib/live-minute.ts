export function liveMinuteLabel(kickoffAt: string | Date, now = new Date()) {
  const kickoff = new Date(kickoffAt).getTime();
  const current = now.getTime();
  if (!Number.isFinite(kickoff) || !Number.isFinite(current) || current < kickoff) return null;

  const elapsed = Math.floor((current - kickoff) / 60_000);
  if (elapsed <= 0) return "1'";
  if (elapsed <= 45) return `${elapsed}'`;
  if (elapsed <= 60) return "45'";
  return `${Math.min(120, elapsed - 15)}'`;
}
