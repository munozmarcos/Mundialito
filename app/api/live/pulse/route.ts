import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { syncFixturesFromProvider } from "@/lib/sync-fixtures";
import { syncResultsFromProvider } from "@/lib/sync-results";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";
import { NextResponse } from "next/server";

const throttleMs = 55_000;
const fixtureThrottleMs = 5 * 60_000;

async function shouldRunPulse() {
  if (!supabaseAdminConfigured()) return true;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("job_runs")
    .select("created_at")
    .in("job_path", ["/api/jobs/sync-results", "/api/live/pulse"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.created_at) return true;
  return Date.now() - new Date(data.created_at).getTime() >= throttleMs;
}

async function shouldRunFixturePulse() {
  if (!supabaseAdminConfigured()) return true;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("job_runs")
    .select("created_at")
    .eq("job_path", "/api/jobs/sync-fixtures")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.created_at) return true;
  return Date.now() - new Date(data.created_at).getTime() >= fixtureThrottleMs;
}

export async function POST() {
  if (!(await shouldRunPulse())) {
    return NextResponse.json({ ok: true, skipped: true, reason: "throttled" });
  }

  const fixtureResult = (await shouldRunFixturePulse()) ? await syncFixturesFromProvider() : null;
  const result = await syncResultsFromProvider();
  const payload = { results: result, fixtures: fixtureResult };

  if (fixtureResult) {
    await recordJobRun({
      jobPath: "/api/jobs/sync-fixtures",
      triggerType: "automatic",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Actualizar partidos", { ok: true, data: fixtureResult }),
      payload: fixtureResult
    });
  }

  await recordJobRun({
    jobPath: "/api/live/pulse",
    triggerType: "automatic",
    ok: true,
    statusCode: 200,
    summary: summarizeJob("Pulso vivo", { ok: true, data: result }),
    payload
  });

  return NextResponse.json({ ok: true, skipped: false, data: payload });
}

export async function GET() {
  return POST();
}
