function groupSortValue(group: string) {
  const normalized = group.trim().toUpperCase();
  const direct = normalized.match(/^([A-L])$/);
  if (direct) return direct[1].charCodeAt(0) - "A".charCodeAt(0);

  const named = normalized.match(/^GRUPO\s+([A-L])$/);
  if (named) return named[1].charCodeAt(0) - "A".charCodeAt(0);

  return 999;
}

export function compareGroups(a: string, b: string) {
  return groupSortValue(a) - groupSortValue(b) || a.localeCompare(b, "es");
}

export function sortedGroupEntries<T>(entries: [string, T][]) {
  return [...entries].sort(([a], [b]) => compareGroups(a, b));
}
