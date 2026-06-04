import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { requireAdmin, supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const paths = [
  "/api/jobs/sync-fixtures",
  "/api/jobs/sync-results",
  "/api/jobs/send-reminders",
  "/api/jobs/lock-matches",
  "/api/jobs/notify-kickoff",
  "/api/jobs/send-daily-ranking",
  "/api/jobs/notify-results"
] as const;

const Body = z.object({
  path: z.enum(paths),
  matchId: z.string().uuid().optional()
});

const titles: Record<(typeof paths)[number], string> = {
  "/api/jobs/sync-fixtures": "Actualizar partidos",
  "/api/jobs/sync-results": "Actualizar resultados",
  "/api/jobs/send-reminders": "Recordatorios 4h",
  "/api/jobs/lock-matches": "Cerrar 15m",
  "/api/jobs/notify-kickoff": "Avisar inicio",
  "/api/jobs/send-daily-ranking": "Envío Ranking",
  "/api/jobs/notify-results": "Avisar resultado"
};

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("job_runs")
    .select("id,job_path,trigger_type,ok,status_code,summary,created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const latest: Record<string, unknown> = {};
  for (const run of data ?? []) {
    if (!latest[run.job_path]) latest[run.job_path] = run;
  }
  return NextResponse.json({ runs: data ?? [], latest });
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Falta CRON_SECRET en Vercel" }, { status: 500 });

  const body = Body.parse(await req.json());
  const { path } = body;
  if (path === "/api/jobs/notify-results" && !body.matchId) {
    return NextResponse.json({ error: "Falta partido para notificar resultado." }, { status: 400 });
  }

  const url = new URL(path, req.url);
  url.searchParams.set("manual", "1");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      ...(path === "/api/jobs/notify-results" ? { "content-type": "application/json" } : {})
    },
    body: path === "/api/jobs/notify-results" ? JSON.stringify({ matchId: body.matchId }) : undefined,
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  const payload = { ok: res.ok, status: res.status, job: path, data };
  const summary = summarizeJob(titles[path], payload);

  await recordJobRun({
    jobPath: path,
    triggerType: "manual",
    ok: res.ok,
    statusCode: res.status,
    summary,
    payload
  });

  return NextResponse.json({ ...payload, summary }, { status: res.ok ? 200 : res.status });
}
