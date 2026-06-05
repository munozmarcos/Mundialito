import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabase";

export const SESSION_COOKIE = "mundialito_session";

export type AppUser = {
  id: string;
  displayName: string;
  phone: string | null;
  role: "admin" | "participant";
  paid: boolean;
};

type SessionPayload = {
  sub: string;
  exp: number;
};

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function publicPhone(value: string) {
  const phone = normalizePhone(value);
  return phone ? `+${phone}` : "";
}

export function internalEmailForPhone(phone: string) {
  return `phone-${normalizePhone(phone)}@mundialito.local`;
}

function secret() {
  const value = process.env.APP_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Missing app session secret");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function hashLoginCode(code: string) {
  return sign(`otp:${code}`);
}

export function randomLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function randomPassword() {
  return randomBytes(24).toString("base64url");
}

export function createSessionToken(userId: string) {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAppUserById(userId: string): Promise<AppUser | null> {
  if (!supabaseAdminConfigured()) return null;
  const db = supabaseAdmin();
  const { data } = await db
    .from("profiles")
    .select("id,display_name,phone,role,paid")
    .eq("id", userId)
    .single();

  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    phone: data.phone ?? null,
    role: data.role,
    paid: Boolean(data.paid)
  };
}

export async function getAppUserFromRequest(req: Request): Promise<AppUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  const payload = verifySessionToken(token);
  return payload ? getAppUserById(payload.sub) : null;
}

export async function getAppUserFromServerCookies() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  return payload ? getAppUserById(payload.sub) : null;
}
