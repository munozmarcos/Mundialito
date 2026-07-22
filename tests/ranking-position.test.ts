import { describe, expect, it } from "vitest";
import { compareRankingRows, competitionRankForIndex, competitionRankMap, rankingRankForIndex } from "@/lib/ranking-position";

const rows = [
  { id: "a", points: 10 },
  { id: "b", points: 10 },
  { id: "c", points: 10 },
  { id: "d", points: 8 },
  { id: "e", points: 6 },
  { id: "f", points: 6 },
  { id: "g", points: 6 },
  { id: "h", points: 4 }
];

describe("ranking positions", () => {
  it("uses dense ranks for ties", () => {
    expect(rows.map((_, index) => competitionRankForIndex(rows, index, (row) => row.points))).toEqual([
      1, 1, 1, 2, 3, 3, 3, 4
    ]);
  });

  it("maps each user to the dense rank", () => {
    const ranks = competitionRankMap(rows, (row) => row.id, (row) => row.points);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("d")).toBe(2);
    expect(ranks.get("e")).toBe(3);
    expect(ranks.get("h")).toBe(4);
  });

  it("breaks ranking ties by total hits including podium and then exact hits", () => {
    const ranking = [
      { display_name: "A", total_points: 10, exact_hits: 2, trend_hits: 2, podium_champion_points: 0, podium_runner_up_points: 0, podium_third_place_points: 0 },
      { display_name: "B", total_points: 10, exact_hits: 2, trend_hits: 1, podium_champion_points: 3, podium_runner_up_points: 0, podium_third_place_points: 0 },
      { display_name: "C", total_points: 10, exact_hits: 3, trend_hits: 0, podium_champion_points: 0, podium_runner_up_points: 0, podium_third_place_points: 0 },
      { display_name: "D", total_points: 9, exact_hits: 9, trend_hits: 9, podium_champion_points: 3, podium_runner_up_points: 2, podium_third_place_points: 1 }
    ].sort(compareRankingRows);

    expect(ranking.map((row) => row.display_name)).toEqual(["B", "A", "C", "D"]);
    expect(ranking.map((_, index) => rankingRankForIndex(ranking, index))).toEqual([1, 2, 3, 4]);
  });
});
