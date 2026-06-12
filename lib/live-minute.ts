export function liveMinuteLabel(kickoffAt: string | Date, now = new Date()) {
  const kickoff = new Date(kickoffAt).getTime();
  const current = now.getTime();
  if (!Number.isFinite(kickoff) || !Number.isFinite(current) || current < kickoff) return null;

  const elapsed = Math.floor((current - kickoff) / 60_000);
  if (elapsed <= 0) return "1'";

  // Estimated match clock: 15' halftime and two 3' cooling breaks, one per half.
  if (elapsed <= 25) return `${elapsed}'`;
  if (elapsed <= 28) return "25'";
  if (elapsed <= 48) return `${Math.min(45, elapsed - 3)}'`;
  if (elapsed <= 63) return "45'";

  const secondHalfElapsed = elapsed - 18;
  if (secondHalfElapsed <= 70) return `${secondHalfElapsed}'`;
  if (secondHalfElapsed <= 73) return "70'";
  return `${Math.min(120, secondHalfElapsed - 3)}'`;
}
