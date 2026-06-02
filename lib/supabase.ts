import { createClient } from "@supabase/supabase-js";

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin environment variables");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" })
    }
  });
}

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase public environment variables");
  return createClient(url, key);
}

export async function getUserFromRequest(req: Request) {
  const { getAppUserFromRequest } = await import("@/lib/app-auth");
  const appUser = await getAppUserFromRequest(req);
  if (appUser) return { id: appUser.id, email: null };

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase public environment variables");
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await client.auth.getUser(token);
  return data.user ?? null;
}

export async function requireAdmin(req: Request) {
  const { getAppUserFromRequest } = await import("@/lib/app-auth");
  const appUser = await getAppUserFromRequest(req);
  if (appUser?.role === "admin") return { id: appUser.id, email: null };

  const user = await getUserFromRequest(req);
  if (!user) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("profiles").select("id, role").eq("id", user.id).single();
  return data?.role === "admin" ? user : null;
}
