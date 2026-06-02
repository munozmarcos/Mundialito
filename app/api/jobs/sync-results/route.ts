import { syncResultsFromProvider } from "@/lib/sync-results";
import { NextResponse } from "next/server";

function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!assertCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await syncResultsFromProvider();
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return POST(req);
}

