import { getAppUserFromRequest, SESSION_COOKIE } from "@/lib/app-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const user = await getAppUserFromRequest(req);
  return NextResponse.json({ user });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
