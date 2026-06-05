import { PageHero } from "@/components/page-hero";
import { StatusPill } from "@/components/status-pill";
import { TeamLabel } from "@/components/team-label";
import { BadgeCheck, CircleEqual, Clock, ListChecks, LockKeyhole, PlayCircle, Target, Trophy, UnlockKeyhole } from "lucide-react";

const examples = [
  {
    title: "Acertás tendencia",
    real: ["Argentina", "Mexico", "2-1"],
    pick: ["Argentina", "Mexico", "1-0"],
    points: "1 punto",
    note: "Misma tendencia: gana Argentina."
  },
  {
    title: "Acertás exacto",
    real: ["Brazil", "Morocco", "3-1"],
    pick: ["Brazil", "Morocco", "3-1"],
    points: "3 puntos",
    note: "1 por tendencia + 2 extra por marcador exacto."
  },
  {
    title: "Acertás empate",
    real: ["Spain", "Uruguay", "0-0"],
    pick: ["Spain", "Uruguay", "1-1"],
    points: "1 punto",
    note: "El resultado no es exacto, pero la tendencia empate sí."
  },
  {
    title: "Empate exacto",
    real: ["Netherlands", "Japan", "1-1"],
    pick: ["Netherlands", "Japan", "1-1"],
    points: "3 puntos",
    note: "Empate correcto + marcador exacto."
  }
];

function ScoreLine({ label, home, away, score }: { label: string; home: string; away: string; score: string }) {
  const [homeGoals, awayGoals] = score.split("-");
  return (
    <div className="rounded-lg bg-field p-3">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-ink/45">{label}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamLabel name={home} />
        <strong className="rounded-md bg-slate-950/50 px-3 py-2 text-center text-lg shadow-sm">
          {homeGoals}-{awayGoals}
        </strong>
        <span className="justify-self-end">
          <TeamLabel name={away} />
        </span>
      </div>
    </div>
  );
}

function ExampleCard({ example }: { example: (typeof examples)[number] }) {
  return (
    <article className="panel grid gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black">{example.title}</h2>
        <span className="badge">{example.points}</span>
      </div>
      <ScoreLine label="Resultado" home={example.real[0]} away={example.real[1]} score={example.real[2]} />
      <ScoreLine label="Tu predicción" home={example.pick[0]} away={example.pick[1]} score={example.pick[2]} />
      <p className="flex items-center gap-2 text-sm font-semibold text-ink/68">
        <CircleEqual className="h-4 w-4 text-grass" />
        {example.note}
      </p>
    </article>
  );
}

function StatusExample({ status, title, text }: { status: "open" | "locked" | "closed"; title: string; text: string }) {
  const locked = status === "locked";
  return (
    <article className="panel grid gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-ink/68">{text}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="rounded-lg border border-line bg-field p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-ink/45">Ejemplo visual</span>
          <StatusPill status={status} />
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_58px] items-center gap-3">
            {locked ? (
              <span className="inline-flex items-center gap-2 font-bold text-ink/45">
                <span className="grid h-6 w-8 place-items-center rounded bg-line/30">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                Equipo por definir
              </span>
            ) : (
              <TeamLabel name="Argentina" />
            )}
            <input className="field h-10 px-2 text-center font-black" disabled={status !== "open"} readOnly value={status === "locked" ? "" : "2"} />
          </div>
          <div className="grid grid-cols-[1fr_58px] items-center gap-3">
            {locked ? (
              <span className="inline-flex items-center gap-2 font-bold text-ink/45">
                <span className="grid h-6 w-8 place-items-center rounded bg-line/30">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                Equipo por definir
              </span>
            ) : (
              <TeamLabel name="Mexico" />
            )}
            <input className="field h-10 px-2 text-center font-black" disabled={status !== "open"} readOnly value={status === "locked" ? "" : "1"} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function RulesPage() {
  return (
    <div className="grid gap-6">
      <PageHero
        badge="Reglas"
        icon={ListChecks}
        title="Cómo se suman los puntos"
        subtitle="Regla simple: 1 punto por tendencia y 2 puntos extra si el resultado es exacto."
      />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="panel flex h-full flex-col p-5">
          <Target className="h-6 w-6 text-grass" />
          <h2 className="mt-3 text-xl font-black">Tendencia</h2>
          <p className="mt-2 text-sm text-ink/70">Gana local, gana visitante o empate.</p>
          <strong className="mt-auto block pt-4 text-3xl text-grass">+1</strong>
        </article>
        <article className="panel flex h-full flex-col p-5">
          <BadgeCheck className="h-6 w-6 text-gold" />
          <h2 className="mt-3 text-xl font-black">Resultado exacto</h2>
          <p className="mt-2 text-sm text-ink/70">Si además acertaste los goles exactos.</p>
          <strong className="mt-auto block pt-4 text-3xl text-gold">+2</strong>
        </article>
        <article className="panel flex h-full flex-col p-5">
          <Trophy className="h-6 w-6 text-blue-300" />
          <h2 className="mt-3 text-xl font-black">Máximo</h2>
          <p className="mt-2 text-sm text-ink/70">Grupos y eliminatorias, 120 minutos.</p>
          <strong className="mt-auto block pt-4 text-3xl text-blue-300">3 pts</strong>
        </article>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-black">Ejemplos</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {examples.map((example) => (
            <ExampleCard example={example} key={example.title} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-black">Podio final</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="panel flex h-full flex-col p-5">
            <Trophy className="h-6 w-6 text-yellow-200" />
            <h3 className="mt-3 text-xl font-black">Campeón</h3>
            <p className="mt-2 text-sm text-ink/70">Si acertás el campeón del Mundial.</p>
            <strong className="mt-auto block pt-4 text-3xl text-yellow-200">+3</strong>
          </article>
          <article className="panel flex h-full flex-col p-5">
            <Trophy className="h-6 w-6 text-slate-100" />
            <h3 className="mt-3 text-xl font-black">2do puesto</h3>
            <p className="mt-2 text-sm text-ink/70">Si acertás el subcampeón.</p>
            <strong className="mt-auto block pt-4 text-3xl text-slate-100">+2</strong>
          </article>
          <article className="panel flex h-full flex-col p-5">
            <Trophy className="h-6 w-6 text-orange-200" />
            <h3 className="mt-3 text-xl font-black">3er puesto</h3>
            <p className="mt-2 text-sm text-ink/70">Si acertás quién gana el partido por el tercer puesto.</p>
            <strong className="mt-auto block pt-4 text-3xl text-orange-200">+1</strong>
          </article>
        </div>
        <p className="mt-3 text-sm font-semibold text-ink/65">
          Se carga desde Pronósticos o por WhatsApp con <strong>$podio Argentina | Brasil | Uruguay</strong>.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-black">Estados de partidos</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <StatusExample
            status="open"
            title="Abierto"
            text="El partido está disponible y podés ingresar o modificar tu predicción."
          />
          <StatusExample
            status="locked"
            title="Bloqueado"
            text="Todavía no se puede pronosticar porque la llave o los equipos no están definidos oficialmente."
          />
          <StatusExample
            status="closed"
            title="Cerrado"
            text="Se cierra 15 minutos antes del inicio. Cuando termina, queda cerrado con resultado final."
          />
        </div>
      </section>

      <section className="panel p-5 md:p-8">
        <div className="mb-4 flex items-center gap-3">
          <PlayCircle className="h-6 w-6 text-red-400" />
          <div>
            <h2 className="text-2xl font-black">Video explicativo</h2>
            <p className="text-sm font-semibold text-ink/65">Funcionamiento de la app y reglas del Mundialito.</p>
          </div>
        </div>
        <div className="aspect-video overflow-hidden rounded-lg border border-line bg-field">
          <iframe
            className="h-full w-full"
            src="https://www.youtube.com/embed/9VIex_8o5hc"
            title="Reglas Mundialito"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  );
}
