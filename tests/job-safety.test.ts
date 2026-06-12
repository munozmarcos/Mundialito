import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const jobFiles = [
  "app/api/jobs/lock-matches/route.ts",
  "app/api/jobs/notify-kickoff/route.ts",
  "app/api/jobs/notify-results/route.ts",
  "app/api/jobs/orchestrator/route.ts",
  "app/api/jobs/recalculate-all/route.ts",
  "app/api/jobs/send-daily-ranking/route.ts",
  "app/api/jobs/send-reminders/route.ts",
  "app/api/jobs/sync-fixtures/route.ts",
  "app/api/jobs/sync-results/route.ts",
  "lib/recalculate.ts",
  "lib/sync-results.ts"
];

describe("job safety", () => {
  it("does not let automatic jobs overwrite user prediction audit timestamps", () => {
    for (const file of jobFiles) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, `${file} should not write user_updated_at`).not.toContain("user_updated_at");
    }
  });
});
