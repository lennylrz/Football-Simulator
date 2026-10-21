// Draft mode: the user builds an XI and a small bench by picking one of five
// real players for each spot, and each summer may gamble on re-drafting a few
// (two by default) and move players between the bench and the XI.
import { aiWindow, ensureMinimumSquad } from './ai';
import type { GameData } from './data';
import {
  applyAutoLineup, type DevChange, EXTERNAL, type GameState, goToDeadline, type PlayerState, simulate, transfer,
} from './game';
import { FORMATIONS, type Position, parsePositions } from './positions';
import { type Rng, shuffle, stream } from './rng';

export const CANDIDATES = 5;
export const REDRAFTS_PER_SUMMER = 2;
/** Substitutes the user drafts, unless the rules say otherwise. */
export const BENCH = 3;

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
  /** XI slots still to fill in the opening draft, in the suggested order */
  queue: number[];
  /** slot being picked now, or null */
  slot: number | null;
  candidates: number[];
  /** opening draft: candidates already drawn per slot, so switching positions never re-rolls them */
  offers?: Record<number, number[]>;
  /** every player offered this career */
  shown?: number[];
  redraftsLeft: number;
  /** slots re-drafted this summer: each position can be re-drafted once */
  redrafted?: number[];
  picks: DraftPick[];
  /** summer reveal for the XI and bench: rating before and after, and last season's form */
  reveal: DevChange[];
  /** the position each player was drafted to play; he keeps it wherever he is moved */
  home?: Record<number, Position>;
}

/** Draft spots: 0-10 are the XI's positions, 11 and up the bench. */
export const XI = 11;
export const isBench = (spot: number) => spot >= XI;

export function benchSize(state: GameState): number {
  return state.rules?.bench ?? BENCH;
}

/** The player in a spot of the XI or bench, or -1. */
export function inSpot(state: GameState, spot: number): number {
  const club = state.clubs[state.user];
  return (isBench(spot) ? club.bench[spot - XI] : club.xi[spot]) ?? -1;
}

function setSpot(state: GameState, spot: number, player: number): void {
  const club = state.clubs[state.user];
  if (isBench(spot)) club.bench[spot - XI] = player;
  else club.xi[spot] = player;
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

/** Positions that are the same job on the pitch. */
const SAME: Partial<Record<Position, Position[]>> = {
  ST: ['CF'], CF: ['ST'], LB: ['LWB'], LWB: ['LB'], RB: ['RWB'], RWB: ['RB'], LW: ['LM'], LM: ['LW'], RW: ['RM'], RM: ['RW'],
};

/** Candidates are offered only in their main position, so a left-back is a real left-back. */
export function fits(p: Pick<PlayerState, 'pos'>, slot: Position): boolean {
  const main = parsePositions(p.pos)[0];
  return main === slot || !!SAME[slot]?.includes(main);
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
  // Players seen in recent careers come up only when there is nobody else of their kind.
  const recent = new Set(state.recent ?? []);
  const take = (filter: (p: PlayerState) => boolean, n: number) => {
    const all = pool.filter((p) => filter(p) && !chosen.includes(p));
    const fresh = all.filter((p) => !recent.has(p.id));
    const options = shuffle(rng, fresh.length >= n ? fresh : all);
    chosen.push(...options.slice(0, n));
  };
  if (rng() < 0.45) take((p) => p.ovr >= 84, 1);
  take((p) => p.ovr >= 79 && p.ovr <= 83, rng() < 0.5 ? 1 : 2);
  take((p) => p.age <= 21 && p.pot >= 80 && p.ovr <= 77, rng() < 0.5 ? 1 : 2);
  take((p) => p.ovr >= 70 && p.ovr <= 79, CANDIDATES - chosen.length);
  take(() => true, CANDIDATES - chosen.length);
  return shuffle(rng, chosen).slice(0, choicesOf(state)).map((p) => p.id);
}

/**
 * Substitutes: any outfield position, mostly youngsters who may grow into
 * starters, with an experienced squad player or two.
 */
export function drawBenchCandidates(state: GameState, data: GameData, rng: Rng): number[] {
  const taken = new Set(state.clubs[state.user].squad);
  const rows = data.seasons[state.season];
  const recent = new Set(state.recent ?? []);
  const pool: PlayerState[] = [];
  for (const key in rows) {
    const p = state.players[+key];
    if (!p || p.retired || taken.has(p.id) || p.age > 33 || p.ovr < 62 || parsePositions(p.pos)[0] === 'GK') continue;
    pool.push(p);
  }
  const chosen: PlayerState[] = [];
  const take = (filter: (p: PlayerState) => boolean, n: number) => {
    const all = pool.filter((p) => filter(p) && !chosen.includes(p));
    const fresh = all.filter((p) => !recent.has(p.id));
    chosen.push(...shuffle(rng, fresh.length >= n ? fresh : all).slice(0, n));
  };
  take((p) => p.age <= 20 && p.pot >= 84, 1);
  take((p) => p.age <= 22 && p.pot >= 80 && p.ovr <= 76, 2);
  take((p) => p.age >= 24 && p.ovr >= 74 && p.ovr <= 80, 1);
  take((p) => p.ovr >= 70 && p.ovr <= 78, CANDIDATES - chosen.length);
  return shuffle(rng, chosen).slice(0, choicesOf(state)).map((p) => p.id);
}

function draw(state: GameState, data: GameData, slot: number): void {
  const d = state.draft!;
  d.slot = slot;
  const taken = new Set(state.clubs[state.user].squad);
  const kept = state.stage === 'draft' ? d.offers?.[slot]?.filter((id) => !taken.has(id)) : undefined;
  if (kept && kept.length) {
    d.candidates = kept;
    return;
  }
  const rng = stream(state.seed, 'draft', state.season, slot, d.picks.length);
  d.candidates = isBench(slot) ? drawBenchCandidates(state, data, rng) : drawCandidates(state, data, slotsOf(state)[slot], rng);
  if (state.stage === 'draft') (d.offers ??= {})[slot] = d.candidates;
  d.shown = [...(d.shown ?? []), ...d.candidates];
}

/** Opening draft: switch to another position still to fill. */
export function chooseSlot(state: GameState, data: GameData, slot: number): string | null {
  const d = state.draft;
  if (!d || state.stage !== 'draft' || !d.queue.includes(slot)) return 'That position is already filled.';
  if (d.slot !== slot) draw(state, data, slot);
  return null;
}

function nextPick(state: GameState, data: GameData): void {
  const d = state.draft!;
  const slot = d.queue[0];
  if (slot === undefined) {
    d.slot = null;
    d.candidates = [];
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
    club.bench = Array.from({ length: benchSize(state) }, () => -1);
    aiWindow(state, data, 'open');
    const queue = [...pickOrder(slotsOf(state)), ...club.bench.map((_, j) => XI + j)];
    state.draft = { queue, slot: null, candidates: [], offers: {}, shown: [], redraftsLeft: 0, redrafted: [], picks: [], reveal: [], home: {} };
    state.stage = 'draft';
    nextPick(state, data);
    return;
  }
  aiWindow(state, data, 'open');
  const d = state.draft!;
  const report = new Map(state.devReport.map((r) => [r.player, r]));
  // Players who retired leave an empty slot.
  club.xi = club.xi.map((id) => (club.squad.includes(id) ? id : -1));
  club.bench = club.bench.map((id) => (club.squad.includes(id) ? id : -1));
  d.reveal = [...club.xi, ...club.bench].filter((id) => id >= 0).map((id) => report.get(id) ?? { player: id, from: state.players[id].ovr, to: state.players[id].ovr });
  d.redraftsLeft = redraftsPerSummer(state);
  d.redrafted = [];
  d.offers = {};
  d.slot = null;
  d.candidates = [];
  d.queue = [];
  state.stage = 'summer';
}

export function pickCandidate(state: GameState, data: GameData, player: number): string | null {
  const d = state.draft;
  if (!d || d.slot === null || !d.candidates.includes(player)) return 'That player is not on offer.';
  const club = state.clubs[state.user];
  const p = state.players[player];
  transfer(state, data, player, state.user, 0);
  club.cash = Math.max(club.cash, 0);
  setSpot(state, d.slot, player);
  (d.home ??= {})[player] = isBench(d.slot) ? parsePositions(p.pos)[0] : slotsOf(state)[d.slot];
  d.picks.push({ season: state.season, slot: d.slot, player, ovr: p.ovr });
  if (state.stage === 'draft') {
    const done = d.slot;
    d.queue = d.queue.filter((s) => s !== done);
    nextPick(state, data);
  }
  else {
    d.slot = null;
    d.candidates = [];
  }
  return null;
}

/** Summer gamble: lose the player in a slot and pick from new candidates. */
export function startRedraft(state: GameState, data: GameData, slot: number): string | null {
  const d = state.draft;
  if (!d || state.stage !== 'summer' || d.slot !== null) return 'Not now.';
  const current = inSpot(state, slot);
  if (d.redrafted?.includes(slot)) return 'You have already re-drafted this position this summer.';
  if (current >= 0) {
    if (d.redraftsLeft <= 0) return 'No re-drafts left this summer.';
    d.redraftsLeft--;
    const pick = [...d.picks].reverse().find((x) => x.player === current && x.leftOvr === undefined);
    if (pick) pick.leftOvr = state.players[current].ovr;
    transfer(state, data, current, EXTERNAL, 0, 'Released');
    setSpot(state, slot, -1);
  }
  (d.redrafted ??= []).push(slot);
  draw(state, data, slot);
  return null;
}

export function emptySlots(state: GameState): number[] {
  const club = state.clubs[state.user];
  return [...club.xi, ...club.bench].flatMap((id, i) => (id < 0 ? [i < club.xi.length ? i : XI + i - club.xi.length] : []));
}

/** Summer: swaps a starter and a substitute (or two starters). Free, and no re-draft is used. */
export function swapSpots(state: GameState, a: number, b: number): string | null {
  const d = state.draft;
  if (!d || state.stage !== 'summer' || d.slot !== null) return 'Not now.';
  if (a === b || (isBench(a) && isBench(b))) return 'Pick a starter and a substitute.';
  const pa = inSpot(state, a);
  const pb = inSpot(state, b);
  setSpot(state, a, pb);
  setSpot(state, b, pa);
  return null;
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
  simulate(state, data);
  return null;
}

/** For tests: picks the highest-rated candidate every time. */
export function autoDraft(state: GameState, data: GameData, choose = (ids: number[]) => ids.reduce((a, b) => (state.players[b].ovr > state.players[a].ovr ? b : a))): void {
  while (state.draft?.slot !== null && state.draft?.slot !== undefined) pickCandidate(state, data, choose(state.draft.candidates));
}
