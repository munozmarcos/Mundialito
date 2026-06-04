import { getLatestNotifications } from "@/lib/notifications";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const notifications = await getLatestNotifications(10);
  return NextResponse.json({ notifications });
}
