"use client";

import { ListChecks, LockKeyhole, MessageCircle, Newspaper, Play, RefreshCw, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const pages = [
  { href: "/admin/participantes", icon: UsersRound, title: "Participantes", text: "Edición de participantes, WhatsApp, rol y estado de pago." },
  { href: "/admin/resultados", icon: Trophy, title: "Resultados", text: "Cargar resultados reales, abrir/cerrar/bloquear partidos y recalcular ranking." },
  { href: "/admin/whatsapp", icon: MessageCircle, title: "Broadcasts", text: "Envío de mensaje general por WhatsApp a participantes seleccionados." },
  { href: "/admin/novedades", icon: Newspaper, title: "Novedades", text: "Publicar avisos que aparecen en Novedades de la pantalla de inicio." }
];

const jobs = [
  { path: "/api/jobs/sync-fixtures", icon: RefreshCw, title: "Actualizar partidos", text: "Trae fixture y cruces oficiales cuando cambian sedes, horarios, equipos o llaves.", cron: "Horario: todos los días 03:00" },
  { path: "/api/jobs/sync-results", icon: Trophy, title: "Actualizar resultados", text: "Trae marcadores reales, guarda resultados y recalcula puntos.", cron: "Horario: cada 1 minuto" },
  { path: "/api/jobs/send-reminders", icon: ListChecks, title: "Recordatorios 4h", text: "Avisa por WhatsApp 4h antes del primer partido del dia y lista pendientes de hoy mas 2 dias.", cron: "Horario: cada 15 minutos" },
  { path: "/api/jobs/lock-matches", icon: LockKeyhole, title: "Cerrar 15m", text: "Cierra partidos que empiezan en 15 minutos, incluyendo podio anticipado 15 minutos antes del primer 16vos.", cron: "Horario: cada 1 minuto" },
  { path: "/api/jobs/notify-kickoff", icon: MessageCircle, title: "Avisar inicio", text: "Notifica por WhatsApp los partidos que están por empezar.", cron: "Horario: cada 1 minuto" },
  { path: "/api/jobs/send-daily-ranking", icon: MessageCircle, title: "Envío Ranking", text: "Manda el ranking actual a todos los miembros registrados.", cron: "Horario: todos los días 23:00" }
] as const;

const commands = [
  { command: "$comandos", text: "Muestra esta ayuda. Sin parámetro: $comandos" },
  { command: "$ranking", text: "Devuelve el ranking completo. Sin parámetro: $ranking" },
  { command: "$reglas", text: "Explica la puntuación y el podio anticipado. Sin parámetro: $reglas" },
  { command: "$partidos", text: "Lista próximos partidos. Sin parámetro: $partidos. Con parámetro: $partidos Francia" },
  { command: "$resultados", text: "Muestra resultados reales. Sin parámetro: $resultados. Con parámetro: $resultados Argentina" },
  { command: "$pendientes", text: "Muestra sólo pronósticos abiertos que faltan cargar. No incluye cerrados, bloqueados ni partidos ya cargados. Sin parámetro: $pendientes" },
  { command: "$pronosticos", text: "Devuelve el fixture cargado por el usuario para copiar. Sin parámetro: $pronosticos" },
  { command: "$podio", text: "Guarda o muestra el podio anticipado. Sin parámetro: $podio. Con parámetro: $podio Argentina Brasil Uruguay" },
  { command: "$carga", text: "Carga muchos pronósticos desde WhatsApp. Con parámetro multilinea: $carga y abajo Argentina 2-1 Mexico" }
];

type JobRun = {
  id: string;
  job_path: string;
  trigger_type: "manual" | "automatic";
  ok: boolean;
  status_code: number | null;
  summary: string | null;
  created_at: string;
};

function jobSummary(title: string, payload: any) {
  if (payload?.summary) return payload.summary;
  const data = payload?.data ?? payload ?? {};
  if (!payload?.ok && payload?.error) return `${title}: error - ${payload.error}`;
  const parts = [`${title}: ejecutado`];
  if (typeof data.fetched === "number") parts.push(`${data.fetched} registros leídos`);
  if (typeof data.imported === "number") parts.push(`${data.imported} registros importados`);
  if (typeof data.placeholders === "number") parts.push(`${data.placeholders} llaves preparadas`);
  if (typeof data.updated === "number") parts.push(`${data.updated} registros actualizados`);
  if (typeof data.matches === "number") parts.push(`${data.matches} partidos detectados`);
  if (typeof data.locked === "number") parts.push(`${data.locked} partidos cerrados`);
  if (typeof data.sent === "number") parts.push(`${data.sent} mensajes enviados`);
  if (typeof data.notifications === "number") parts.push(`${data.notifications} avisos enviados`);
  if (typeof data.inserted === "number") parts.push(`${data.inserted} registros creados`);
  if (Array.isArray(data.unmatched) && data.unmatched.length) parts.push(`${data.unmatched.length} sin asociar`);
  if (data.providerError) parts.push(`proveedor: ${data.providerError}`);
  if (typeof data.failures?.length === "number" && data.failures.length) parts.push(`${data.failures.length} fallos`);
  return parts.join(" · ");
}

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(value));
}

export default function AdminPage() {
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const [latestRuns, setLatestRuns] = useState<Record<string, JobRun>>({});

  async function loadRuns() {
    const res = await fetch("/api/admin/run-job", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setLatestRuns(data.latest ?? {});
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  async function runJob(path: string, title: string) {
    setRunning(path);
    setMessage("");

    const res = await fetch("/api/admin/run-job", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    setRunning(null);
    setMessage(jobSummary(title, data));
    await loadRuns();
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-6">
        <h1 className="text-3xl font-black">Admin</h1>
        <p className="mt-2 text-ink/70">Todo lo necesario para manejar el Mundialito desde un solo lugar.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {pages.map((action) => (
          <Link className="panel flex gap-4 p-5" href={action.href} key={action.href}>
            <action.icon className="mt-1 h-5 w-5 shrink-0 text-grass" />
            <span>
              <strong className="block text-lg">{action.title}</strong>
              <span className="text-sm text-ink/70">{action.text}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">Jobs</h2>
        <p className="mt-1 text-sm font-semibold text-ink/60">
          Corren automáticos; el play queda para contingencia manual o pruebas controladas.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {jobs.map((job) => {
            const run = latestRuns[job.path];
            return (
              <div className="panel relative min-h-[218px] p-4 pb-16" key={job.path}>
                <div className="flex min-w-0 gap-4 text-left">
                  <job.icon className="mt-1 h-5 w-5 shrink-0 text-grass" />
                  <div className="min-w-0">
                    <strong className="block text-lg">{job.title}</strong>
                    <span className="text-sm text-ink/70">{job.text}</span>
                    <span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45">{job.cron}</span>
                    <span className="mt-2 block rounded-lg border border-line bg-field p-3 text-xs font-semibold text-ink/68">
                      {run ? (
                        <>
                          Última ejecución: <strong>{formatRunDate(run.created_at)}</strong> · {run.trigger_type === "automatic" ? "Automática" : "Manual"} ·{" "}
                          <strong className={run.ok ? "text-grass" : "text-red-300"}>{run.ok ? "OK" : "Error"}</strong>
                          {run.summary ? <span className="mt-1 block">{run.summary}</span> : null}
                        </>
                      ) : (
                        "Última ejecución: sin registros"
                      )}
                    </span>
                  </div>
                </div>
                <button className="btn absolute bottom-4 right-4 h-12 min-h-12 w-12 px-0" disabled={running === job.path} onClick={() => runJob(job.path, job.title)} title={`Ejecutar ${job.title}`} type="button">
                  <Play className="h-6 w-6" />
                </button>
              </div>
            );
          })}
        </div>
        {message && <p className="mt-4 rounded-lg bg-field p-3 text-sm font-bold text-ink/70">{message}</p>}
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">Comandos de WhatsApp</h2>
        <p className="mt-1 text-sm font-semibold text-ink/60">Todos los participantes pueden escribirlos con $ al inicio.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {commands.map((item) => (
            <div className="rounded-lg border border-line bg-field p-4" key={item.command}>
              <strong className="block text-lg text-grass">{item.command}</strong>
              <span className="text-sm font-semibold text-ink/70">{item.text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
