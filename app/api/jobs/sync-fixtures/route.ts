import { syncFixturesFromProvider } from "@/lib/sync-fixtures";
import { recordJobRun, summarizeJob } from "@/lib/job-runs";
import { NextResponse } from "next/server";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const vercelOk = req.headers.get("x-vercel-cron") === "1";
  return authOk || vercelOk;
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await syncFixturesFromProvider();
  if (req.headers.get("x-vercel-cron") === "1") {
    await recordJobRun({
      jobPath: "/api/jobs/sync-fixtures",
      triggerType: "automatic",
      ok: true,
      statusCode: 200,
      summary: summarizeJob("Actualizar partidos", { ok: true, data: result }),
      payload: result
    });
  }
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}
