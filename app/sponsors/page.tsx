import { BatteryCharging, Coffee, Handshake, Megaphone, Trophy } from "lucide-react";

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
    accent: "text-sky-300"
  },
  {
    name: "Mates y Compañía",
    category: "Yerba mate misionera",
    text: "El ritual perfecto para mirar partidos, cargar pronósticos y discutir resultados con algo rico al lado.",
    image: "/sponsor-mates.jpeg",
    icon: Coffee,
    accent: "text-gold"
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
              <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-field">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={`${sponsor.name} sponsor Mundialito`} className="h-full w-full object-cover" src={sponsor.image} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/75 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                    <Megaphone className="h-4 w-4 text-red-400" />
                    Sponsor oficial
                  </div>
                </div>
              </div>
              <div className="border-b border-line bg-field p-5">
                <div className="flex items-center justify-between gap-3">
                  <Icon className={`h-8 w-8 ${sponsor.accent}`} />
                  <Trophy className="h-5 w-5 text-gold" />
                </div>
                <h2 className="mt-4 text-3xl font-black">{sponsor.name}</h2>
                <p className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-ink/45">{sponsor.category}</p>
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
