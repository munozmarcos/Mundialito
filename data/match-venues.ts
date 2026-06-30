import type { MatchStage } from "@/lib/types";

type FixtureVenue = {
  stage: MatchStage;
  kickoffAt: string;
  home: string;
  away: string;
  venue: string;
};

const fixtureVenues: FixtureVenue[] = [
  { stage: "GROUP", kickoffAt: "2026-06-11T19:00:00.000Z", home: "Mexico", away: "South Africa", venue: "Mexico City - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-12T02:00:00.000Z", home: "South Korea", away: "Czechia", venue: "Guadalajara - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-12T19:00:00.000Z", home: "Canada", away: "Bosnia-Herzegovina", venue: "Toronto - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-13T01:00:00.000Z", home: "United States", away: "Paraguay", venue: "Los Angeles - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-13T19:00:00.000Z", home: "Qatar", away: "Switzerland", venue: "San Francisco Bay Area - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-13T22:00:00.000Z", home: "Brazil", away: "Morocco", venue: "New York/New Jersey - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-14T01:00:00.000Z", home: "Haiti", away: "Scotland", venue: "Boston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-14T04:00:00.000Z", home: "Australia", away: "Turkey", venue: "Vancouver - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-14T17:00:00.000Z", home: "Germany", away: "Curaçao", venue: "Houston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-14T20:00:00.000Z", home: "Netherlands", away: "Japan", venue: "Dallas - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-14T23:00:00.000Z", home: "Ivory Coast", away: "Ecuador", venue: "Philadelphia - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-15T02:00:00.000Z", home: "Sweden", away: "Tunisia", venue: "Monterrey - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-15T16:00:00.000Z", home: "Spain", away: "Cape Verde Islands", venue: "Atlanta - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-15T19:00:00.000Z", home: "Belgium", away: "Egypt", venue: "Seattle - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-15T22:00:00.000Z", home: "Saudi Arabia", away: "Uruguay", venue: "Miami - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-16T01:00:00.000Z", home: "Iran", away: "New Zealand", venue: "Los Angeles - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-16T19:00:00.000Z", home: "France", away: "Senegal", venue: "New York/New Jersey - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-16T22:00:00.000Z", home: "Iraq", away: "Norway", venue: "Boston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-17T01:00:00.000Z", home: "Argentina", away: "Algeria", venue: "Kansas City - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-17T04:00:00.000Z", home: "Austria", away: "Jordan", venue: "San Francisco Bay Area - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-17T17:00:00.000Z", home: "Portugal", away: "Congo DR", venue: "Houston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-17T20:00:00.000Z", home: "England", away: "Croatia", venue: "Dallas - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-17T23:00:00.000Z", home: "Ghana", away: "Panama", venue: "Toronto - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-18T02:00:00.000Z", home: "Uzbekistan", away: "Colombia", venue: "Mexico City - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-18T16:00:00.000Z", home: "Czechia", away: "South Africa", venue: "Atlanta - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-18T19:00:00.000Z", home: "Switzerland", away: "Bosnia-Herzegovina", venue: "Los Angeles - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-18T22:00:00.000Z", home: "Canada", away: "Qatar", venue: "Vancouver - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-19T01:00:00.000Z", home: "Mexico", away: "South Korea", venue: "Guadalajara - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-19T19:00:00.000Z", home: "United States", away: "Australia", venue: "Seattle - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-19T22:00:00.000Z", home: "Scotland", away: "Morocco", venue: "Boston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-20T00:30:00.000Z", home: "Brazil", away: "Haiti", venue: "Philadelphia - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-20T03:00:00.000Z", home: "Turkey", away: "Paraguay", venue: "San Francisco Bay Area - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-20T17:00:00.000Z", home: "Netherlands", away: "Sweden", venue: "Houston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-20T20:00:00.000Z", home: "Germany", away: "Ivory Coast", venue: "Toronto - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-21T00:00:00.000Z", home: "Ecuador", away: "Curaçao", venue: "Kansas City - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-21T04:00:00.000Z", home: "Tunisia", away: "Japan", venue: "Monterrey - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-21T16:00:00.000Z", home: "Spain", away: "Saudi Arabia", venue: "Atlanta - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-21T19:00:00.000Z", home: "Belgium", away: "Iran", venue: "Los Angeles - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-21T22:00:00.000Z", home: "Uruguay", away: "Cape Verde Islands", venue: "Miami - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-22T01:00:00.000Z", home: "New Zealand", away: "Egypt", venue: "Vancouver - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-22T17:00:00.000Z", home: "Argentina", away: "Austria", venue: "Dallas - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-22T21:00:00.000Z", home: "France", away: "Iraq", venue: "Philadelphia - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-23T00:00:00.000Z", home: "Norway", away: "Senegal", venue: "New York/New Jersey - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-23T03:00:00.000Z", home: "Jordan", away: "Algeria", venue: "San Francisco Bay Area - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-23T17:00:00.000Z", home: "Portugal", away: "Uzbekistan", venue: "Houston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-23T20:00:00.000Z", home: "England", away: "Ghana", venue: "Boston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-23T23:00:00.000Z", home: "Panama", away: "Croatia", venue: "Toronto - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-24T02:00:00.000Z", home: "Colombia", away: "Congo DR", venue: "Guadalajara - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-24T19:00:00.000Z", home: "Bosnia-Herzegovina", away: "Qatar", venue: "Seattle - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-24T19:00:00.000Z", home: "Switzerland", away: "Canada", venue: "Vancouver - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-24T22:00:00.000Z", home: "Morocco", away: "Haiti", venue: "Atlanta - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-24T22:00:00.000Z", home: "Scotland", away: "Brazil", venue: "Miami - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-25T01:00:00.000Z", home: "Czechia", away: "Mexico", venue: "Mexico City - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-25T01:00:00.000Z", home: "South Africa", away: "South Korea", venue: "Monterrey - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-25T20:00:00.000Z", home: "Ecuador", away: "Germany", venue: "New York/New Jersey - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-25T20:00:00.000Z", home: "Curaçao", away: "Ivory Coast", venue: "Philadelphia - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-25T23:00:00.000Z", home: "Japan", away: "Sweden", venue: "Dallas - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-25T23:00:00.000Z", home: "Tunisia", away: "Netherlands", venue: "Kansas City - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-26T02:00:00.000Z", home: "Paraguay", away: "Australia", venue: "San Francisco Bay Area - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-26T02:00:00.000Z", home: "Turkey", away: "United States", venue: "Los Angeles - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-26T19:00:00.000Z", home: "Norway", away: "France", venue: "Boston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-26T19:00:00.000Z", home: "Senegal", away: "Iraq", venue: "Toronto - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-27T00:00:00.000Z", home: "Uruguay", away: "Spain", venue: "Guadalajara - Mexico" },
  { stage: "GROUP", kickoffAt: "2026-06-27T00:00:00.000Z", home: "Cape Verde Islands", away: "Saudi Arabia", venue: "Houston - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-27T03:00:00.000Z", home: "New Zealand", away: "Belgium", venue: "Vancouver - Canada" },
  { stage: "GROUP", kickoffAt: "2026-06-27T03:00:00.000Z", home: "Egypt", away: "Iran", venue: "Seattle - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-27T21:00:00.000Z", home: "Panama", away: "England", venue: "New York/New Jersey - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-27T21:00:00.000Z", home: "Croatia", away: "Ghana", venue: "Philadelphia - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-27T23:30:00.000Z", home: "Colombia", away: "Portugal", venue: "Miami - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-27T23:30:00.000Z", home: "Congo DR", away: "Uzbekistan", venue: "Atlanta - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-28T02:00:00.000Z", home: "Algeria", away: "Austria", venue: "Kansas City - USA" },
  { stage: "GROUP", kickoffAt: "2026-06-28T02:00:00.000Z", home: "Jordan", away: "Argentina", venue: "Dallas - USA" },
  { stage: "R32", kickoffAt: "2026-06-28T19:00:00.000Z", home: "South Africa", away: "Canada", venue: "Los Angeles - USA" },
  { stage: "R32", kickoffAt: "2026-06-29T17:00:00.000Z", home: "Brazil", away: "Japan", venue: "Houston - USA" },
  { stage: "R32", kickoffAt: "2026-06-29T20:30:00.000Z", home: "Germany", away: "Paraguay", venue: "Boston - USA" },
  { stage: "R32", kickoffAt: "2026-06-30T01:00:00.000Z", home: "Netherlands", away: "Morocco", venue: "Monterrey - Mexico" },
  { stage: "R32", kickoffAt: "2026-06-30T17:00:00.000Z", home: "Ivory Coast", away: "Norway", venue: "Dallas - USA" },
  { stage: "R32", kickoffAt: "2026-06-30T21:00:00.000Z", home: "France", away: "Sweden", venue: "New York/New Jersey - USA" },
  { stage: "R32", kickoffAt: "2026-07-01T01:00:00.000Z", home: "Mexico", away: "Ecuador", venue: "Mexico City - Mexico" },
  { stage: "R32", kickoffAt: "2026-07-01T16:00:00.000Z", home: "England", away: "Congo DR", venue: "Atlanta - USA" },
  { stage: "R32", kickoffAt: "2026-07-01T20:00:00.000Z", home: "Belgium", away: "Senegal", venue: "Seattle - USA" },
  { stage: "R32", kickoffAt: "2026-07-02T00:00:00.000Z", home: "United States", away: "Bosnia-Herzegovina", venue: "San Francisco Bay Area - USA" },
  { stage: "R32", kickoffAt: "2026-07-02T19:00:00.000Z", home: "Spain", away: "Austria", venue: "Los Angeles - USA" },
  { stage: "R32", kickoffAt: "2026-07-02T23:00:00.000Z", home: "Portugal", away: "Croatia", venue: "Toronto - Canada" },
  { stage: "R32", kickoffAt: "2026-07-03T03:00:00.000Z", home: "Switzerland", away: "Algeria", venue: "Vancouver - Canada" },
  { stage: "R32", kickoffAt: "2026-07-03T18:00:00.000Z", home: "Australia", away: "Egypt", venue: "Dallas - USA" },
  { stage: "R32", kickoffAt: "2026-07-03T22:00:00.000Z", home: "Argentina", away: "Cape Verde Islands", venue: "Miami - USA" },
  { stage: "R32", kickoffAt: "2026-07-04T01:30:00.000Z", home: "Colombia", away: "Ghana", venue: "Kansas City - USA" },
  { stage: "R16", kickoffAt: "2026-07-04T17:00:00.000Z", home: "Canada", away: "Morocco", venue: "Houston - USA" },
  { stage: "R16", kickoffAt: "2026-07-04T21:00:00.000Z", home: "Paraguay", away: "Ganador 77", venue: "Philadelphia - USA" },
  { stage: "R16", kickoffAt: "2026-07-05T20:00:00.000Z", home: "Brazil", away: "Ganador 78", venue: "New York/New Jersey - USA" },
  { stage: "R16", kickoffAt: "2026-07-06T00:00:00.000Z", home: "Ganador 79", away: "Ganador 80", venue: "Mexico City - Mexico" },
  { stage: "R16", kickoffAt: "2026-07-06T19:00:00.000Z", home: "Ganador 83", away: "Ganador 84", venue: "Dallas - USA" },
  { stage: "R16", kickoffAt: "2026-07-07T00:00:00.000Z", home: "Ganador 81", away: "Ganador 82", venue: "Seattle - USA" },
  { stage: "R16", kickoffAt: "2026-07-07T16:00:00.000Z", home: "Ganador 86", away: "Ganador 88", venue: "Atlanta - USA" },
  { stage: "R16", kickoffAt: "2026-07-07T20:00:00.000Z", home: "Ganador 85", away: "Ganador 87", venue: "Vancouver - Canada" },
  { stage: "QF", kickoffAt: "2026-07-09T20:00:00.000Z", home: "Ganador 89", away: "Ganador 90", venue: "Boston - USA" },
  { stage: "QF", kickoffAt: "2026-07-10T19:00:00.000Z", home: "Ganador 93", away: "Ganador 94", venue: "Los Angeles - USA" },
  { stage: "QF", kickoffAt: "2026-07-11T21:00:00.000Z", home: "Ganador 91", away: "Ganador 92", venue: "Miami - USA" },
  { stage: "QF", kickoffAt: "2026-07-12T01:00:00.000Z", home: "Ganador 95", away: "Ganador 96", venue: "Kansas City - USA" },
  { stage: "SF", kickoffAt: "2026-07-14T19:00:00.000Z", home: "Ganador 97", away: "Ganador 98", venue: "Dallas - USA" },
  { stage: "SF", kickoffAt: "2026-07-15T19:00:00.000Z", home: "Ganador 99", away: "Ganador 100", venue: "Atlanta - USA" },
  { stage: "THIRD_PLACE", kickoffAt: "2026-07-18T21:00:00.000Z", home: "Perdedor 101", away: "Perdedor 102", venue: "Miami - USA" },
  { stage: "FINAL", kickoffAt: "2026-07-19T19:00:00.000Z", home: "Ganador 101", away: "Ganador 102", venue: "New York/New Jersey - USA" }
];

function normalizeVenueTeam(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function venueKey(stage: MatchStage, kickoffAt: string, home?: string | null, away?: string | null) {
  const iso = new Date(kickoffAt).toISOString();
  return `${stage}:${iso}:${normalizeVenueTeam(home)}:${normalizeVenueTeam(away)}`;
}

const fixtureVenueMap = new Map(fixtureVenues.map((fixture) => [venueKey(fixture.stage, fixture.kickoffAt, fixture.home, fixture.away), fixture.venue]));
const knockoutVenueByTimeMap = new Map(
  fixtureVenues
    .filter((fixture) => fixture.stage !== "GROUP")
    .map((fixture) => [`${fixture.stage}:${new Date(fixture.kickoffAt).toISOString()}`, fixture.venue])
);

export function venueForFixture(stage: MatchStage, kickoffAt: string, home?: string | null, away?: string | null) {
  return fixtureVenueMap.get(venueKey(stage, kickoffAt, home, away)) ?? knockoutVenueByTimeMap.get(`${stage}:${new Date(kickoffAt).toISOString()}`) ?? null;
}
