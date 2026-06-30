import { describe, expect, it } from "vitest";
import { footballDataScore, teamsMatch } from "@/lib/results-provider";

describe("result provider matching", () => {
  it("normalizes accents and case for team names", () => {
    expect(teamsMatch("Mexico", "mexico")).toBe(true);
    expect(teamsMatch("Cote d'Ivoire", "cote d'ivoire")).toBe(true);
  });

  it("keeps penalty shootout goals out of the main score", () => {
    const result = footballDataScore({
      id: 537415,
      utcDate: "2026-06-29T20:30:00Z",
      status: "FINISHED",
      score: {
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 4, away: 5 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 4, away: 4 }
      }
    } as any);

    expect(result.score).toEqual({ home: 1, away: 1 });
    expect(result.penalties).toEqual({ home: 3, away: 4 });
  });
});
