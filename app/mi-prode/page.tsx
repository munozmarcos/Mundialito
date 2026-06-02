import { PageHero } from "@/components/page-hero";
import { PredictionBoard } from "@/components/prediction-board";
import { getMatches, isDemoMode } from "@/lib/data";
import type { Match } from "@/lib/types";
import { Goal } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyProdePage() {
  const matches = (await getMatches()) as Match[];

  return (
    <div className="grid gap-6">
      <PageHero
        badge="Fixture"
        icon={Goal}
        title="Fixture y predicciones"
        subtitle="Completá cada partido desde la web y mirá cómo se arman tus tablas y llaves a medida que cargás resultados."
      />

      <PredictionBoard matches={matches} demoMode={isDemoMode()} />
    </div>
  );
}
