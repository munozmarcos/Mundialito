import { createSessionToken, SESSION_COOKIE } from "@/lib/app-auth";
import { displayNameKey } from "@/lib/profiles";
import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  login: z.string().trim().min(2).max(80),
  password: z.string().min(6)
});

function normalize(value: string) {
  return displayNameKey(value);
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const db = supabaseAdmin();
    const { data: profiles, error } = await db.from("profiles").select("id,auth_email,display_name").order("created_at", { ascending: true });
    if (error) throw error;

    const login = normalize(body.login);
    const profile = (profiles ?? []).find(
      (item) => normalize(item.display_name) === login || normalize(item.auth_email) === login
    );
    if (!profile) return NextResponse.json({ error: "No encontre ese usuario." }, { status: 404 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new Error("Missing Supabase public environment variables");

    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { error: loginError } = await auth.auth.signInWithPassword({
      email: profile.auth_email,
      password: body.password
    });
    if (loginError) return NextResponse.json({ error: "Apodo o contraseña incorrectos." }, { status: 401 });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(profile.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
