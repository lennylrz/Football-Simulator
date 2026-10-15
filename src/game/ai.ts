// Transfer behaviour of the clubs the user does not manage. They don't copy
// real-life transfers: each window they patch their weakest position from
// the market (or a smaller rival), within budget and within what their
// reputation can attract, and sell surplus players.
import { BIG_SIX, capacity } from './clubs';
import type { GameData } from './data';
import {
  type ClubState, EXTERNAL, type GameState, MAX_SQUAD, MIN_SQUAD, lite, marketPool, type PlayerState, squadOf, transfer,
} from './game';
import { pickXI } from './lineup';
import { AREA, FORMATIONS, parsePositions, type Position, positionFit } from './positions';
import { type Rng, normal, shuffle, stream } from './rng';
import { roundFee } from './valuation';

/** AI clubs keep their squads at or below this size. */
const AI_SQUAD_TARGET = 24;

/**
 * Chance that a player agrees to join a club. Falls off steeply above what
 * the club's reputation can attract; elite players almost never join a club
 * outside the big six.
 */
export function joinChance(ovr: number, rep: number, bigClub: boolean): number {
  let q = 1 / (1 + Math.exp((ovr - capacity(rep)) / 1.3));
  if (ovr >= 86 && !bigClub) q *= 0.1;
  return q;
}

function isBig(state: GameState, data: GameData, club: number): boolean {
  return BIG_SIX.includes(data.meta.gameClubs[club]) || state.clubs[club].rep >= 88;
}

/** Name of a club abroad where players of this level play. */
function foreignClub(state: GameState, data: GameData, ovr: number, rng: Rng): string {
  const rows = data.seasons[state.season];
  const names = marketPool(state, data)
    .filter((q) => Math.abs(q.ovr - ovr) <= 2)
    .map((q) => data.meta.clubNames[rows[q.id]?.[6] ?? 0])
    .filter((n) => n !== 'Free agent');
  return names.length ? names[Math.floor(rng() * names.length)] : 'a club abroad';
}

function sellAbroad(state: GameState, data: GameData, p: PlayerState, rng: Rng, factor: number): void {
  transfer(state, data, p.id, EXTERNAL, roundFee(p.value * factor), foreignClub(state, data, p.ovr, rng));
}

/** The slot in the club's best XI with the lowest effective rating. */
function weakestSlot(state: GameState, c: ClubState): { slot: Position; eff: number } | null {
  const players = squadOf(state, c.id).map(lite);
  const xi = pickXI(players, c.formation);
  const byId = new Map(players.map((p) => [p.id, p]));
  let worst: { slot: Position; eff: number } | null = null;
  FORMATIONS[c.formation].forEach((slot, i) => {
    const p = byId.get(xi[i]);
    const eff = p ? p.ovr * positionFit(p.pos, slot) : 0;
    if (!worst || eff < worst.eff) worst = { slot, eff };
  });
  return worst;
}

/** Players in the club's best XI. */
function starters(state: GameState, c: ClubState): Set<number> {
  return new Set(pickXI(squadOf(state, c.id).map(lite), c.formation));
}

/** Least useful player outside the XI: low rating, older, little upside. */
function surplus(state: GameState, c: ClubState, area?: string): PlayerState | undefined {
  const xi = starters(state, c);
  const gks = c.squad.filter((id) => state.players[id].pos.startsWith('GK')).length;
  return squadOf(state, c.id)
    .filter((p) => !xi.has(p.id))
    .filter((p) => !(p.pos.startsWith('GK') && gks <= 2))
    .filter((p) => !area || AREA[parsePositions(p.pos)[0]] === area)
    .sort((a, b) => keepScore(a) - keepScore(b))[0];
}

function keepScore(p: PlayerState): number {
  return p.ovr + (p.age <= 22 ? (p.pot - p.ovr) * 0.5 : 0) - Math.max(0, p.age - 30);
}

function tryBuy(state: GameState, data: GameData, c: ClubState, rng: Rng): boolean {
  const need = weakestSlot(state, c);
  if (!need) return false;
  const big = isBig(state, data, c.id);
  const cap = capacity(c.rep);
  const user = state.user;

  type Cand = { p: PlayerState; fee: number; score: number };
  const cands: Cand[] = [];
  const consider = (p: PlayerState, fee: number) => {
    if (p.ovr < need.eff + 2 || p.ovr > cap + 4 || p.age > 32 || fee > c.cash) return;
    const fit = positionFit(parsePositions(p.pos), need.slot);
    if (fit < 0.95 || p.age > 32) return;
    const eff = p.ovr * fit;
    if (eff < need.eff + 2 || fee > c.cash) return;
    if (p.ovr > cap + 4) return;
    const score = eff - need.eff + (p.age <= 23 ? (p.pot - p.ovr) * 0.3 : 0) - Math.max(0, p.age - 29) * 0.7 + normal(rng, 0, 1.5);
    cands.push({ p, fee, score });
  };
  for (const p of marketPool(state, data)) {
    if (p.ovr >= need.eff + 2 && p.ovr <= cap + 4) consider(p, roundFee(p.value * Math.exp(normal(rng, 0.05, 0.12))));
  }
  // Players at smaller rivals, who would sell for a premium.
  for (const other of state.clubs) {
    if (other.id === c.id || other.id === user || other.rep > c.rep - 4) continue;
    for (const id of other.squad) {
      const p = state.players[id];
      if (other.squad.length > MIN_SQUAD + 2) consider(p, roundFee(p.value * 1.3));
    }
  }
  cands.sort((a, b) => b.score - a.score);
  for (const { p, fee } of cands.slice(0, 8)) {
    if (rng() > joinChance(p.ovr, c.rep, big)) continue;
    transfer(state, data, p.id, c.id, fee);
    if (c.squad.length > AI_SQUAD_TARGET) {
      const out = surplus(state, c, AREA[need.slot]) ?? surplus(state, c);
      if (out) sellAbroad(state, data, out, rng, 0.7 + rng() * 0.3);
    }
    return true;
  }
  return false;
}

export function aiWindow(state: GameState, data: GameData, phase: 'open' | 'deadline'): void {
  const rng = stream(state.seed, 'ai', state.season, phase);
  const clubs = shuffle(rng, state.clubs.filter((c) => c.id !== state.user));
  for (const c of clubs) {
    const big = isBig(state, data, c.id);
    if (phase === 'open') {
      // Trim the squad.
      while (c.squad.length > AI_SQUAD_TARGET) {
        const out = surplus(state, c);
        if (!out) break;
        sellAbroad(state, data, out, rng, 0.7 + rng() * 0.3);
      }
      // Clubs abroad sometimes poach the best player of a smaller club.
      const poach = big ? 0.04 : 0.12;
      if (rng() < poach) {
        const best = squadOf(state, c.id).sort((a, b) => b.ovr - a.ovr)[0];
        if (best && best.ovr >= 80 && best.age <= 30) sellAbroad(state, data, best, rng, 1.05 + rng() * 0.3);
      }
    }
    const attempts = phase === 'open' ? (big ? 3 : 2) : rng() < 0.5 ? 1 : 0;
    for (let k = 0; k < attempts; k++) {
      if (!tryBuy(state, data, c, rng)) break;
    }
  }
}

/** Tops a squad up to the minimum with the cheapest available players. */
export function ensureMinimumSquad(state: GameState, data: GameData, club: number): void {
  const c = state.clubs[club];
  if (c.squad.length >= MIN_SQUAD) return;
  const pool = marketPool(state, data).sort((a, b) => a.value - b.value);
  while (c.squad.length < Math.min(MIN_SQUAD, MAX_SQUAD)) {
    const gks = c.squad.filter((id) => state.players[id].pos.startsWith('GK')).length;
    const p = pool.find((q) => q.club === EXTERNAL && (gks >= 2 || q.pos.startsWith('GK')));
    if (!p) break;
    transfer(state, data, p.id, club, 0);
  }
}
