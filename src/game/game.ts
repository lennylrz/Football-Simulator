// Game state and the season flow: transfer window -> lineup -> simulation.
import { aiWindow, ensureMinimumSquad } from './ai';
import { type ClubInfo, CLUBS, setEraClubs } from './clubs';
import {
  CL_ROUNDS, type CupResult, type Entrant, FA_ROUNDS, simulateChampionsLeague, simulateFaCup, WINNER,
} from './cups';
import { type GameData, NUM_SEASONS, SEASON_YEARS, seasonLabel } from './data';
import { developPlayer, type Form, formBoost, goatPotential, retireChance } from './development';
import { autoLineup, BENCH_SIZE, pickBench, pickXI, type PlayerLite, teamStrength } from './lineup';
import { generateIncomingBids, generateOffers, type IncomingBid, type Offer } from './market';
import { type DraftState, openDraftWindow } from './draft';
import { AREA, FORMATIONS, type Formation, parsePositions, type Position, positionFit } from './positions';
import { type PlayStyle, styleGrowth } from './styles';
import { stream } from './rng';
import { fixtures, type PlayerSeasonStats, type SeasonResult, simulateSeason, type TableRow } from './season';
import { expectedGoals, type MatchResult } from './match';
import { marketValue } from './valuation';
import { type BallonEntry, ballonDor, playerOfSeason } from './awards';
import { mergeStats } from './career';
import { seasonStory } from './story';

export const MAX_SQUAD = 26;
export const MIN_SQUAD = 16;
/** Academy graduates promoted per club per season. */
const MAX_YOUTH = 2;
/** Chance the drafted club rests each starter for a substitute who can play there. */
const DRAFT_ROTATION = 0.2;
/** Club index for players outside the 20 clubs. */
export const EXTERNAL = -1;

export interface PlayerState {
  id: number;
  ovr: number;
  pot: number;
  age: number;
  ref: number;
  pos: string;
  club: number;
  /** €k, refreshed each season */
  value: number;
  retired?: boolean;
}

export interface ClubState {
  id: number;
  /** a manager's play style, and the player it was built around last season */
  style?: PlayStyle;
  star?: number;
  rep: number;
  /** transfer budget, €k */
  cash: number;
  squad: number[];
  formation: Formation;
  xi: number[];
  bench: number[];
}

export interface TransferRecord {
  season: number;
  player: number;
  /** club index, or EXTERNAL */
  from: number;
  to: number;
  fee: number;
  /** player's overall when the deal was done */
  ovr: number;
  /** name of the outside club, when from/to is EXTERNAL */
  other?: string;
}

export type NewsItem =
  | { kind: 'transfer'; t: TransferRecord }
  | { kind: 'retired'; player: number; club: number }
  | { kind: 'youth'; player: number; club: number };

/** A season's league plus cups, as kept for the current season. */
export interface SeasonPlay extends SeasonResult {
  fa: CupResult;
  cl: CupResult;
  /** cup appearances of the user's players */
  cupStats: PlayerSeasonStats[];
  /** two-player room: cup appearances of each manager's players, by club */
  cupStatsByClub?: Record<number, PlayerSeasonStats[]>;
}

/** A match between the two managers of a room. */
export interface HeadToHead {
  comp: string;
  /** league round, or the cup calendar slot */
  slot: number;
  home: number;
  away: number;
  hg: number;
  ag: number;
  pens?: 0 | 1;
  /** [scorer, assister or -1, 0 = home / 1 = away] */
  goals: [number, number, 0 | 1][];
}

/** One manager's side of a season, kept per manager in a two-player room. */
export type UserSeason = Pick<SeasonHistory, 'userStats' | 'userCupStats' | 'repBefore' | 'repAfter' | 'predicted' | 'pots' | 'story' | 'ratings'>;

export interface SeasonHistory {
  season: number;
  table: TableRow[];
  faWinner: Entrant;
  clWinner: Entrant;
  /** round reached by each game club, '' if it did not enter */
  faReached: Record<number, string>;
  clReached: Record<number, string>;
  /** [player, club, goals] */
  topScorers: [number, number, number][];
  topAssists: [number, number, number][];
  userStats: PlayerSeasonStats[];
  userCupStats: PlayerSeasonStats[];
  repBefore: number;
  repAfter?: number;
  /** where the user's XI ranked on paper before the season */
  predicted?: number;
  /** two-player room: each manager's own stats, by club */
  byUser?: Record<number, UserSeason>;
  /** two-player room: the managers' matches against each other */
  h2h?: HeadToHead[];
  /** the user's player of the season */
  pots?: number;
  /** the user's season in a few lines */
  story?: string[];
  /** [player, overall] of the user's squad when the season was played */
  ratings?: [number, number][];
  /** the Ballon d'Or podium */
  ballon?: BallonEntry[];
}

export interface DevChange {
  player: number;
  from: number;
  to: number;
  /** last season's average match rating, for regulars */
  avg?: number;
  /** rating points that performance added or took away */
  boost?: number;
}

export type Stage = 'window' | 'lineup' | 'draft' | 'summer' | 'results' | 'summary';
export type WindowStep = 'squad' | 'offers' | 'bids';

/** A manager's own part of the game in a two-player room. */
export interface HumanView {
  draft: DraftState | null;
  stage: Stage;
  devReport: DevChange[];
  /** summer: XI set, waiting for the host to play the season */
  ready?: boolean;
  /** results: has moved on from the season review */
  done?: boolean;
}

export interface GameState {
  v: 1;
  seed: number;
  /** user's club index, or -1 when every club is run by the AI (tests) */
  user: number;
  /** 'draft': the user drafts an XI instead of managing a squad */
  mode?: 'draft';
  draft?: DraftState | null;
  /** draft mode: the user's own club, to register on load */
  ownClub?: ClubInfo;
  /** draft mode: re-drafts per summer and candidates per pick, from the settings */
  rules?: { redrafts: number; choices: number; bench?: number };
  /** draft mode: players offered in recent careers, offered less often now */
  recent?: number[];
  season: number;
  stage: Stage;
  /** 'open' before deadline day, 'deadline' after the AI's last round of deals */
  windowPhase: 'open' | 'deadline';
  /** step of the user's transfer window */
  step: WindowStep;
  /** bids for the user's players this window */
  bids: IncomingBid[];
  players: Record<number, PlayerState>;
  clubs: ClubState[];
  offers: Offer[];
  news: NewsItem[];
  transfers: TransferRecord[];
  devReport: DevChange[];
  result: SeasonPlay | null;
  history: SeasonHistory[];
  /** €k received from income this season, for display */
  income: number;
  /** two-player room: the managers' clubs (host first) and each one's view */
  mp?: { humans: number[]; views: Record<number, HumanView> };
}

/** The clubs run by people: the user, or both managers of a room. */
export function humansOf(state: GameState): number[] {
  return state.mp?.humans ?? (state.user >= 0 ? [state.user] : []);
}

export function isHuman(state: GameState, club: number): boolean {
  return humansOf(state).includes(club);
}

/** A manager's draft, whether or not he is the one acting now. */
export function draftOf(state: GameState, club: number): DraftState | null | undefined {
  return club === state.user ? state.draft : state.mp?.views[club]?.draft;
}

/**
 * Runs fn as one manager of a room: his club is the user, and his draft,
 * stage and development report are the state's for the duration.
 */
export function asUser<T>(state: GameState, club: number, fn: () => T): T {
  const v = state.mp?.views[club];
  if (!v) return fn();
  const saved = { user: state.user, draft: state.draft, stage: state.stage, devReport: state.devReport };
  state.user = club;
  state.draft = v.draft;
  state.stage = v.stage;
  state.devReport = v.devReport;
  try {
    return fn();
  } finally {
    v.draft = state.draft ?? null;
    v.stage = state.stage;
    v.devReport = state.devReport;
    Object.assign(state, saved);
  }
}

export { seasonLabel };

/**
 * Makes an era's data the current one: its season years and its 20 clubs.
 * Call once its data has loaded, before any screen shows it.
 */
export function activateEra(data: GameData): void {
  SEASON_YEARS.splice(0, SEASON_YEARS.length, ...data.meta.years);
  setEraClubs(data.era);
}

export function lite(p: PlayerState): PlayerLite {
  return { id: p.id, ovr: p.ovr, pos: parsePositions(p.pos) };
}

export function squadOf(state: GameState, club: number): PlayerState[] {
  return state.clubs[club].squad.map((id) => state.players[id]);
}

export function refreshValue(state: GameState, data: GameData, p: PlayerState): void {
  p.value = marketValue(data.meta, p.ovr, p.age, p.pot, data.seasons[state.season][p.id]);
}

/** Players outside the 20 clubs with data this season. */
export function marketPool(state: GameState, data: GameData): PlayerState[] {
  const rows = data.seasons[state.season];
  const out: PlayerState[] = [];
  for (const id in rows) {
    const p = state.players[+id];
    if (p && p.club === EXTERNAL && !p.retired) out.push(p);
  }
  return out;
}

export function externalClubName(data: GameData, season: number, id: number): string {
  const row = data.seasons[season][id];
  return row ? data.meta.clubNames[row[6]] : 'Free agent';
}

/** Moves a player and records the transfer. */
export function transfer(state: GameState, data: GameData, player: number, to: number, fee: number, other?: string): TransferRecord {
  const p = state.players[player];
  const from = p.club;
  if (from !== EXTERNAL) {
    const c = state.clubs[from];
    c.squad = c.squad.filter((id) => id !== player);
    c.xi = c.xi.map((id) => (id === player ? -1 : id));
    // A drafted bench keeps its spots: the leaver's spot is left empty.
    c.bench = state.mode === 'draft' && isHuman(state, from) ? c.bench.map((id) => (id === player ? -1 : id)) : c.bench.filter((id) => id !== player);
    c.cash += fee;
  }
  if (to !== EXTERNAL) {
    state.clubs[to].squad.push(player);
    state.clubs[to].cash -= fee;
  }
  p.club = to;
  const t: TransferRecord = { season: state.season, player, from, to, fee, ovr: p.ovr };
  if (from === EXTERNAL) t.other = externalClubName(data, state.season, player);
  if (to === EXTERNAL) t.other = other ?? 'Free agent';
  state.transfers.push(t);
  state.news.push({ kind: 'transfer', t });
  return t;
}

/**
 * The user's own club in draft mode: the 21st club of the league. Its name
 * and colours are registered alongside the 20 real clubs.
 */
export function registerUserClub(data: GameData, info: ClubInfo, slot = REAL_CLUBS): number {
  const at = data.meta.gameClubs.indexOf(info.name);
  const index = at >= 0 && at <= slot ? at : slot;
  data.meta.gameClubs[index] = info.name;
  data.meta.gameClubs.length = slot + 1;
  const existing = CLUBS.findIndex((c) => c.name === info.name);
  if (existing >= 0) CLUBS[existing] = info;
  else CLUBS.push(info);
  return index;
}

/** The era's 20 real clubs come first; a draft club is number 20. */
export const REAL_CLUBS = 20;

export function newGame(
  data: GameData, user: number, seed: number, mode?: 'draft', formation: Formation = '4-3-3', own?: ClubInfo, rules?: GameState['rules'],
  recent?: number[], rival?: { club: ClubInfo; formation: Formation },
): GameState {
  const state: GameState = {
    v: 1,
    seed,
    user,
    season: 0,
    stage: 'window',
    windowPhase: 'open',
    step: 'squad',
    bids: [],
    players: {},
    clubs: [],
    offers: [],
    news: [],
    transfers: [],
    devReport: [],
    result: null,
    history: [],
    income: 0,
  };
  if (mode) state.mode = mode;
  if (rules) state.rules = rules;
  if (recent?.length) state.recent = recent;
  activateEra(data);
  addNewPlayers(state, data);
  data.meta.gameClubs.slice(0, REAL_CLUBS).forEach((name, i) => {
    const info = CLUBS.find((c) => c.name === name)!;
    const squad = data.squads[name].slice();
    for (const id of squad) state.players[id].club = i;
    state.clubs.push({ id: i, rep: info.rep, cash: info.budget * 1000, squad, formation: '4-4-2', xi: [], bench: [] });
  });
  for (const c of state.clubs) applyAutoLineup(state, c.id);
  if (mode === 'draft') {
    const id = registerUserClub(data, own ?? { name: 'Five Seasons FC', short: 'Five Seasons', code: 'FSF', primary: '#1d4f91', secondary: '#ffffff', rep: 72, budget: 0 });
    state.user = id;
    state.clubs.push({ id, rep: own?.rep ?? 72, cash: 0, squad: [], formation, xi: [], bench: [], style: 'tiki' });
    if (rival) {
      // A two-player room: the guest's club is the 22nd.
      const other = registerUserClub(data, rival.club, id + 1);
      state.clubs.push({ id: other, rep: rival.club.rep, cash: 0, squad: [], formation: rival.formation, xi: [], bench: [], style: 'tiki' });
      const view = (): HumanView => ({ draft: null, stage: 'draft', devReport: [] });
      state.mp = { humans: [id, other], views: { [id]: view(), [other]: view() } };
    }
  }
  openWindow(state, data);
  return state;
}

/** Creates state for players whose first data row is this season. */
function addNewPlayers(state: GameState, data: GameData): void {
  const rows = data.seasons[state.season];
  for (const key in rows) {
    const id = +key;
    if (state.players[id]) continue;
    const r = rows[key];
    state.players[id] = { id, ovr: r[0], pot: goatPotential(id, r[1], r[2]), age: r[2], ref: r[0], pos: r[5], club: EXTERNAL, value: 0 };
  }
}

/** Last season's form of every player who played: league, plus cups for the user's. */
function lastForm(state: GameState): Map<number, Form> {
  const sums = new Map<number, { sum: number; apps: number; par: number; club: number }>();
  const clubs = new Map<number, { sum: number; apps: number }>();
  const league = { sum: 0, apps: 0 };
  for (const st of state.result?.stats ?? []) {
    const c = clubs.get(st.club) ?? { sum: 0, apps: 0 };
    c.sum += st.ratingSum;
    c.apps += st.apps;
    clubs.set(st.club, c);
    league.sum += st.ratingSum;
    league.apps += st.apps;
  }
  const h = state.history[state.history.length - 1];
  const cups = h?.byUser ? Object.values(h.byUser).flatMap((u) => u.userCupStats) : h?.userCupStats ?? [];
  for (const st of [...(state.result?.stats ?? []), ...cups]) {
    const t = sums.get(st.id) ?? { sum: 0, apps: 0, par: 0, club: st.club };
    t.sum += st.ratingSum;
    t.par += st.parSum ?? 0;
    t.apps += st.apps;
    sums.set(st.id, t);
  }
  const avg = (x: { sum: number; apps: number } | undefined) => (x && x.apps ? x.sum / x.apps : undefined);
  return new Map([...sums].map(([id, t]) => {
    const quality = t.par / t.apps;
    return [id, { avg: t.sum / t.apps, apps: t.apps, team: avg(clubs.get(t.club)), league: avg(league), quality }];
  }));
}

/** Season rollover for every player: development, retirements, academy. */
function advancePlayers(state: GameState, data: GameData, form: Map<number, Form>): void {
  const rng = stream(state.seed, 'develop', state.season);
  const next = data.seasons[state.season];
  const reports = new Map(humansOf(state).map((h) => [h, [] as DevChange[]]));
  const ids = Object.keys(state.players).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const p = state.players[id];
    if (p.retired) continue;
    const row = next[id];
    const before = p.ovr;
    if (!row && p.club !== EXTERNAL && rng() < retireChance(p.age + 1)) {
      p.retired = true;
      state.news.push({ kind: 'retired', player: id, club: p.club });
      const c = state.clubs[p.club];
      c.squad = c.squad.filter((x) => x !== id);
      p.club = EXTERNAL;
      continue;
    }
    const f = form.get(id);
    const club = p.club === EXTERNAL ? undefined : state.clubs[p.club];
    const area = AREA[parsePositions(p.pos)[0] ?? 'CM'];
    const growth = styleGrowth(club?.style, area, club?.star === id);
    const raw = formBoost(p, f);
    const boost = raw > 0 ? raw * growth : raw;
    developPlayer(p, row, data.meta, rng, f, growth);
    const report = reports.get(p.club);
    if (report) {
      const change: DevChange = { player: id, from: before, to: p.ovr };
      if (f && f.apps >= 8) {
        change.avg = Math.round(f.avg * 100) / 100;
        change.boost = Math.round(boost * 10) / 10;
      }
      report.push(change);
    }
  }
  state.devReport = reports.get(state.user) ?? [];
  for (const [h, list] of reports) if (state.mp) state.mp.views[h].devReport = list;
  addNewPlayers(state, data);
  const youth = data.youth[String(SEASON_YEARS[state.season])] ?? {};
  for (const [name, list] of Object.entries(youth)) {
    const club = data.meta.gameClubs.indexOf(name);
    // Only the two best prospects make the first-team squad.
    const best = list
      .filter((id) => state.players[id]?.club === EXTERNAL)
      .sort((a, b) => state.players[b].pot - state.players[a].pot || a - b)
      .slice(0, MAX_YOUTH);
    for (const id of best) {
      const p = state.players[id];
      p.club = club;
      state.clubs[club].squad.push(id);
      state.news.push({ kind: 'youth', player: id, club });
    }
  }
}

/** Season income: TV money, commercial income by reputation, prize money. */
export function seasonIncome(rep: number, finish: number | null): number {
  const base = 12_000 + Math.max(0, rep - 50) * 2_000;
  const prize = finish ? Math.max(0, 20 - finish) * 1_200 : 0;
  return base + prize;
}

function openWindow(state: GameState, data: GameData): void {
  state.stage = 'window';
  state.windowPhase = 'open';
  state.step = 'squad';
  state.news = [];
  state.offers = [];
  state.bids = [];
  const form = lastForm(state);
  state.result = null;
  if (state.season > 0) {
    advancePlayers(state, data, form);
    const last = state.history[state.history.length - 1];
    state.clubs.forEach((c) => {
      const finish = last.table.findIndex((r) => r.club === c.id) + 1;
      const income = seasonIncome(c.rep, finish) + cupIncome(last, c.id);
      c.cash += income;
      if (c.id === state.user) state.income = income;
    });
  }
  for (const p of Object.values(state.players)) if (!p.retired) refreshValue(state, data, p);
  if (state.mode === 'draft') {
    openDraftWindow(state, data);
    return;
  }
  aiWindow(state, data, 'open');
  if (state.user >= 0) {
    state.offers = generateOffers(state, data);
    state.bids = generateIncomingBids(state, data);
  }
}

/** Moves the user's window on: squad -> offers -> (deadline day) -> bids -> lineup. */
export function nextWindowStep(state: GameState, data: GameData): void {
  if (state.step === 'squad') state.step = 'offers';
  else if (state.step === 'offers') {
    goToDeadline(state, data);
    state.step = 'bids';
  } else closeWindow(state, data);
}

/** The biggest deals of a season, by fee. */
export function topTransfers(state: GameState, season: number, n = 10): TransferRecord[] {
  return state.transfers
    .filter((t) => t.season === season && t.fee > 0)
    .sort((a, b) => b.fee - a.fee || a.player - b.player)
    .slice(0, n);
}

/** Deadline day: the AI clubs' last round of deals. */
export function goToDeadline(state: GameState, data: GameData): void {
  if (state.windowPhase !== 'open') return;
  state.windowPhase = 'deadline';
  aiWindow(state, data, 'deadline');
  for (const o of state.offers) {
    const p = state.players[o.player];
    if (o.status === 'open' && p.club !== EXTERNAL) {
      o.status = 'gone';
      o.goneTo = p.club;
    }
  }
}

export function closeWindow(state: GameState, data: GameData): void {
  if (state.windowPhase === 'open') goToDeadline(state, data);
  for (const c of state.clubs) {
    ensureMinimumSquad(state, data, c.id);
    if (c.id !== state.user) applyAutoLineup(state, c.id);
  }
  if (state.user >= 0) repairLineup(state, state.user);
  state.stage = 'lineup';
}

export function applyAutoLineup(state: GameState, club: number): void {
  const c = state.clubs[club];
  const lu = autoLineup(squadOf(state, club).map(lite), c.formation);
  c.formation = lu.formation;
  c.xi = lu.xi;
  c.bench = lu.bench;
}

/** Switches formation and picks the best players for the new shape. */
export function setFormation(state: GameState, club: number, formation: Formation): void {
  const c = state.clubs[club];
  const players = squadOf(state, club).map(lite);
  c.formation = formation;
  c.xi = pickXI(players, formation);
  c.bench = pickBench(players, c.xi);
}

/**
 * Swaps two players between the starting XI, the bench and the reserves,
 * keeping each slot's position. Swapping two reserves does nothing.
 */
export function swapLineup(state: GameState, club: number, a: number, b: number): void {
  if (a === b) return;
  const c = state.clubs[club];
  const where = (id: number): ['xi' | 'bench' | 'res', number] => {
    const xi = c.xi.indexOf(id);
    if (xi >= 0) return ['xi', xi];
    const bench = c.bench.indexOf(id);
    if (bench >= 0) return ['bench', bench];
    return ['res', -1];
  };
  const [wa, ia] = where(a);
  const [wb, ib] = where(b);
  const put = (w: 'xi' | 'bench' | 'res', i: number, id: number) => {
    if (w === 'xi') c.xi[i] = id;
    else if (w === 'bench') c.bench[i] = id;
  };
  put(wa, ia, b);
  put(wb, ib, a);
}

/** Keeps the user's chosen lineup but fills gaps left by departures. */
export function repairLineup(state: GameState, club: number): void {
  const c = state.clubs[club];
  const inSquad = new Set(c.squad);
  const slots = FORMATIONS[c.formation];
  if (c.xi.length !== slots.length || c.xi.every((id) => !inSquad.has(id))) {
    applyAutoLineup(state, club);
    return;
  }
  const used = new Set<number>();
  c.xi = c.xi.map((id) => {
    if (!inSquad.has(id) || used.has(id)) return -1;
    used.add(id);
    return id;
  });
  c.xi = c.xi.map((id, i) => {
    if (id !== -1) return id;
    const best = squadOf(state, club)
      .filter((p) => !used.has(p.id))
      .map(lite)
      .sort((a, b) => b.ovr * positionFit(b.pos, slots[i]) - a.ovr * positionFit(a.pos, slots[i]))[0];
    if (!best) return -1;
    used.add(best.id);
    return best.id;
  });
  c.bench = c.bench.filter((id) => inSquad.has(id) && !used.has(id));
  const rest = squadOf(state, club)
    .filter((p) => !used.has(p.id) && !c.bench.includes(p.id))
    .sort((a, b) => b.ovr - a.ovr);
  while (c.bench.length < BENCH_SIZE && rest.length) c.bench.push(rest.shift()!.id);
}

export function lineupProblems(state: GameState, club: number): string[] {
  const c = state.clubs[club];
  const problems: string[] = [];
  const inSquad = new Set(c.squad);
  if (c.xi.some((id) => !inSquad.has(id))) problems.push('Fill every position in the starting XI.');
  if (new Set(c.xi).size !== c.xi.length) problems.push('A player is picked twice.');
  if (c.bench.some((id) => c.xi.includes(id))) problems.push('A starter is also on the bench.');
  return problems;
}

/** The season's league fixtures, known before it is played. */
export function seasonFixtures(state: GameState): [number, number][][] {
  return fixtures(state.clubs.map((c) => c.id), stream(state.seed, 'fixtures', state.season));
}

/** The English clubs in each era's first Champions League: the previous season's top four. */
const FIRST_CL: Record<number, string[]> = {
  2010: ['Chelsea', 'Manchester United', 'Arsenal', 'Tottenham Hotspur'],
  2015: ['Chelsea', 'Manchester City', 'Arsenal', 'Manchester United'],
  2020: ['Liverpool', 'Manchester City', 'Manchester United', 'Chelsea'],
};

export function championsLeagueEntrants(state: GameState, data: GameData): number[] {
  const last = state.history[state.history.length - 1];
  if (!last) return FIRST_CL[data.era].map((n) => data.meta.gameClubs.indexOf(n));
  return last.table.slice(0, 4).map((r) => r.club);
}

function addStats(map: Map<number, PlayerSeasonStats>, m: MatchResult, club: number) {
  for (const line of m.lines) {
    if (line.club !== club) continue;
    let s = map.get(line.id);
    if (!s) {
      s = { id: line.id, club, apps: 0, starts: 0, goals: 0, assists: 0, ratingSum: 0 };
      map.set(line.id, s);
    }
    s.apps++;
    if (line.started) s.starts++;
    s.goals += line.goals;
    s.assists += line.assists;
    s.ratingSum += line.rating;
    s.parSum = (s.parSum ?? 0) + line.par;
  }
}

export interface PaperRow {
  club: number;
  /** average rating of the XI in its positions */
  rating: number;
  /** expected goal difference per match against the rest of the league */
  edge: number;
}

/**
 * A player as the match engine sees him. The user's drafted players keep the
 * position they were drafted for, even when their listed positions change.
 */
function engineLite(state: GameState, club: number, id: number, slot?: Position): PlayerLite {
  const p = lite(state.players[id]);
  if (state.mode !== 'draft' || !isHuman(state, club)) return p;
  const home = draftOf(state, club)?.home?.[id] ?? slot;
  return home ? { ...p, pos: [home, ...p.pos] } : p;
}

/** The league ranked on paper: each XI's strength against everyone else's. */
export function paperTable(state: GameState): PaperRow[] {
  const teams = state.clubs.map((c) => {
    // AI clubs are judged on the XI they would pick from their squad today.
    const lineup = isHuman(state, c.id) ? c : autoLineup(squadOf(state, c.id).map(lite), c.formation);
    const slots = FORMATIONS[lineup.formation];
    const eff = lineup.xi.map((id, i) => {
      if (!state.players[id]) return 0;
      const p = engineLite(state, c.id, id, slots[i]);
      return p.ovr * positionFit(p.pos, slots[i]);
    });
    return { club: c.id, rating: eff.reduce((a, b) => a + b, 0) / eff.length, strength: teamStrength(slots, eff) };
  });
  return teams
    .map((t) => {
      let edge = 0;
      for (const o of teams) {
        if (o === t) continue;
        const [f, a] = expectedGoals(t.strength, o.strength, 0, 0, true);
        edge += f - a;
      }
      return { club: t.club, rating: Math.round(t.rating * 10) / 10, edge: edge / (teams.length - 1) };
    })
    .sort((a, b) => b.edge - a.edge || a.club - b.club);
}

export function simulate(state: GameState, data: GameData): void {
  for (const c of state.clubs) if (lineupProblems(state, c.id).length) repairLineup(state, c.id);
  const paper = state.user >= 0 ? paperTable(state) : [];
  const predictedOf = (club: number) => paper.findIndex((r) => r.club === club) + 1;
  const predicted = state.user >= 0 ? predictedOf(state.user) : undefined;
  const teams = state.clubs.map((c) => {
    const slots = FORMATIONS[c.formation];
    const xi = c.xi.map((id, i) => engineLite(state, c.id, id, slots[i]));
    const bench = c.bench.filter((id) => id >= 0).map((id) => engineLite(state, c.id, id));
    // The drafted club rotates its small squad, so the bench plays its part.
    const rotation = state.mode === 'draft' && isHuman(state, c.id) ? DRAFT_ROTATION : undefined;
    // The star of a style built around him: the best attacking starter.
    if (c.style) {
      const lean = (i: number) => ({ ATT: 3, MID: ['CAM', 'LM', 'RM'].includes(slots[i]) ? 1 : -3, DEF: -10, GK: -99 })[AREA[slots[i]]];
      const order = c.xi.map((id, i) => ({ id, key: id >= 0 ? state.players[id].ovr + lean(i) : -999 })).sort((a, b) => b.key - a.key || a.id - b.id);
      c.star = order[0]?.id;
    }
    return { club: c.id, formation: c.formation, xi, bench, rotation, style: c.style, star: c.star };
  });
  const league = simulateSeason(teams, stream(state.seed, 'season', state.season), seasonFixtures(state));

  const year = String(SEASON_YEARS[state.season]);
  const opponents = data.teams[year];
  const gameClubs = new Set(data.meta.gameClubs);
  const english = opponents.english.filter((t) => !gameClubs.has(t[0]));
  const ratings: Record<string, number> = {};
  for (const [name, , r] of english) ratings[name] = r;
  for (const [name, , r] of opponents.europe) ratings[name] = r;
  const cupStatsBy = new Map(humansOf(state).map((h) => [h, new Map<number, PlayerSeasonStats>()]));
  const ctx = (tag: string) => ({
    team: (club: number) => ({ ...teams[club], slots: FORMATIONS[teams[club].formation] }),
    ratings,
    rng: stream(state.seed, tag, state.season),
    onMatch: (m: MatchResult) => {
      for (const [h, map] of cupStatsBy) addStats(map, m, h);
    },
  });
  const fa = simulateFaCup(ctx('fa'), state.clubs.map((c) => c.id), english);
  const cl = simulateChampionsLeague(ctx('cl'), championsLeagueEntrants(state, data), opponents.europe);

  const cupList = (h: number) => [...(cupStatsBy.get(h)?.values() ?? [])];
  const result: SeasonPlay = { ...league, fa, cl, cupStats: cupList(state.user) };
  if (state.mp) result.cupStatsByClub = Object.fromEntries(state.mp.humans.map((h) => [h, cupList(h)]));
  state.result = result;
  const top = (key: 'goals' | 'assists') =>
    league.stats
      .slice()
      .sort((a, b) => b[key] - a[key] || a.apps - b.apps)
      .slice(0, 20)
      .map((s) => [s.id, s.club, s[key]] as [number, number, number]);
  state.history.push({
    season: state.season,
    table: league.table,
    faWinner: fa.winner,
    clWinner: cl.winner,
    faReached: fa.reached,
    clReached: cl.reached,
    topScorers: top('goals'),
    topAssists: top('assists'),
    userStats: league.stats.filter((s) => s.club === state.user),
    userCupStats: result.cupStats,
    repBefore: state.user >= 0 ? state.clubs[state.user].rep : 0,
    predicted,
  });
  for (const v of Object.values(state.mp?.views ?? {})) Object.assign(v, { stage: 'results', ready: false, done: false });
  // Awards and each manager's story of the season.
  const h = state.history[state.history.length - 1];
  h.ballon = ballonDor(state, data, league, fa, cl);
  const told = (club: number) => {
    const stats = mergeStats(league.stats.filter((s) => s.club === club), cupList(club));
    const pots = playerOfSeason(stats);
    const story = seasonStory({ state, data, club, league, fa, cl, stats, predicted: predictedOf(club), pots, ballon: h.ballon!, rival: state.mp?.humans.find((x) => x !== club) });
    const ratings = state.clubs[club].squad.map((id) => [id, state.players[id].ovr] as [number, number]);
    return { pots, story, ratings };
  };
  if (state.user >= 0) Object.assign(h, told(state.user));
  if (state.mp) {
    const [a, b] = state.mp.humans;
    const pair = (x: unknown, y: unknown) => (x === a && y === b) || (x === b && y === a);
    const h2h: HeadToHead[] = [];
    let k = 0;
    league.rounds.forEach((round, ri) => round.forEach(([home, away, hg, ag]) => {
      if (pair(home, away)) h2h.push({ comp: `League · Matchday ${ri + 1}`, slot: ri + 1, home, away, hg, ag, goals: league.scorers[k] });
      k++;
    }));
    for (const [comp, cup] of [['FA Cup', fa], ['Champions League', cl]] as const) {
      for (const m of cup.matches) {
        if (pair(m.home, m.away)) h2h.push({ comp: `${comp} · ${m.round}`, slot: m.slot, home: m.home as number, away: m.away as number, hg: m.hg, ag: m.ag, pens: m.pens, goals: m.scorers });
      }
    }
    state.history[state.history.length - 1].h2h = h2h.sort((x, y) => x.slot - y.slot);
    state.history[state.history.length - 1].byUser = Object.fromEntries(state.mp.humans.map((h) => [h, {
      userStats: league.stats.filter((s) => s.club === h),
      userCupStats: cupList(h),
      repBefore: state.clubs[h].rep,
      predicted: predictedOf(h),
      ...told(h),
    }]));
  }
  state.stage = 'results';
}

/** Trophies a club won in a season. */
export function trophiesOf(h: SeasonHistory, club: number): ('league' | 'fa' | 'cl')[] {
  const out: ('league' | 'fa' | 'cl')[] = [];
  if (h.table[0].club === club) out.push('league');
  if (h.faWinner === club) out.push('fa');
  if (h.clWinner === club) out.push('cl');
  return out;
}

/** Prize money for cup runs, €k. */
export function cupIncome(h: SeasonHistory, club: number): number {
  let k = 0;
  const cl = h.clReached[club];
  if (cl) k += 15_000 + Math.max(0, CL_ROUNDS.indexOf(cl === WINNER ? 'Final' : cl)) * 8_000 + (cl === WINNER ? 15_000 : 0);
  const fa = h.faReached[club];
  if (fa) k += Math.max(0, FA_ROUNDS.indexOf(fa === WINNER ? 'Final' : fa)) * 600 + (fa === WINNER ? 4_000 : 0);
  return k;
}

/** Reputation moves with the finish compared to what the club's standing predicts. */
export function updateReputation(state: GameState): void {
  const table = state.history[state.history.length - 1].table;
  const byRep = state.clubs.slice().sort((a, b) => b.rep - a.rep || a.id - b.id);
  for (const c of state.clubs) {
    const expected = byRep.indexOf(c) + 1;
    const actual = table.findIndex((r) => r.club === c.id) + 1;
    let delta = Math.max(-5, Math.min(5, (expected - actual) * 0.6));
    if (actual === 1) delta += 2;
    if (actual <= 4) delta += 1;
    if (actual >= 18) delta -= 1;
    const h = state.history[state.history.length - 1];
    const cl = h.clReached[c.id];
    if (cl === WINNER) delta += 4;
    else if (cl === 'Final') delta += 2;
    else if (cl === 'Semi-final') delta += 1;
    if (h.faWinner === c.id) delta += 1;
    c.rep = Math.round(Math.max(40, Math.min(97, c.rep + delta)) * 10) / 10;
  }
}

export function endSeason(state: GameState, data: GameData): void {
  updateReputation(state);
  const h = state.history[state.history.length - 1];
  if (state.user >= 0) h.repAfter = state.clubs[state.user].rep;
  for (const [club, u] of Object.entries(h.byUser ?? {})) u.repAfter = state.clubs[+club].rep;
  if (state.season >= NUM_SEASONS - 1) {
    state.stage = 'summary';
    for (const v of Object.values(state.mp?.views ?? {})) Object.assign(v, { stage: 'summary', done: false });
    state.result = null;
    return;
  }
  state.season++;
  openWindow(state, data);
}

/** Runs a whole season with no user input (used by tests and the AI). */
export function autoSeason(state: GameState, data: GameData): void {
  closeWindow(state, data);
  simulate(state, data);
  endSeason(state, data);
}
