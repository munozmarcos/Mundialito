import { countryCodeForTeam, displayNameForTeam, flagUrlForTeam } from "@/lib/flags";

function specialFlag(code?: string | null) {
  if (code === "gb-sct") return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f);
  if (code === "gb-eng") return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
  return null;
}

export function TeamLabel({ name, code }: { name: string; code?: string | null }) {
  const flag = flagUrlForTeam(name, code);
  const displayName = displayNameForTeam(name);
  const normalizedCode = countryCodeForTeam(name, code);
  const emoji = specialFlag(normalizedCode);

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2 font-bold">
      {emoji ? (
        <span className="grid h-4 w-6 shrink-0 place-items-center text-lg leading-none">{emoji}</span>
      ) : flag ? (
        <img src={flag} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" />
      ) : (
        <span className="h-4 w-6 shrink-0 rounded-[2px] bg-line" />
      )}
      <span className="min-w-0 truncate whitespace-nowrap">{displayName}</span>
    </span>
  );
}
