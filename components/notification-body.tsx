import { TeamLabel } from "@/components/team-label";
import type { LatestNotification } from "@/lib/notifications";

function pointClass(points: number) {
  if (points >= 3) return "border-grass/35 bg-grass/12 text-grass";
  if (points === 1) return "border-sky-300/35 bg-sky-400/12 text-sky-200";
  return "border-line bg-field text-ink/70";
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
        <div className="flex flex-wrap gap-2">
          {item.point_players.map((player) => (
            <span className="rounded-full border border-line bg-field/70 px-2.5 py-1 text-xs font-black text-ink" key={`${player.name}-${player.points}`}>
              {player.name}{" "}
              <span className={`ml-1 rounded-full border px-1.5 py-0.5 ${pointClass(player.points)}`}>+{player.points}</span>
            </span>
          ))}
        </div>
      ) : (
        item.body && <p className="whitespace-pre-wrap">{item.body}</p>
      )}
    </div>
  );
}
