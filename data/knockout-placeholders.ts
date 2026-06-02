import type { MatchStage } from "@/lib/types";

export type KnockoutPlaceholder = {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  stadium: string;
  stage: Exclude<MatchStage, "GROUP">;
};

export const knockoutPlaceholders: KnockoutPlaceholder[] = [
  { matchNumber: 73, stage: "R32", homeTeam: "2A", awayTeam: "2B", kickoffAt: "2026-06-28T19:00:00.000Z", stadium: "SoFi Stadium, Los Angeles" },
  { matchNumber: 74, stage: "R32", homeTeam: "1E", awayTeam: "3A/B/C/D/F", kickoffAt: "2026-06-29T20:30:00.000Z", stadium: "Gillette Stadium, Boston" },
  { matchNumber: 75, stage: "R32", homeTeam: "1F", awayTeam: "2C", kickoffAt: "2026-06-30T01:00:00.000Z", stadium: "Estadio BBVA, Monterrey" },
  { matchNumber: 76, stage: "R32", homeTeam: "1C", awayTeam: "2F", kickoffAt: "2026-06-29T17:00:00.000Z", stadium: "NRG Stadium, Houston" },
  { matchNumber: 77, stage: "R32", homeTeam: "1I", awayTeam: "3C/D/F/G/H", kickoffAt: "2026-06-30T21:00:00.000Z", stadium: "MetLife Stadium, New York/New Jersey" },
  { matchNumber: 78, stage: "R32", homeTeam: "2E", awayTeam: "2I", kickoffAt: "2026-06-30T17:00:00.000Z", stadium: "AT&T Stadium, Dallas" },
  { matchNumber: 79, stage: "R32", homeTeam: "1A", awayTeam: "3C/E/F/H/I", kickoffAt: "2026-07-01T01:00:00.000Z", stadium: "Estadio Azteca, Mexico City" },
  { matchNumber: 80, stage: "R32", homeTeam: "1L", awayTeam: "3E/H/I/J/K", kickoffAt: "2026-07-01T16:00:00.000Z", stadium: "Mercedes-Benz Stadium, Atlanta" },
  { matchNumber: 81, stage: "R32", homeTeam: "1D", awayTeam: "3B/E/F/I/J", kickoffAt: "2026-07-02T00:00:00.000Z", stadium: "Levi's Stadium, San Francisco Bay Area" },
  { matchNumber: 82, stage: "R32", homeTeam: "1G", awayTeam: "3A/E/H/I/J", kickoffAt: "2026-07-01T20:00:00.000Z", stadium: "Lumen Field, Seattle" },
  { matchNumber: 83, stage: "R32", homeTeam: "2K", awayTeam: "2L", kickoffAt: "2026-07-02T23:00:00.000Z", stadium: "BMO Field, Toronto" },
  { matchNumber: 84, stage: "R32", homeTeam: "1H", awayTeam: "2J", kickoffAt: "2026-07-02T19:00:00.000Z", stadium: "SoFi Stadium, Los Angeles" },
  { matchNumber: 85, stage: "R32", homeTeam: "1B", awayTeam: "3E/F/G/I/J", kickoffAt: "2026-07-03T03:00:00.000Z", stadium: "BC Place, Vancouver" },
  { matchNumber: 86, stage: "R32", homeTeam: "1J", awayTeam: "2H", kickoffAt: "2026-07-03T22:00:00.000Z", stadium: "Hard Rock Stadium, Miami" },
  { matchNumber: 87, stage: "R32", homeTeam: "1K", awayTeam: "3D/E/I/J/L", kickoffAt: "2026-07-04T01:30:00.000Z", stadium: "Arrowhead Stadium, Kansas City" },
  { matchNumber: 88, stage: "R32", homeTeam: "2D", awayTeam: "2G", kickoffAt: "2026-07-03T18:00:00.000Z", stadium: "AT&T Stadium, Dallas" },
  { matchNumber: 89, stage: "R16", homeTeam: "Ganador 74", awayTeam: "Ganador 77", kickoffAt: "2026-07-04T21:00:00.000Z", stadium: "Lincoln Financial Field, Philadelphia" },
  { matchNumber: 90, stage: "R16", homeTeam: "Ganador 73", awayTeam: "Ganador 75", kickoffAt: "2026-07-04T17:00:00.000Z", stadium: "NRG Stadium, Houston" },
  { matchNumber: 91, stage: "R16", homeTeam: "Ganador 76", awayTeam: "Ganador 78", kickoffAt: "2026-07-05T20:00:00.000Z", stadium: "MetLife Stadium, New York/New Jersey" },
  { matchNumber: 92, stage: "R16", homeTeam: "Ganador 79", awayTeam: "Ganador 80", kickoffAt: "2026-07-06T00:00:00.000Z", stadium: "Estadio Azteca, Mexico City" },
  { matchNumber: 93, stage: "R16", homeTeam: "Ganador 83", awayTeam: "Ganador 84", kickoffAt: "2026-07-06T19:00:00.000Z", stadium: "AT&T Stadium, Dallas" },
  { matchNumber: 94, stage: "R16", homeTeam: "Ganador 81", awayTeam: "Ganador 82", kickoffAt: "2026-07-07T00:00:00.000Z", stadium: "Lumen Field, Seattle" },
  { matchNumber: 95, stage: "R16", homeTeam: "Ganador 86", awayTeam: "Ganador 88", kickoffAt: "2026-07-07T16:00:00.000Z", stadium: "Mercedes-Benz Stadium, Atlanta" },
  { matchNumber: 96, stage: "R16", homeTeam: "Ganador 85", awayTeam: "Ganador 87", kickoffAt: "2026-07-07T20:00:00.000Z", stadium: "BC Place, Vancouver" },
  { matchNumber: 97, stage: "QF", homeTeam: "Ganador 89", awayTeam: "Ganador 90", kickoffAt: "2026-07-09T20:00:00.000Z", stadium: "Gillette Stadium, Boston" },
  { matchNumber: 98, stage: "QF", homeTeam: "Ganador 93", awayTeam: "Ganador 94", kickoffAt: "2026-07-10T19:00:00.000Z", stadium: "SoFi Stadium, Los Angeles" },
  { matchNumber: 99, stage: "QF", homeTeam: "Ganador 91", awayTeam: "Ganador 92", kickoffAt: "2026-07-11T21:00:00.000Z", stadium: "Hard Rock Stadium, Miami" },
  { matchNumber: 100, stage: "QF", homeTeam: "Ganador 95", awayTeam: "Ganador 96", kickoffAt: "2026-07-12T01:00:00.000Z", stadium: "Arrowhead Stadium, Kansas City" },
  { matchNumber: 101, stage: "SF", homeTeam: "Ganador 97", awayTeam: "Ganador 98", kickoffAt: "2026-07-14T19:00:00.000Z", stadium: "AT&T Stadium, Dallas" },
  { matchNumber: 102, stage: "SF", homeTeam: "Ganador 99", awayTeam: "Ganador 100", kickoffAt: "2026-07-15T19:00:00.000Z", stadium: "Mercedes-Benz Stadium, Atlanta" },
  { matchNumber: 103, stage: "THIRD_PLACE", homeTeam: "Perdedor 101", awayTeam: "Perdedor 102", kickoffAt: "2026-07-18T21:00:00.000Z", stadium: "Hard Rock Stadium, Miami" },
  { matchNumber: 104, stage: "FINAL", homeTeam: "Ganador 101", awayTeam: "Ganador 102", kickoffAt: "2026-07-19T19:00:00.000Z", stadium: "MetLife Stadium, New York/New Jersey" }
];
