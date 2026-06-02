import { EmptyState } from "@/components/empty-state";
import { AdminResultsControl } from "@/components/admin-results-control";
import { getMatches } from "@/lib/data";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import type { Prediction, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ResultsAdminPage() {
  const matches = await getMatches();
  let profiles: Profile[] = [];
  let predictions: (Prediction & { profiles?: Pick<Profile, "display_name"> | null })[] = [];

  if (supabaseConfigured()) {
    const db = supabaseAdmin();
    const [profileRes, predictionRes] = await Promise.all([
      db.from("profiles").select("id,auth_email,display_name,role,phone,paid").order("display_name"),
      db.from("predictions").select("*, profiles(display_name)")
    ]);
    profiles = (profileRes.data ?? []) as Profile[];
    predictions = (predictionRes.data ?? []) as (Prediction & { profiles?: Pick<Profile, "display_name"> | null })[];
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <h1 className="text-3xl font-black">Cargar resultados</h1>
        <p className="mt-2 text-ink/70">Revisa los marcadores cargados y actualiza el ranking cuando termine cada partido.</p>
      </section>
      {!matches.length ? (
        <EmptyState title="No hay partidos" text="Primero carga el calendario del Mundialito." />
      ) : (
        <AdminResultsControl initialMatches={matches} profiles={profiles} predictions={predictions} />
      )}
    </div>
  );
}
