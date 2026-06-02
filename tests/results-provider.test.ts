import { describe, expect, it } from "vitest";
import { teamsMatch } from "@/lib/results-provider";

describe("result provider matching", () => {
  it("normalizes accents and case for team names", () => {
    expect(teamsMatch("Mexico", "mexico")).toBe(true);
    expect(teamsMatch("Cote d'Ivoire", "cote d'ivoire")).toBe(true);
  });
});
