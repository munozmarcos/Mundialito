import { Goal, Sparkles } from "lucide-react";

export function MundialitoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="Mundialito 26">
      <div className="brand-logo-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="Mundialito 2026" className="brand-logo" src="/mundialito-logo.png" />
      </div>
      <div className={`brand-wordmark leading-tight ${compact ? "brand-wordmark-compact" : ""}`}>
        <div className="text-base font-black uppercase tracking-[0.08em]">Mundialito</div>
        {compact ? (
          <div className="brand-year" aria-label="2026">
            <span className="text-red-500">2</span>
            <span className="text-emerald-500">0</span>
            <span className="text-blue-500">2</span>
            <span className="text-white">6</span>
          </div>
        ) : (
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink/55">Prode entre amigos</div>
        )}
      </div>
    </div>
  );
}

const mascots = [
  { name: "Maple", role: "Arquero", tone: "from-red-600 to-red-400", face: "M" },
  { name: "Zayu", role: "Creativo", tone: "from-emerald-600 to-lime-400", face: "Z" },
  { name: "Clutch", role: "Capitan", tone: "from-blue-700 to-sky-400", face: "C" }
];

export function MascotSquad() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {mascots.map((mascot) => (
        <article className="mascot-card" key={mascot.name}>
          <div className={`mascot-avatar bg-gradient-to-br ${mascot.tone}`}>
            <span>{mascot.face}</span>
            <Sparkles className="absolute right-2 top-2 h-4 w-4 text-white/85" />
          </div>
          <div>
            <h3 className="font-black">{mascot.name}</h3>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/55">{mascot.role}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TournamentRibbon() {
  return (
    <div className="tournament-ribbon" aria-hidden="true">
      <span className="bg-red-600" />
      <span className="bg-blue-700" />
      <span className="bg-emerald-600" />
      <Goal className="h-5 w-5 text-white" />
    </div>
  );
}
