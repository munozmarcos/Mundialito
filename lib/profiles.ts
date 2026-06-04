import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateDisplayName(value: string) {
  const normalized = normalizeDisplayName(value);
  if (normalized.length < 2) return "El apodo tiene que tener al menos 2 caracteres.";
  if (normalized.length > 40) return "El apodo no puede tener mas de 40 caracteres.";
  if (!/^[\p{L}\p{N} ]+$/u.test(normalized)) return "El apodo solo puede usar letras, numeros y espacios.";
  return null;
}

export function displayNameKey(value: string) {
  return normalizeDisplayName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

export async function displayNameExists(db: SupabaseClient, displayName: string, exceptId?: string) {
  const normalized = displayNameKey(displayName);
  const { data, error } = await db.from("profiles").select("id,display_name");
  if (error) throw error;
  return (data ?? []).some((profile) => {
    if (exceptId && profile.id === exceptId) return false;
    return displayNameKey(profile.display_name ?? "") === normalized;
  });
}
