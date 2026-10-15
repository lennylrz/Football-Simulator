// Game state and the season flow: transfer window -> lineup -> simulation.
import { aiWindow, ensureMinimumSquad } from './ai';
import { CLUBS } from './clubs';
import {
  CL_ROUNDS, type CupResult, type Entrant, FA_ROUNDS, simulateChampionsLeague, simulateFaCup, WINNER,
} from './cups';
import { type GameData, NUM_SEASONS, SEASON_YEARS } from './data';
import { developPlayer, retireChance } from './development';
import { autoLineup, BENCH_SIZE, pickBench, pickXI, type PlayerLite } from './lineup';
import { generateIncomingBids, generateOffers, type IncomingBid, type Offer } from './market';
import { FORMATIONS, type Formation, parsePositions, positionFit } from './positions';
import { stream } from './rng';
import { fixtures, type PlayerSeasonStats, type SeasonResult, simulateSeason, type TableRow } from './season';
import type { MatchResult } from './match';
import { marketValue } from './valuation';

export const MAX_SQUAD = 26;
export const MIN_SQUAD = 16;
/** Academy graduates promoted per club per season. */
const MAX_YOUTH = 2;
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
}

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
}

export interface DevChange {
  player: number;
  from: number;
  to: number;
}

export type Stage = 'window' | 'lineup' | 'results' | 'summary';
export type WindowStep = 'squad' | 'offers' | 'bids';

export interface GameState {
  v: 1;
  seed: number;
  /** user's club index, or -1 when every club is run by the AI (tests) */
  user: number;
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
}

export function seasonLabel(season: number): string {
  const y = SEASON_YEARS[season];
  return `${y}/${String(y + 1).slice(2)}`;
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
    c.bench = c.bench.filter((id) => id !== player);
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

export function newGame(data: GameData, user: number, seed: number): GameState {
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
  addNewPlayers(state, data);
  data.meta.gameClubs.forEach((name, i) => {
    const info = CLUBS.find((c) => c.name === name)!;
    const squad = data.squads[name].slice();
    for (const id of squad) state.players[id].club = i;
    state.clubs.push({ id: i, rep: info.rep, cash: info.budget * 1000, squad, formation: '4-4-2', xi: [], bench: [] });
  });
  for (const c of state.clubs) applyAutoLineup(state, c.id);
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
    state.players[id] = { id, ovr: r[0], pot: r[1], age: r[2], ref: r[0], pos: r[5], club: EXTERNAL, value: 0 };
  }
}

/** Season rollover for every player: development, retirements, academy. */
function advancePlayers(state: GameState, data: GameData): void {
  const rng = stream(state.seed, 'develop', state.season);
  const next = data.seasons[state.season];
  state.devReport = [];
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
    developPlayer(p, row, data.meta, rng);
    if (p.club === state.user) state.devReport.push({ player: id, from: before, to: p.ovr });
  }
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
  const prize = finish ? (20 - finish) * 1_200 : 0;
  return base + prize;
}

function openWindow(state: GameState, data: GameData): void {
  state.stage = 'window';
  state.windowPhase = 'open';
  state.step = 'squad';
  state.news = [];
  state.offers = [];
  state.bids = [];
  state.result = null;
  if (state.season > 0) {
    advancePlayers(state, data);
    const last = state.history[state.history.length - 1];
    state.clubs.forEach((c) => {
      const finish = last.table.findIndex((r) => r.club === c.id) + 1;
      const income = seasonIncome(c.rep, finish) + cupIncome(last, c.id);
      c.cash += income;
      if (c.id === state.user) state.income = income;
    });
  }
  for (const p of Object.values(state.players)) if (!p.retired) refreshValue(state, data, p);
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

/** The four clubs that entered the Champions League in 2015/16 (2014/15 top four). */
const CL_2015 = ['Chelsea', 'Manchester City', 'Arsenal', 'Manchester United'];

export function championsLeagueEntrants(state: GameState, data: GameData): number[] {
  const last = state.history[state.history.length - 1];
  if (!last) return CL_2015.map((n) => data.meta.gameClubs.indexOf(n));
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
  }
}

export function simulate(state: GameState, data: GameData): void {
  for (const c of state.clubs) if (lineupProblems(state, c.id).length) repairLineup(state, c.id);
  const teams = state.clubs.map((c) => {
    const byId = (id: number) => lite(state.players[id]);
    return { club: c.id, formation: c.formation, xi: c.xi.map(byId), bench: c.bench.map(byId) };
  });
  const league = simulateSeason(teams, stream(state.seed, 'season', state.season), seasonFixtures(state));

  const year = String(SEASON_YEARS[state.season]);
  const opponents = data.teams[year];
  const gameClubs = new Set(data.meta.gameClubs);
  const english = opponents.english.filter((t) => !gameClubs.has(t[0]));
  const ratings: Record<string, number> = {};
  for (const [name, , r] of english) ratings[name] = r;
  for (const [name, , r] of opponents.europe) ratings[name] = r;
  const cupStats = new Map<number, PlayerSeasonStats>();
  const ctx = (tag: string) => ({
    team: (club: number) => ({ club, slots: FORMATIONS[teams[club].formation], xi: teams[club].xi, bench: teams[club].bench }),
    ratings,
    rng: stream(state.seed, tag, state.season),
    onMatch: (m: MatchResult) => addStats(cupStats, m, state.user),
  });
  const fa = simulateFaCup(ctx('fa'), state.clubs.map((c) => c.id), english);
  const cl = simulateChampionsLeague(ctx('cl'), championsLeagueEntrants(state, data), opponents.europe);

  const result: SeasonPlay = { ...league, fa, cl, cupStats: [...cupStats.values()] };
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
  });
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
  if (state.season >= NUM_SEASONS - 1) {
    state.stage = 'summary';
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
