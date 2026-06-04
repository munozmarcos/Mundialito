import { BatteryCharging, Coffee, Handshake, Trophy } from "lucide-react";

export const metadata = {
  title: "Sponsors | Mundialito"
};

const sponsors = [
  {
    name: "ICARO Energy",
    category: "Energía y soluciones",
    text: "Acompaña el Mundialito poniendo potencia, empuje y buena onda para que esta competencia entre amigos siga creciendo.",
    image: "/sponsor-icaro.jpeg",
    icon: BatteryCharging,
    accent: "text-sky-300",
    logoBg: "bg-sky-400/12"
  },
  {
    name: "Mates y Compañía",
    category: "Yerba mate misionera",
    text: "El ritual perfecto para mirar partidos, cargar pronósticos y discutir resultados con algo rico al lado.",
    image: "/sponsor-mates.jpeg",
    icon: Coffee,
    accent: "text-gold",
    logoBg: "bg-gold/12"
  }
];

export default function SponsorsPage() {
  return (
    <div className="grid gap-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_360px] md:items-center md:p-8">
          <div>
            <span className="badge">Sponsors</span>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Los que bancan el Mundialito</h1>
            <p className="mt-4 text-lg font-semibold text-ink/75">
              Empresas amigas que se suman a esta locura mundialista para ponerle más color, premios y comunidad al prode.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-field p-5">
            <Handshake className="h-8 w-8 text-grass" />
            <h2 className="mt-3 text-2xl font-black">Espacio para marcas amigas</h2>
            <p className="mt-2 text-sm font-semibold text-ink/70">
              Si querés aparecer acá, escribile a Marcos y sumate al Mundialito 2026.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sponsors.map((sponsor) => {
          const Icon = sponsor.icon;
          return (
            <article className="panel overflow-hidden" key={sponsor.name}>
              <div className="border-b border-line bg-field p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-line ${sponsor.logoBg}`}>
                      <Icon className={`h-7 w-7 ${sponsor.accent}`} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-black sm:text-3xl">{sponsor.name}</h2>
                      <p className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-ink/45">{sponsor.category}</p>
                    </div>
                  </div>
                  <Trophy className="h-5 w-5 shrink-0 text-gold" />
                </div>
              </div>
              <div className="grid min-h-[280px] place-items-center border-b border-line bg-slate-950/25 p-3 sm:min-h-[360px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={`${sponsor.name} sponsor Mundialito`} className="max-h-[520px] w-full rounded-lg object-contain" src={sponsor.image} />
              </div>
              <div className="p-5">
                <p className="text-base font-semibold text-ink/75">{sponsor.text}</p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
