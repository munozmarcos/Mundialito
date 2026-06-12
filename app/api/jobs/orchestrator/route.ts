import { NextResponse } from "next/server";
import { recordJobRun } from "@/lib/job-runs";

const always = [
  "/api/jobs/lock-matches",
  "/api/jobs/notify-kickoff",
  "/api/jobs/sync-results",
  "/api/jobs/send-reminders",
  "/api/jobs/send-daily-ranking"
];

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authOk = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  const vercelOk = req.headers.get("x-vercel-cron") === "1";
  return authOk || vercelOk;
}

async function runJob(req: Request, path: string) {
  const secret = process.env.CRON_SECRET ?? "";
  const res = await fetch(new URL(path, req.url), {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "x-vercel-cron": "1"
    },
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  return { path, ok: res.ok, status: res.status, data };
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const minute = now.getUTCMinutes();
  const hour = now.getUTCHours();
  const due = new Set<string>(always);

  // 03:00 Argentina = 06:00 UTC. The wide window absorbs GitHub schedule delays.
  if (hour === 6 && minute < 30) due.add("/api/jobs/sync-fixtures");
  const results = [];
  for (const path of due) {
    results.push(await runJob(req, path));
  }

  const payload = {
    ok: results.every((result) => result.ok),
    ran: results.length,
    results
  };

  if (req.headers.get("x-vercel-cron") === "1") {
    await recordJobRun({
      jobPath: "/api/jobs/orchestrator",
      triggerType: "automatic",
      ok: payload.ok,
      statusCode: payload.ok ? 200 : 207,
      summary: `Orquestador: ejecutado - ${payload.ran} jobs disparados`,
      payload
    });
  }

  return NextResponse.json(payload);
}

export async function GET(req: Request) {
  return POST(req);
}
