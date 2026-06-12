import { publicVapidKey } from "@/lib/web-push";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ publicKey: publicVapidKey() });
}
