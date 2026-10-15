// Shape of the processed JSON in public/data (see scripts/process_data.py).

/** [overall, potential, age, value €k, wage €k, positions, club index] */
export type Row = [number, number, number, number, number, string, number];

export interface Meta {
  seasons: string[];
  clubNames: string[];
  gameClubs: string[];
  valueModel: { coef: number[]; residualSd: number };
  devByAge: Record<string, [number, number, number]>;
  headroomRate: number;
  missingRateByAge: Record<string, number>;
}

export interface GameData {
  meta: Meta;
  /** id -> [short name, nationality] */
  names: Record<string, [string, string]>;
  /** index 0..4 = 2015/16..2019/20; id -> row */
  seasons: Record<string, Row>[];
  /** 2015/16 squads by club name */
  squads: Record<string, number[]>;
  /** season start year -> club name -> academy graduates */
  youth: Record<string, Record<string, number[]>>;
}

export const SEASON_YEARS = [2015, 2016, 2017, 2018, 2019];
export const NUM_SEASONS = SEASON_YEARS.length;

export async function loadGameData(load: (file: string) => Promise<unknown>): Promise<GameData> {
  const [meta, names, squads, youth, ...seasons] = await Promise.all([
    load('meta.json'),
    load('players.json'),
    load('squads_2015.json'),
    load('youth.json'),
    ...SEASON_YEARS.map((y) => load(`season_${y}.json`)),
  ]);
  return {
    meta: meta as Meta,
    names: names as GameData['names'],
    squads: squads as GameData['squads'],
    youth: youth as GameData['youth'],
    seasons: seasons as Record<string, Row>[],
  };
}
