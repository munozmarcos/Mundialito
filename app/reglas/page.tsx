import { PageHero } from "@/components/page-hero";
import { TeamLabel } from "@/components/team-label";
import { BadgeCheck, CircleEqual, ListChecks, Target, Trophy } from "lucide-react";

const examples = [
  {
    title: "Acertas tendencia",
    real: ["Argentina", "Mexico", "2-1"],
    pick: ["Argentina", "Mexico", "1-0"],
    points: "1 punto",
    note: "Misma tendencia: gana Argentina."
  },
  {
    title: "Acertas exacto",
    real: ["Brazil", "Morocco", "3-1"],
    pick: ["Brazil", "Morocco", "3-1"],
    points: "3 puntos",
    note: "1 por tendencia + 2 extra por marcador exacto."
  },
  {
    title: "Acertas empate",
    real: ["Spain", "Uruguay", "0-0"],
    pick: ["Spain", "Uruguay", "1-1"],
    points: "1 punto",
    note: "El resultado no es exacto, pero la tendencia empate si."
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
        <strong className="rounded-md bg-white px-3 py-2 text-center text-lg shadow-sm">
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

export default function RulesPage() {
  return (
    <div className="grid gap-6">
      <PageHero
        badge="Reglas"
        icon={ListChecks}
        title="Como se suman los puntos"
        subtitle="Regla simple: 1 punto por tendencia y 2 puntos extra si el resultado es exacto."
      />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="panel p-5">
          <Target className="h-6 w-6 text-grass" />
          <h2 className="mt-3 text-xl font-black">Tendencia</h2>
          <p className="mt-2 text-sm text-ink/70">Gana local, gana visitante o empate.</p>
          <strong className="mt-4 block text-3xl text-grass">+1</strong>
        </article>
        <article className="panel p-5">
          <BadgeCheck className="h-6 w-6 text-gold" />
          <h2 className="mt-3 text-xl font-black">Resultado exacto</h2>
          <p className="mt-2 text-sm text-ink/70">Si además acertaste los goles exactos.</p>
          <strong className="mt-4 block text-3xl text-gold">+2</strong>
        </article>
        <article className="panel p-5">
          <Trophy className="h-6 w-6 text-blue-700" />
          <h2 className="mt-3 text-xl font-black">Máximo</h2>
          <p className="mt-2 text-sm text-ink/70">Aplica igual en grupos y eliminatorias, contando 120 minutos.</p>
          <strong className="mt-4 block text-3xl text-blue-700">3 pts</strong>
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
    </div>
  );
}
