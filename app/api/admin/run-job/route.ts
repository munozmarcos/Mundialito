import { requireAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  path: z.enum([
    "/api/jobs/sync-fixtures",
    "/api/jobs/sync-results",
    "/api/jobs/send-reminders",
    "/api/jobs/lock-matches",
    "/api/jobs/notify-kickoff",
    "/api/jobs/send-daily-ranking",
    "/api/jobs/notify-results"
  ]),
  matchId: z.string().uuid().optional()
});

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

  return NextResponse.json({ ok: res.ok, status: res.status, job: path, data }, { status: res.ok ? 200 : res.status });
}
