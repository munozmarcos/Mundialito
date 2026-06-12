import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { recalculateAllMatches } from "@/lib/recalculate";
import { NextResponse } from "next/server";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const vercelOk = req.headers.get("x-vercel-cron") === "1";
  return authOk || vercelOk;
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await recalculateAllMatches();
    const payload = { ok: true, data: result };
    await recordJobRun({
      jobPath: "/api/jobs/recalculate-all",
      triggerType: req.headers.get("x-vercel-cron") === "1" ? "automatic" : "manual",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Recalcular puntos", payload),
      payload: result
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await recordJobRun({
      jobPath: "/api/jobs/recalculate-all",
      triggerType: req.headers.get("x-vercel-cron") === "1" ? "automatic" : "manual",
      ok: false,
      statusCode: 500,
      summary: `Recalcular puntos: error - ${message}`,
      payload: { error: message }
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
