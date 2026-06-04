const groupOrder: Record<string, string[]> = {
  A: ["Mexico", "South Africa", "South Korea", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Tunisia", "Sweden"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"]
};

const aliases: Record<string, string> = {
  "alemania": "germany",
  "arabia saudita": "saudi arabia",
  "argelia": "algeria",
  "belgica": "belgium",
  "bosnia": "bosnia and herzegovina",
  "bosnia y herzegovina": "bosnia and herzegovina",
  "brasil": "brazil",
  "cabo verde": "cape verde",
  "chequia": "czechia",
  "colombia": "colombia",
  "corea del sur": "south korea",
  "costa de marfil": "ivory coast",
  "curazao": "curacao",
  "egipto": "egypt",
  "escocia": "scotland",
  "espana": "spain",
  "estados unidos": "united states",
  "francia": "france",
  "inglaterra": "england",
  "irak": "iraq",
  "japon": "japan",
  "marruecos": "morocco",
  "mexico": "mexico",
  "noruega": "norway",
  "nueva zelanda": "new zealand",
  "paises bajos": "netherlands",
  "rd congo": "dr congo",
  "republica checa": "czechia",
  "suiza": "switzerland",
  "sudafrica": "south africa",
  "tunez": "tunisia",
  "turquia": "turkey"
};

function normalizeTeam(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return aliases[normalized] ?? normalized;
}

export function fifaGroupTeamOrder(group: string | null | undefined, team: string, fallback = 99) {
  if (!group) return fallback;
  const teams = groupOrder[group.toUpperCase()];
  if (!teams) return fallback;
  const normalizedTeam = normalizeTeam(team);
  const index = teams.findIndex((item) => normalizeTeam(item) === normalizedTeam);
  return index >= 0 ? index : fallback;
}
