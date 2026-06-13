const aliases: Record<string, string> = {
  argentina: "ar",
  mexico: "mx",
  sudafrica: "za",
  "south africa": "za",
  canada: "ca",
  "bosnia and herzegovina": "ba",
  "bosnia-herzegovina": "ba",
  "bosnia y herzegovina": "ba",
  "bosnia herzegovina": "ba",
  bosnia: "ba",
  "south korea": "kr",
  "corea del sur": "kr",
  "czech republic": "cz",
  czechia: "cz",
  chequia: "cz",
  "republica checa": "cz",
  "estados unidos": "us",
  "united states": "us",
  qatar: "qa",
  switzerland: "ch",
  suiza: "ch",
  brasil: "br",
  brazil: "br",
  haiti: "ht",
  scotland: "gb-sct",
  escocia: "gb-sct",
  francia: "fr",
  france: "fr",
  espana: "es",
  spain: "es",
  alemania: "de",
  germany: "de",
  italia: "it",
  italy: "it",
  inglaterra: "gb-eng",
  england: "gb-eng",
  japon: "jp",
  japan: "jp",
  australia: "au",
  turkey: "tr",
  turquia: "tr",
  marruecos: "ma",
  morocco: "ma",
  portugal: "pt",
  uruguay: "uy",
  paraguay: "py",
  "ivory coast": "ci",
  "costa de marfil": "ci",
  ecuador: "ec",
  curacao: "cw",
  curazao: "cw",
  netherlands: "nl",
  "paises bajos": "nl",
  sweden: "se",
  suecia: "se",
  tunisia: "tn",
  tunez: "tn",
  "saudi arabia": "sa",
  "arabia saudita": "sa",
  "cape verde": "cv",
  "cape verde islands": "cv",
  "cabo verde": "cv",
  iran: "ir",
  "new zealand": "nz",
  "nueva zelanda": "nz",
  belgium: "be",
  belgica: "be",
  egypt: "eg",
  egipto: "eg",
  senegal: "sn",
  iraq: "iq",
  irak: "iq",
  norway: "no",
  noruega: "no",
  algeria: "dz",
  argelia: "dz",
  austria: "at",
  jordan: "jo",
  jordania: "jo",
  ghana: "gh",
  panama: "pa",
  croatia: "hr",
  croacia: "hr",
  "dr congo": "cd",
  "congo dr": "cd",
  "rd congo": "cd",
  colombia: "co",
  uzbekistan: "uz"
};

const fifaToIso: Record<string, string> = {
  ARG: "ar",
  MEX: "mx",
  RSA: "za",
  CAN: "ca",
  BIH: "ba",
  BOS: "ba",
  KOR: "kr",
  CZE: "cz",
  USA: "us",
  QAT: "qa",
  SUI: "ch",
  BRA: "br",
  HAI: "ht",
  SCO: "gb-sct",
  FRA: "fr",
  ESP: "es",
  GER: "de",
  ITA: "it",
  ENG: "gb-eng",
  JPN: "jp",
  AUS: "au",
  TUR: "tr",
  MAR: "ma",
  POR: "pt",
  URU: "uy",
  PAR: "py",
  CIV: "ci",
  ECU: "ec",
  CUR: "cw",
  CUW: "cw",
  NED: "nl",
  SWE: "se",
  TUN: "tn",
  KSA: "sa",
  CPV: "cv",
  IRN: "ir",
  NZL: "nz",
  BEL: "be",
  EGY: "eg",
  SEN: "sn",
  IRQ: "iq",
  NOR: "no",
  ALG: "dz",
  AUT: "at",
  JOR: "jo",
  GHA: "gh",
  PAN: "pa",
  CRO: "hr",
  COD: "cd",
  COL: "co",
  UZB: "uz"
};

const displayNames: Record<string, string> = {
  argentina: "Argentina",
  mexico: "México",
  sudafrica: "Sudáfrica",
  "south africa": "Sudáfrica",
  canada: "Canadá",
  "bosnia and herzegovina": "Bosnia y Herzegovina",
  "bosnia-herzegovina": "Bosnia y Herzegovina",
  "bosnia y herzegovina": "Bosnia y Herzegovina",
  "bosnia herzegovina": "Bosnia y Herzegovina",
  bosnia: "Bosnia y Herzegovina",
  "south korea": "Corea del Sur",
  "corea del sur": "Corea del Sur",
  "czech republic": "Chequia",
  czechia: "Chequia",
  chequia: "Chequia",
  "republica checa": "República Checa",
  "estados unidos": "Estados Unidos",
  "united states": "Estados Unidos",
  qatar: "Qatar",
  switzerland: "Suiza",
  suiza: "Suiza",
  brasil: "Brasil",
  brazil: "Brasil",
  haiti: "Haití",
  scotland: "Escocia",
  escocia: "Escocia",
  francia: "Francia",
  france: "Francia",
  espana: "España",
  spain: "España",
  alemania: "Alemania",
  germany: "Alemania",
  italia: "Italia",
  italy: "Italia",
  inglaterra: "Inglaterra",
  england: "Inglaterra",
  japon: "Japón",
  japan: "Japón",
  australia: "Australia",
  turkey: "Turquía",
  turquia: "Turquía",
  marruecos: "Marruecos",
  morocco: "Marruecos",
  portugal: "Portugal",
  uruguay: "Uruguay",
  paraguay: "Paraguay",
  "ivory coast": "Costa de Marfil",
  "costa de marfil": "Costa de Marfil",
  ecuador: "Ecuador",
  curacao: "Curazao",
  curazao: "Curazao",
  netherlands: "Países Bajos",
  "paises bajos": "Países Bajos",
  sweden: "Suecia",
  suecia: "Suecia",
  tunisia: "Túnez",
  tunez: "Túnez",
  "saudi arabia": "Arabia Saudita",
  "arabia saudita": "Arabia Saudita",
  "cape verde": "Cabo Verde",
  "cape verde islands": "Cabo Verde",
  "cabo verde": "Cabo Verde",
  iran: "Irán",
  "new zealand": "Nueva Zelanda",
  "nueva zelanda": "Nueva Zelanda",
  belgium: "Bélgica",
  belgica: "Bélgica",
  egypt: "Egipto",
  egipto: "Egipto",
  senegal: "Senegal",
  iraq: "Irak",
  irak: "Irak",
  norway: "Noruega",
  noruega: "Noruega",
  algeria: "Argelia",
  argelia: "Argelia",
  austria: "Austria",
  jordan: "Jordania",
  jordania: "Jordania",
  ghana: "Ghana",
  panama: "Panamá",
  croatia: "Croacia",
  croacia: "Croacia",
  "dr congo": "RD Congo",
  "congo dr": "RD Congo",
  "rd congo": "RD Congo",
  colombia: "Colombia",
  uzbekistan: "Uzbekistán"
};

function normalize(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isBracketPlaceholder(team: string) {
  return /^(?:[12][A-L]|3[A-L](?:\/[A-L])+|Ganador \d+|Perdedor \d+)$/i.test(team.trim());
}

export function countryCodeForTeam(team: string, explicit?: string | null) {
  if (isBracketPlaceholder(team)) return null;
  const alias = aliases[normalize(team)];
  if (alias) return alias;
  if (explicit) {
    const clean = explicit.trim();
    return fifaToIso[clean.toUpperCase()] ?? clean.toLowerCase();
  }
  return null;
}

export function flagUrlForTeam(team: string, explicit?: string | null) {
  const code = countryCodeForTeam(team, explicit);
  if (!code) return null;
  if (code === "gb-sct") return "/flags/gb-sct.svg";
  if (code === "gb-eng") return "/flags/gb-eng.svg";
  if (code === "ba") return "/flags/ba.svg";
  if (code === "cw") return "/flags/cw.svg";
  return `https://flagcdn.com/w40/${code}.png`;
}

export function flagEmojiForTeam(team: string, explicit?: string | null) {
  const code = countryCodeForTeam(team, explicit);
  if (!code) return "🏳️";
  if (code === "gb-sct") return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f);
  if (code === "gb-eng") return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
  return code
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

export function displayNameForTeam(team: string) {
  if (isBracketPlaceholder(team)) return team;
  return displayNames[normalize(team)] ?? team;
}
