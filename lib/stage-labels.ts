import type { MatchStage } from "@/lib/types";

const stageLabels: Record<MatchStage, string> = {
  GROUP: "Grupos",
  R32: "16vos",
  R16: "8vos",
  QF: "4tos",
  SF: "Semis",
  THIRD_PLACE: "3er Puesto",
  FINAL: "Final"
};

export function stageLabel(stage?: string | null) {
  return stageLabels[(stage ?? "") as MatchStage] ?? stage ?? "Partido";
}
