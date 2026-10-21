// Shape of the processed JSON in public/data (see scripts/process_data.py).

/** [overall, potential, age, value €k, wage €k, positions, club index] */
export type Row = [number, number, number, number, number, string, number];

export interface Meta {
  /** first season's start year */
  era: number;
  /** each season's start year */
  years: number[];
  seasons: string[];
  clubNames: string[];
  gameClubs: string[];
  valueModel: { coef: number[]; residualSd: number };
  devByAge: Record<string, [number, number, number]>;
  headroomRate: number;
  missingRateByAge: Record<string, number>;
}

export interface GameData {
  era: number;
  meta: Meta;
  /** id -> [short name, nationality] */
  names: Record<string, [string, string]>;
  /** index 0..4 = the era's five seasons; id -> row */
  seasons: Record<string, Row>[];
  /** squads at the start of the era, by club name */
  squads: Record<string, number[]>;
  /** season start year -> club name -> academy graduates */
  youth: Record<string, Record<string, number[]>>;
  /** season start year -> cup opponents rated from their real squads */
  teams: Record<string, SeasonTeams>;
}

export interface SeasonTeams {
  /** [club, tier (2 = Championship), rating] */
  english: [string, number, number][];
  /** [club, league, rating], strongest first */
  europe: [string, string, number][];
}

/** The playable eras, by first season's start year. */
export const ERAS = [2010, 2015, 2020] as const;
export type Era = (typeof ERAS)[number];

/** The current era's season start years (see activateEra in game.ts). */
export const SEASON_YEARS: number[] = [2015, 2016, 2017, 2018, 2019];
export const NUM_SEASONS = 5;

export function seasonLabel(season: number): string {
  const y = SEASON_YEARS[season];
  return `${y}/${String(y + 1).slice(2)}`;
}

/** "2015/16 – 2019/20" */
export function eraSeasons(): string {
  return `${seasonLabel(0)} – ${seasonLabel(NUM_SEASONS - 1)}`;
}

/** "2015 – 2020" */
export function eraYears(sep = ' – '): string {
  return `${SEASON_YEARS[0]}${sep}${SEASON_YEARS[NUM_SEASONS - 1] + 1}`;
}

export async function loadGameData(load: (file: string) => Promise<unknown>, era: Era = 2015): Promise<GameData> {
  const years = Array.from({ length: NUM_SEASONS }, (_, i) => era + i);
  const [meta, names, squads, youth, teams, ...seasons] = await Promise.all([
    load(`${era}/meta.json`),
    load(`${era}/players.json`),
    load(`${era}/squads.json`),
    load(`${era}/youth.json`),
    load(`${era}/teams.json`),
    ...years.map((y) => load(`${era}/season_${y}.json`)),
  ]);
  return {
    era,
    meta: meta as Meta,
    names: names as GameData['names'],
    squads: squads as GameData['squads'],
    youth: youth as GameData['youth'],
    teams: teams as GameData['teams'],
    seasons: seasons as Record<string, Row>[],
  };
}
