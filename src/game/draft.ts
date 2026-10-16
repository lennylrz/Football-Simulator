// Draft mode: the user builds an XI by picking one of five real players for
// each position, and each summer may gamble on re-drafting a few (two by default).
import { aiWindow, ensureMinimumSquad } from './ai';
import type { GameData } from './data';
import {
  applyAutoLineup, EXTERNAL, type GameState, goToDeadline, marketPool, type PlayerState, simulate, transfer,
} from './game';
import { AREA, FORMATIONS, type Position, parsePositions, positionFit } from './positions';
import { type Rng, shuffle, stream } from './rng';

export const CANDIDATES = 5;
export const REDRAFTS_PER_SUMMER = 2;
export const BENCH = 5;

export interface DraftPick {
  season: number;
  slot: number;
  player: number;
  /** rating when picked */
  ovr: number;
  /** rating when he left the XI, if he did */
  leftOvr?: number;
}

export interface DraftState {
  /** XI slots still to fill in the opening draft, in pick order */
  queue: number[];
  /** slot being picked now, or null */
  slot: number | null;
  candidates: number[];
  redraftsLeft: number;
  picks: DraftPick[];
  /** summer reveal for the XI: rating before and after */
  reveal: { player: number; from: number; to: number }[];
}

export function redraftsPerSummer(state: GameState): number {
  return state.rules?.redrafts ?? REDRAFTS_PER_SUMMER;
}

function choicesOf(state: GameState): number {
  return Math.max(1, Math.min(CANDIDATES, state.rules?.choices ?? CANDIDATES));
}

const PICK_ORDER: Position[] = ['ST', 'CF', 'LW', 'RW', 'CAM', 'LM', 'RM', 'CM', 'CDM', 'CB', 'LWB', 'RWB', 'LB', 'RB', 'GK'];

/** Strikers first, then wide forwards, midfield, defence and the goalkeeper last. */
export function pickOrder(slots: Position[]): number[] {
  return slots.map((_, i) => i).sort((a, b) => PICK_ORDER.indexOf(slots[a]) - PICK_ORDER.indexOf(slots[b]) || a - b);
}

function slotsOf(state: GameState): Position[] {
  return FORMATIONS[state.clubs[state.user].formation];
}

/** Candidates play the slot's position naturally, so there is no hidden penalty. */
function fits(p: PlayerState, slot: Position): boolean {
  return positionFit(parsePositions(p.pos), slot) >= 1;
}

/**
 * Candidates for a slot (five unless the rules say fewer), mixed so the choice is hard: a star only
 * sometimes, a couple of established players, a couple of youngsters with a
 * future, and the rest ordinary.
 */
export function drawCandidates(state: GameState, data: GameData, slot: Position, rng: Rng): number[] {
  const taken = new Set(state.clubs[state.user].squad);
  const rows = data.seasons[state.season];
  const pool: PlayerState[] = [];
  for (const key in rows) {
    const p = state.players[+key];
    if (!p || p.retired || taken.has(p.id) || p.age > 35 || p.ovr < 64 || !fits(p, slot)) continue;
    pool.push(p);
  }
  const chosen: PlayerState[] = [];
  const take = (filter: (p: PlayerState) => boolean, n: number) => {
    const options = shuffle(rng, pool.filter((p) => filter(p) && !chosen.includes(p)));
    chosen.push(...options.slice(0, n));
  };
  if (rng() < 0.55) take((p) => p.ovr >= 84, 1);
  take((p) => p.ovr >= 79 && p.ovr <= 83, rng() < 0.5 ? 1 : 2);
  take((p) => p.age <= 21 && p.pot >= 80 && p.ovr <= 77, rng() < 0.5 ? 1 : 2);
  take((p) => p.ovr >= 70 && p.ovr <= 79, CANDIDATES - chosen.length);
  take(() => true, CANDIDATES - chosen.length);
  return shuffle(rng, chosen).slice(0, choicesOf(state)).map((p) => p.id);
}

function draw(state: GameState, data: GameData, slot: number): void {
  const d = state.draft!;
  d.slot = slot;
  const rng = stream(state.seed, 'draft', state.season, slot, d.picks.length);
  d.candidates = drawCandidates(state, data, slotsOf(state)[slot], rng);
}

function nextPick(state: GameState, data: GameData): void {
  const d = state.draft!;
  const slot = d.queue.shift();
  if (slot === undefined) {
    d.slot = null;
    d.candidates = [];
    fillBench(state, data);
    state.stage = 'summer';
    return;
  }
  draw(state, data, slot);
}

/** Called from openWindow in draft mode, instead of the transfer window. */
export function openDraftWindow(state: GameState, data: GameData): void {
  const club = state.clubs[state.user];
  if (state.season === 0) {
    // The club's real squad leaves; those players can turn up in later draws.
    for (const id of club.squad) state.players[id].club = EXTERNAL;
    club.squad = [];
    club.xi = slotsOf(state).map(() => -1);
    club.bench = [];
    aiWindow(state, data, 'open');
    state.draft = { queue: pickOrder(slotsOf(state)), slot: null, candidates: [], redraftsLeft: 0, picks: [], reveal: [] };
    state.stage = 'draft';
    nextPick(state, data);
    return;
  }
  aiWindow(state, data, 'open');
  const d = state.draft!;
  const before = new Map(state.devReport.map((r) => [r.player, r.from]));
  // Players who retired leave an empty slot.
  club.xi = club.xi.map((id) => (club.squad.includes(id) ? id : -1));
  d.reveal = club.xi.filter((id) => id >= 0).map((id) => ({ player: id, from: before.get(id) ?? state.players[id].ovr, to: state.players[id].ovr }));
  d.redraftsLeft = redraftsPerSummer(state);
  d.slot = null;
  d.candidates = [];
  d.queue = [];
  fillBench(state, data);
  state.stage = 'summer';
}

export function pickCandidate(state: GameState, data: GameData, player: number): string | null {
  const d = state.draft;
  if (!d || d.slot === null || !d.candidates.includes(player)) return 'That player is not on offer.';
  const club = state.clubs[state.user];
  const p = state.players[player];
  transfer(state, data, player, state.user, 0);
  club.cash = Math.max(club.cash, 0);
  club.xi[d.slot] = player;
  club.bench = club.bench.filter((id) => id !== player);
  d.picks.push({ season: state.season, slot: d.slot, player, ovr: p.ovr });
  if (state.stage === 'draft') nextPick(state, data);
  else {
    d.slot = null;
    d.candidates = [];
  }
  return null;
}

/** Summer gamble: lose the player in a slot and pick from new candidates. */
export function startRedraft(state: GameState, data: GameData, slot: number): string | null {
  const d = state.draft;
  const club = state.clubs[state.user];
  if (!d || state.stage !== 'summer' || d.slot !== null) return 'Not now.';
  const current = club.xi[slot];
  if (current >= 0) {
    if (d.redraftsLeft <= 0) return 'No re-drafts left this summer.';
    d.redraftsLeft--;
    const pick = [...d.picks].reverse().find((x) => x.player === current && x.leftOvr === undefined);
    if (pick) pick.leftOvr = state.players[current].ovr;
    transfer(state, data, current, EXTERNAL, 0, 'Released');
    club.xi[slot] = -1;
  }
  draw(state, data, slot);
  return null;
}

export function emptySlots(state: GameState): number[] {
  return state.clubs[state.user].xi.flatMap((id, i) => (id < 0 ? [i] : []));
}

/** Tops the bench up to five squad players: a keeper and cover across the pitch. */
function fillBench(state: GameState, data: GameData): void {
  const club = state.clubs[state.user];
  const inXI = new Set(club.xi);
  club.bench = club.squad.filter((id) => !inXI.has(id));
  const rng = stream(state.seed, 'bench', state.season);
  const pool = shuffle(rng, marketPool(state, data).filter((p) => p.ovr >= 68 && p.ovr <= 74 && p.age >= 20 && p.age <= 31));
  const need: ('GK' | 'DEF' | 'MID' | 'ATT')[] = ['GK', 'DEF', 'MID', 'ATT', 'DEF'];
  for (const area of need) {
    if (club.bench.length >= BENCH) break;
    const has = club.bench.some((id) => AREA[parsePositions(state.players[id].pos)[0]] === area);
    if (has && area !== 'DEF') continue;
    const p = pool.find((q) => q.club === EXTERNAL && AREA[parsePositions(q.pos)[0]] === area);
    if (!p) continue;
    transfer(state, data, p.id, state.user, 0);
    club.bench.push(p.id);
  }
  while (club.bench.length < BENCH) {
    const p = pool.find((q) => q.club === EXTERNAL);
    if (!p) break;
    transfer(state, data, p.id, state.user, 0);
    club.bench.push(p.id);
  }
  club.bench = club.bench.slice(0, BENCH);
}

/** Deadline day for the AI, then the season is played. */
export function playDraftSeason(state: GameState, data: GameData): string | null {
  if (emptySlots(state).length) return 'Fill every position first.';
  goToDeadline(state, data);
  for (const c of state.clubs) {
    if (c.id === state.user) continue;
    ensureMinimumSquad(state, data, c.id);
    applyAutoLineup(state, c.id);
  }
  fillBench(state, data);
  simulate(state, data);
  return null;
}

/** For tests: picks the highest-rated candidate every time. */
export function autoDraft(state: GameState, data: GameData, choose = (ids: number[]) => ids.reduce((a, b) => (state.players[b].ovr > state.players[a].ovr ? b : a))): void {
  while (state.draft?.slot !== null && state.draft?.slot !== undefined) pickCandidate(state, data, choose(state.draft.candidates));
}
