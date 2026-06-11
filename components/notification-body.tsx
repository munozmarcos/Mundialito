import { TeamLabel } from "@/components/team-label";
import type { LatestNotification } from "@/lib/notifications";

function pointClass(points: number) {
  if (points >= 3) return "border-grass/35 bg-grass/12 text-grass";
  if (points === 1) return "border-sky-300/35 bg-sky-400/12 text-sky-200";
  return "border-line bg-field text-ink/70";
}

function groupedPointPlayers(players: { name: string; points: number }[]) {
  const groups = new Map<number, string[]>();
  for (const player of players) {
    groups.set(player.points, [...(groups.get(player.points) ?? []), player.name]);
  }
  return [...groups.entries()].sort(([a], [b]) => b - a);
}

export function NotificationBody({ item, compact = false }: { item: LatestNotification; compact?: boolean }) {
  return (
    <div className={compact ? "mt-1 grid gap-1 text-sm font-semibold text-ink/70" : "mt-4 grid gap-3 text-base font-semibold leading-7 text-ink/78"}>
      {item.match && (
        <div className="flex flex-wrap items-center gap-3">
          <TeamLabel name={item.match.home_team} code={item.match.home_country_code} />
          {item.match.home_goals != null && item.match.away_goals != null && (
            <span className="rounded-lg border border-line bg-field px-3 py-1 text-lg font-black leading-none text-ink">
              {item.match.home_goals}-{item.match.away_goals}
            </span>
          )}
          {!(item.match.home_goals != null && item.match.away_goals != null) && <span className="text-ink/40">vs</span>}
          <TeamLabel name={item.match.away_team} code={item.match.away_country_code} />
        </div>
      )}
      {item.point_players?.length ? (
        <div className="grid gap-2">
          {groupedPointPlayers(item.point_players).map(([points, names]) => (
            <span className="text-sm font-semibold text-ink/78" key={points}>
              <span className={`mr-2 rounded-full border px-2 py-1 text-xs font-black ${pointClass(points)}`}>{points} Pts</span>
              <strong className="font-black text-ink">{names.join(", ")}</strong>
            </span>
          ))}
        </div>
      ) : (
        item.body && <p className="whitespace-pre-wrap">{item.body}</p>
      )}
    </div>
  );
}
