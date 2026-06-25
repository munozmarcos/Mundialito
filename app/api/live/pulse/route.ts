import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { syncResultsFromProvider } from "@/lib/sync-results";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";
import { NextResponse } from "next/server";

const throttleMs = 55_000;

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

export async function POST() {
  if (!(await shouldRunPulse())) {
    return NextResponse.json({ ok: true, skipped: true, reason: "throttled" });
  }

  const result = await syncResultsFromProvider();
  await recordJobRun({
    jobPath: "/api/live/pulse",
    triggerType: "automatic",
    ok: true,
    statusCode: 200,
    summary: summarizeJob("Pulso vivo", { ok: true, data: result }),
    payload: result
  });

  return NextResponse.json({ ok: true, skipped: false, data: result });
}

export async function GET() {
  return POST();
}
