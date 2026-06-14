import { describe, expect, it } from "vitest";
import { competitionRankForIndex, competitionRankMap } from "@/lib/ranking-position";

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
});
