import { displayNameForTeam, flagEmojiForTeam, flagUrlForTeam } from "@/lib/flags";

export function TeamLabel({ name, code }: { name: string; code?: string | null }) {
  const flag = flagUrlForTeam(name, code);
  const flagEmoji = flagEmojiForTeam(name, code);
  const displayName = displayNameForTeam(name);

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2 font-bold">
      {flag ? (
        <img src={flag} alt="" className="h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10" />
      ) : (
        <span className="inline-flex h-5 w-6 shrink-0 items-center justify-center text-lg leading-none">{flagEmoji}</span>
      )}
      <span className="min-w-0 truncate whitespace-nowrap">{displayName}</span>
    </span>
  );
}
