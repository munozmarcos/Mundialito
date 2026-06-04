import { NextResponse } from "next/server";

const always = [
  "/api/jobs/lock-matches",
  "/api/jobs/notify-kickoff",
  "/api/jobs/sync-results"
];

const every15 = [
  "/api/jobs/send-reminders"
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

  if (minute % 15 === 0) every15.forEach((path) => due.add(path));
  if (hour === 6 && minute < 5) due.add("/api/jobs/sync-fixtures");

  const results = [];
  for (const path of due) {
    results.push(await runJob(req, path));
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    ran: results.length,
    results
  });
}

export async function GET(req: Request) {
  return POST(req);
}
