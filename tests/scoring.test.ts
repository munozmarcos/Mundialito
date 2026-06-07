import { describe, expect, it } from "vitest";
import { isPredictionLocked, scorePrediction } from "@/lib/scoring";

describe("group scoring from the Qatar 2022 rules Excel", () => {
  it("gives 1 point for the correct trend", () => {
    const result = scorePrediction({
      stage: "GROUP",
      predictedHomeGoals: 1,
      predictedAwayGoals: 0,
      actualHomeGoals: 2,
      actualAwayGoals: 1
    });

    expect(result.points).toBe(1);
    expect(result.trendHit).toBe(true);
    expect(result.exactHit).toBe(false);
  });

  it("gives 3 points for exact group result", () => {
    const result = scorePrediction({
      stage: "GROUP",
      predictedHomeGoals: 2,
      predictedAwayGoals: 1,
      actualHomeGoals: 2,
      actualAwayGoals: 1
    });

    expect(result.points).toBe(3);
    expect(result.exactHit).toBe(true);
    expect(result.trendHit).toBe(false);
  });

  it("scores draws by trend and exact result", () => {
    expect(
      scorePrediction({
        stage: "GROUP",
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        actualHomeGoals: 0,
        actualAwayGoals: 0
      }).points
    ).toBe(1);

    expect(
      scorePrediction({
        stage: "GROUP",
        predictedHomeGoals: 0,
        predictedAwayGoals: 0,
        actualHomeGoals: 0,
        actualAwayGoals: 0
      }).points
    ).toBe(3);
  });

  it("gives 0 when trend is wrong", () => {
    const result = scorePrediction({
      stage: "GROUP",
      predictedHomeGoals: 0,
      predictedAwayGoals: 0,
      actualHomeGoals: 2,
      actualAwayGoals: 1
    });

    expect(result.points).toBe(0);
  });
});

describe("locking", () => {
  it("locks predictions at 15 minutes before kickoff", () => {
    const now = new Date("2026-06-11T14:00:00Z");
    const kickoff = new Date("2026-06-11T14:15:00Z");
    expect(isPredictionLocked(kickoff, false, now)).toBe(true);
  });

  it("keeps predictions open before the 15-minute window", () => {
    const now = new Date("2026-06-11T14:00:00Z");
    const kickoff = new Date("2026-06-11T14:16:00Z");
    expect(isPredictionLocked(kickoff, false, now)).toBe(false);
  });
});

describe("knockout scoring", () => {
  it("uses the same 1 plus 2 exact rule in knockout matches", () => {
    expect(
      scorePrediction({
        stage: "R16",
        predictedHomeGoals: 2,
        predictedAwayGoals: 2,
        actualHomeGoals: 1,
        actualAwayGoals: 1
      }).points
    ).toBe(1);

    expect(
      scorePrediction({
        stage: "R16",
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        actualHomeGoals: 1,
        actualAwayGoals: 1
      }).points
    ).toBe(3);
  });
});
