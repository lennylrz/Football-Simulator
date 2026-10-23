// The Daily Challenge: one a day, the same for everyone. Each day has its own
// seed and takes its era and rule from the list below, by day number. Rules
// are mostly about who the draft may offer; a few change the career's rules
// or set a target to reach.
import type { Era, GameData } from './data';
import type { GameState, PlayerState, SeasonHistory } from './game';
import { AREA, type Position } from './positions';
import { hashSeed } from './rng';
import type { PlayStyle } from './styles';

/** Daily #1 is 23 October 2026. Days turn at midnight where the player is. */
const FIRST = Date.UTC(2026, 9, 23);
const DAY = 86_400_000;

export function dailyNumber(now = new Date()): number {
  return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - FIRST) / DAY) + 1;
}

/** Milliseconds until the next challenge. */
export function untilNextDaily(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

export function dailySeed(day: number): number {
  return hashSeed('daily', day);
}

/** A player the draft might offer, with what the rules look at. */
export interface Candidate {
  p: PlayerState;
  nation: string;
  /** his club now: a league club's name, or his real club abroad */
  club: string;
  /** the position being drafted; 'SUB' for the bench */
  slot: Position | 'SUB';
}

export type Target = 'top-half' | 'win-league' | 'above';

export interface Challenge {
  id: string;
  name: string;
  era: Era;
  /** the rule in one short line, shown on the draft */
  rule: string;
  /** who the draft may offer */
  allow?: (o: Candidate, state: GameState, data: GameData) => boolean;
  /** career rules the challenge sets */
  choices?: number;
  redrafts?: number;
  hiddenRatings?: boolean;
  /** a play style the club keeps all career */
  style?: PlayStyle;
  /** the star must be younger than this */
  starUnder?: number;
  /** pass or fail, shown with the result: `above` names the club to finish above every season */
  target?: { kind: Target; label: string; club?: string };
}

const nation = (n: string) => (o: Candidate) => o.nation === n;
/** His age when the career started. */
const startAge = (o: Candidate, s: GameState) => o.p.age - s.season;

const GERMANY = new Set([
  // 2010-2015
  'Hamburger SV', 'Schalke 04', 'SC Freiburg', 'VfL Wolfsburg', 'Borussia Mönchengladbach', 'FC Köln', 'Borussia Dortmund', 'FC Augsburg', 'Hertha BSC',
  'Bayer 04 Leverkusen', 'Werder Bremen', 'Hannover 96', 'FSV Mainz 05', 'FC Bayern München', 'TSG Hoffenheim', 'St. Pauli', 'VfL Bochum 1848', 'DSC Arminia Bielefeld',
  'Nürnberg', 'Eintracht Frankfurt', 'VfB Stuttgart', 'Kaiserslautern', 'Karlsruher SC', 'FC Energie Cottbus', 'SpVgg Greuther Fürth', 'Fortuna Düsseldorf',
  'Eintracht Braunschweig', 'Paderborn', '1860 München', 'RB Leipzig', 'Ingolstadt', 'FSV Frankfurt', 'FC Union Berlin', 'Sandhausen', 'Erzgebirge Aue', 'Darmstadt 98',
  // 2015-2020
  'FC Schalke 04', 'SV Werder Bremen', '1. FC Köln', '1. FSV Mainz 05', 'Sport-Club Freiburg', 'FC Ingolstadt 04', 'SV Darmstadt 98', '1. FC Kaiserslautern',
  '1. FC Heidenheim 1846', 'MSV Duisburg', '1. FC Nürnberg', 'FC St. Pauli', 'SC Paderborn 07', 'TSV 1860 München', '1. FC Union Berlin', 'SV Sandhausen',
  'FC Würzburger Kickers', 'SG Dynamo Dresden', 'FC Erzgebirge Aue', 'Holstein Kiel', 'VfL Osnabrück', 'SSV Jahn Regensburg', 'SV Wehen Wiesbaden',
]);

const ITALY = new Set([
  // 2010-2015
  'Udinese', 'Genoa', 'Milan', 'Brescia', 'Lazio', 'Fiorentina', 'Inter', 'Juventus', 'Bologna', 'Parma', 'Napoli', 'Bari 1908', 'Roma', 'Sampdoria', 'Cagliari',
  'Atalanta', 'Catania', 'Reggina', 'Siena', 'Torino', 'Lecce', 'Cesena', 'Palermo', 'Chievo', 'Livorno', 'Novara Calcio', 'Pescara', 'Hellas Verona', 'Sassuolo',
  'Empoli', 'Perugia', 'Carpi', 'Virtus Entella Chiavari', 'Modena', 'Ternana', 'Latina', 'Avellino', 'Spezia', 'Varese', 'Trapani', 'SS Virtus Lanciano', 'Crotone',
  'Cittadella', 'Frosinone', 'FC Pro Vercelli 1892',
  // 2015-2020
  'AC Milan', 'Torino F.C.', 'U.C. Sampdoria', 'U.S. Sassuolo Calcio', 'Udinese Calcio', 'Chievo Verona', 'Bari', 'Como', 'US Salernitana 1919', 'Vicenza', 'Ascoli',
  'Pisa', 'Benevento', 'SPAL', 'US Cremonese', 'Venezia FC', 'Foggia', 'Cosenza', 'Padova',
]);

/** The real club's name in each era. */
const REAL_MADRID: Record<number, string> = { 2010: 'Real Madrid', 2015: 'Real Madrid CF' };

/** Each line from one club abroad: defence (and goal), midfield, attack. */
const LINES: Record<number, Record<'DEF' | 'MID' | 'ATT', string>> = {
  2010: { DEF: 'Milan', MID: 'FC Barcelona', ATT: 'Real Madrid' },
  2015: { DEF: 'Juventus', MID: 'FC Bayern München', ATT: 'Paris Saint-Germain' },
};
const lineOf = (slot: Position | 'SUB') => (slot === 'SUB' ? 'MID' : AREA[slot] === 'GK' ? 'DEF' : AREA[slot]);

/** The five weakest squads at the start of the era: the average of each club's best eleven. */
const weakest = new WeakMap<GameData, Set<string>>();
function weakestFive(data: GameData): Set<string> {
  let out = weakest.get(data);
  if (!out) {
    const rows = data.seasons[0];
    const rated = Object.entries(data.squads).map(([club, ids]) => {
      const best = ids.map((id) => rows[id]?.[0] ?? 0).sort((a, b) => b - a).slice(0, 11);
      return { club, avg: best.reduce((s, r) => s + r, 0) / best.length };
    });
    out = new Set(rated.sort((a, b) => a.avg - b.avg).slice(0, 5).map((r) => r.club));
    weakest.set(data, out);
  }
  return out;
}

export const CHALLENGES: Challenge[] = [
  { id: 'portugal', name: 'Only Portugal', era: 2015, rule: 'Every player is Portuguese.', allow: nation('Portugal') },
  { id: 'kids', name: 'Kids only', era: 2015, rule: 'Every player is 21 or under at the start.', allow: (o, s) => startAge(o, s) <= 21 },
  { id: 'old-guard', name: 'Old guard', era: 2010, rule: 'Every player is 30 or over at the start.', allow: (o, s) => startAge(o, s) >= 30 },
  {
    id: 'galacticos', name: 'Galácticos in England', era: 2015, rule: "Real Madrid's squad only, in the Premier League.",
    allow: (o, _s, data) => o.club === REAL_MADRID[data.era],
  },
  {
    id: 'underdog', name: 'The underdog', era: 2010, rule: 'Draft from the five weakest squads. No re-drafts.', redrafts: 0,
    allow: (o, _s, data) => weakestFive(data).has(o.club), target: { kind: 'top-half', label: 'Top half every season' },
  },
  { id: 'brazil', name: 'Only Brazil', era: 2010, rule: 'Every player is Brazilian.', allow: nation('Brazil') },
  { id: 'bargain', name: 'Bargain bin', era: 2015, rule: 'Every player is valued under €5m.', allow: (o) => o.p.value < 5000 },
  { id: 'two', name: 'Two choices', era: 2010, rule: 'Two candidates per pick, not five.', choices: 2 },
  { id: 'blind', name: 'Blind draft', era: 2015, rule: 'Ratings hidden in every draft.', hiddenRatings: true },
  { id: 'bundesliga', name: 'Bundesliga XI', era: 2015, rule: 'Every player plays in Germany.', allow: (o) => GERMANY.has(o.club) },
  {
    id: 'bus', name: 'Park the Bus or bust', era: 2010, rule: 'Park the Bus all career.', style: 'bus',
    target: { kind: 'win-league', label: 'Win the league' },
  },
  {
    id: 'one-club', name: 'One club men', era: 2015, rule: 'Defence from Juventus, midfield from Bayern, attack from PSG.',
    allow: (o, _s, data) => o.club === LINES[data.era][lineOf(o.slot)],
  },
  { id: 'spain', name: 'Only Spain', era: 2010, rule: 'Every player is Spanish.', allow: nation('Spain') },
  { id: 'no-redrafts', name: 'No re-drafts', era: 2015, rule: 'The XI you draft is the XI you keep.', redrafts: 0 },
  { id: 'star', name: 'Star system', era: 2010, rule: 'Through the Star, with a star under 23.', style: 'star', starUnder: 23 },
  { id: 'home-grown', name: 'Home-grown', era: 2015, rule: 'Every player is English.', allow: nation('England') },
  { id: 'serie-a', name: 'Serie A XI', era: 2010, rule: 'Every player plays in Italy.', allow: (o) => ITALY.has(o.club) },
  { id: '75-80', name: 'Rated 75-80', era: 2015, rule: 'Every player is rated 75 to 80 when offered.', allow: (o) => o.p.ovr >= 75 && o.p.ovr <= 80 },
  {
    id: 'rival', name: 'The rival', era: 2010, rule: "Arsenal's squad only.", allow: (o) => o.club === 'Arsenal',
    target: { kind: 'above', label: 'Above Chelsea every season', club: 'Chelsea' },
  },
  {
    id: 'mixed', name: 'Mixed bag', era: 2015, rule: 'Every player from a different country.',
    allow: (o, s, data) => {
      const c = s.clubs[s.user];
      return ![...c.xi, ...c.bench].some((id) => id >= 0 && data.names[id]?.[1] === o.nation);
    },
  },
];

const BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

/** The rule and the target in one line. */
export function ruleLine(c: Challenge): string {
  return c.target ? `${c.rule} Target: ${c.target.label[0].toLowerCase()}${c.target.label.slice(1)}.` : c.rule;
}

export function challengeOf(id: string | undefined): Challenge | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}

/** The challenge of a day. */
export function dailyChallenge(day: number): Challenge {
  return CHALLENGES[(((day - 1) % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
}

/** Whether a finished season met the target. */
function metIn(h: SeasonHistory, user: number, data: GameData, kind: Target, club?: string): boolean {
  const at = h.table.findIndex((r) => r.club === user);
  if (kind === 'win-league') return at === 0;
  if (kind === 'top-half') return at < Math.floor(h.table.length / 2);
  const other = h.table.findIndex((r) => data.meta.gameClubs[r.club] === club);
  return other < 0 || at < other;
}

/** Whether the career met its target: so far, or once it is over. */
export function targetMet(state: GameState, data: GameData): boolean | undefined {
  const t = challengeOf(state.daily?.challenge)?.target;
  if (!t) return undefined;
  const met = (h: SeasonHistory) => metIn(h, state.user, data, t.kind, t.club);
  return t.kind === 'win-league' ? state.history.some(met) : state.history.every(met);
}

/**
 * The result to copy and paste: the day and challenge, each season's finish
 * with a cup for every trophy, the legacy score and the target.
 */
export function resultText(day: number, challenge: Challenge, seasons: { finish: number; trophies: unknown[] }[], score: number, met: boolean | undefined, site: string): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const ord = (n: number) => n + (suffix[((n % 100) - 20) % 10] || suffix[n % 100] || suffix[0]);
  const finishes = seasons.map((s) => ord(s.finish) + '\u{1F3C6}'.repeat(s.trophies.length)).join(' ');
  const target = met === undefined ? '' : ` · ${challenge.target!.label}: ${met ? 'done' : 'missed'}`;
  return [`Five Seasons Daily #${day} · ${challenge.name}`, finishes, `Legacy ${score.toLocaleString('en-GB')}${target}`, site].join('\n');
}
