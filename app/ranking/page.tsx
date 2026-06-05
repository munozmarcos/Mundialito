import { PageHero } from "@/components/page-hero";
import { RankingContent } from "@/components/ranking-content";
import { getRanking, type RankingRow } from "@/lib/data";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  const ranking = await getRanking();

  return (
    <div className="grid gap-6">
      <PageHero
        badge="Ranking"
        icon={Trophy}
        title="Ranking"
        subtitle="Posiciones generales, puntos acumulados, exactos, tendencias y aciertos del podio anticipado."
      />

      <RankingContent
        ranking={ranking as RankingRow[]}
      />
    </div>
  );
}
