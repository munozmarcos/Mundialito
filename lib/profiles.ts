import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function displayNameExists(db: SupabaseClient, displayName: string, exceptId?: string) {
  const normalized = normalizeDisplayName(displayName).toLowerCase();
  const { data, error } = await db.from("profiles").select("id,display_name");
  if (error) throw error;
  return (data ?? []).some((profile) => {
    if (exceptId && profile.id === exceptId) return false;
    return normalizeDisplayName(profile.display_name ?? "").toLowerCase() === normalized;
  });
}
