import { AdminBackButton } from "@/components/admin-back-button";
import { PageHero } from "@/components/page-hero";
import { CalendarPlus, FileSpreadsheet, RefreshCw } from "lucide-react";

const sample = `home_team,away_team,home_country_code,away_country_code,kickoff_at,stadium,stage,group_name
Mexico,South Africa,mx,za,2026-06-11T16:00:00-05:00,Estadio Azteca,GROUP,A`;

export default function ImportAdminPage() {
  return (
    <div className="grid gap-6">
      <PageHero
        badge="Admin"
        icon={CalendarPlus}
        title="Cargar partidos"
        subtitle="Herramienta de respaldo para agregar partidos manualmente si el calendario oficial cambia o falta algun cruce."
      >
        <AdminBackButton />
      </PageHero>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel p-5">
          <RefreshCw className="h-6 w-6 text-grass" />
          <h2 className="mt-3 text-xl font-black">Uso normal</h2>
          <p className="mt-2 text-sm text-ink/70">Usa Admin &gt; Actualizar partidos para traer el calendario automaticamente.</p>
        </article>
        <article className="panel p-5">
          <FileSpreadsheet className="h-6 w-6 text-gold" />
          <h2 className="mt-3 text-xl font-black">Uso manual</h2>
          <p className="mt-2 text-sm text-ink/70">Esta pantalla sirve como referencia del formato si necesitamos cargar partidos a mano.</p>
        </article>
        <article className="panel p-5">
          <CalendarPlus className="h-6 w-6 text-blue-700" />
          <h2 className="mt-3 text-xl font-black">Formato</h2>
          <p className="mt-2 text-sm text-ink/70">Equipo local, visitante, codigos de bandera, fecha, estadio, fase y grupo.</p>
        </article>
      </section>

      <section className="panel p-6">
        <h2 className="text-xl font-black">Ejemplo de carga</h2>
        <p className="mt-2 text-sm text-ink/70">Si algun dia hay que importar a mano, este es el formato que entiende el sistema.</p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-field p-4 text-sm">{sample}</pre>
      </section>
    </div>
  );
}
