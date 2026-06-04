import { Handshake, Trophy } from "lucide-react";

export const metadata = {
  title: "Sponsors | Mundialito"
};

const sponsors = [
  {
    name: "ICARO Energy",
    category: "Energía y soluciones",
    text: "Acompaña el Mundialito poniendo potencia, empuje y buena onda para que esta competencia entre amigos siga creciendo.",
    image: "/sponsor-icaro.jpeg",
    logo: "/sponsor-logo-icaro.png",
    logoBox: "bg-[#b8c9cf]",
    logoSize: "h-28 w-full max-w-[320px]",
    imageSize: "max-h-[420px]"
  },
  {
    name: "Mates y Compañía",
    category: "Yerba mate misionera",
    text: "El ritual perfecto para mirar partidos, cargar pronósticos y discutir resultados con algo rico al lado.",
    image: "/sponsor-mates.jpeg",
    logo: "/sponsor-logo-mates.png",
    logoBox: "bg-black",
    logoSize: "h-14 w-full max-w-[320px]",
    imageSize: "max-h-[560px]"
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
        {sponsors.map((sponsor) => (
          <article className="panel overflow-hidden" key={sponsor.name}>
            <div className="border-b border-line bg-field p-5">
              <div className="grid gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid ${sponsor.logoSize} place-items-center overflow-hidden rounded-lg border border-line p-3 ${sponsor.logoBox}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`Logo ${sponsor.name}`} className="max-h-full max-w-full object-contain" src={sponsor.logo} />
                  </span>
                  <Trophy className="mt-2 h-5 w-5 shrink-0 text-gold" />
                </div>
                <div>
                  <h2 className="text-2xl font-black sm:text-3xl">{sponsor.name}</h2>
                  <p className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-ink/45">{sponsor.category}</p>
                </div>
              </div>
            </div>
            <div className="grid min-h-[300px] place-items-center border-b border-line bg-slate-950/25 p-3 sm:min-h-[500px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`${sponsor.name} sponsor Mundialito`} className={`${sponsor.imageSize} h-auto w-full rounded-lg object-contain`} src={sponsor.image} />
            </div>
            <div className="p-5">
              <p className="text-base font-semibold text-ink/75">{sponsor.text}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
