import { Heart, Sparkles, Trophy } from "lucide-react";
import Image from "next/image";
import { getPaymentSummary } from "@/lib/data";

export const metadata = {
  title: "Créditos | Mundialito"
};

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function CreditsPage() {
  const summary = await getPaymentSummary();

  return (
    <div className="grid gap-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_420px] md:items-center md:p-8">
          <div>
            <span className="badge">Créditos</span>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">La historia detrás del Mundialito</h1>
            <p className="mt-4 text-lg font-semibold text-ink/75">
              Este prode nace de un Excel inicial creado en 2010 por Lio, mi mellizo, que puso la primera piedra de esta locura hermosa entre amigos.
            </p>
            <div className="mt-6 grid gap-3">
              <div className="rounded-lg border border-line bg-field p-4">
                <Trophy className="mb-2 h-5 w-5 text-gold" />
                <h2 className="font-black">Gracias, Lio</h2>
                <p className="mt-1 text-sm font-semibold text-ink/70">
                  Por crear el Excel original en 2010, bancar la competencia y dejar servido el espíritu del Mundialito.
                </p>
              </div>
              <div className="rounded-lg border border-line bg-field p-4">
                <Sparkles className="mb-2 h-5 w-5 text-grass" />
                <h2 className="font-black">Gracias por apoyar al admin developer</h2>
                <p className="mt-1 text-sm font-semibold text-ink/70">
                  Cada aporte sostiene el pozo del juego y acompaña el viaje misionero a Ecuador.
                </p>
              </div>
              <div className="rounded-lg border border-line bg-field p-4">
                <Heart className="mb-2 h-5 w-5 text-red-500" />
                <h2 className="font-black">Ecuador en el corazón</h2>
                <p className="mt-1 text-sm font-semibold text-ink/70">
                  Vamos a bendecir familias en esa nación, compartir esperanza y servir con alegría.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-5">
            <div className="overflow-hidden rounded-lg border border-line bg-field shadow-xl shadow-sky-950/20">
              <Image
                alt="Marcos, Tim Payne y Lio"
                className="h-full w-full object-cover"
                height={960}
                priority
                src="/tim-lio-mark.png"
                width={1226}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-line bg-field">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Bandera de Ecuador" className="h-20 w-full object-cover" src="https://flagcdn.com/w640/ec.png" />
              <div className="p-4 text-center">
                <span className="text-xs font-black uppercase text-yellow-300">Recaudado para Ecuador</span>
                <strong className="mt-1 block text-3xl text-yellow-300">{money(summary.missionFund)}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
