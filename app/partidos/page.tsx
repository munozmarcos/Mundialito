import { EmptyState } from "@/components/empty-state";
import { MatchesExplorer } from "@/components/matches-explorer";
import { PageHero } from "@/components/page-hero";
import { getMatches } from "@/lib/data";
import type { Match } from "@/lib/types";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = (await getMatches()) as Match[];

  return (
    <div className="grid gap-6">
      <PageHero
        badge="Calendario"
        icon={CalendarDays}
        title="Partidos"
        subtitle="Calendario completo del Mundialito con horarios en Argentina, fase y estado de bloqueo."
      >
        <Link className="btn" href="/mi-prode">
          Ir a Pronósticos
        </Link>
      </PageHero>

      {!matches.length ? (
        <EmptyState title="Sin partidos" text="Carga el calendario desde Admin." />
      ) : (
        <MatchesExplorer matches={matches} />
      )}
    </div>
  );
}
