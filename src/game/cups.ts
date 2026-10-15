// FA Cup and Champions League, kept deliberately simple. Clubs outside the 20
// play with a fixed strength from their real squad that season.
import type { Strength } from './lineup';
import { type MatchTeam, simulateMatch } from './match';
import { type Rng, shuffle } from './rng';

/** A game club (index) or an outside club (name). */
export type Entrant = number | string;

export interface CupMatch {
  /** position in the season calendar: after league round N, x.5 */
  slot: number;
  round: string;
  home: Entrant;
  away: Entrant;
  hg: number;
  ag: number;
  /** penalty shoot-out winner side, when the tie was level */
  pens?: 0 | 1;
  /** second leg: aggregate decides */
  leg?: 1 | 2;
  scorers: [number, number, 0 | 1][];
}

export interface GroupRow {
  team: Entrant;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface CupResult {
  matches: CupMatch[];
  winner: Entrant;
  /** furthest round reached by each game club that entered */
  reached: Record<number, string>;
  groups?: GroupRow[][];
  /** strengths of outside clubs, by name */
  ratings: Record<string, number>;
}

export interface CupContext {
  team: (club: number) => MatchTeam;
  ratings: Record<string, number>;
  rng: Rng;
  /** collects every game-club match for player stats */
  onMatch: (m: ReturnType<typeof simulateMatch>) => void;
}

export const FA_ROUNDS = ['Third round', 'Fourth round', 'Fifth round', 'Quarter-final', 'Semi-final', 'Final'];
const FA_SLOTS = [20.5, 23.5, 26.5, 29.5, 32.5, 38.2];
export const CL_ROUNDS = ['Group stage', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
const CL_GROUP_SLOTS = [4.5, 6.5, 9.5, 11.5, 13.5, 15.5];
const CL_KO_SLOTS: [number, number][] = [[25.5, 27.5], [30.5, 31.5], [33.5, 34.5]];
const CL_FINAL_SLOT = 38.5;
export const WINNER = 'Winner';

/** Adjustment to outside clubs' best-XI rating; tuned so English clubs win
 * the Champions League about as often as they did in 2015-2020. */
export const OUTSIDE_BONUS = { value: 1 };

function fixedStrength(rating: number): Strength {
  const r = rating + OUTSIDE_BONUS.value;
  return { gk: r, def: r, mid: r, att: r };
}

function side(ctx: CupContext, e: Entrant): MatchTeam {
  if (typeof e === 'number') return ctx.team(e);
  return { club: -1, slots: [], xi: [], bench: [], fixed: fixedStrength(ctx.ratings[e]) };
}

function strengthOf(ctx: CupContext, e: Entrant): number {
  if (typeof e === 'string') return ctx.ratings[e];
  const t = ctx.team(e);
  return t.xi.reduce((s, p) => s + p.ovr, 0) / Math.max(1, t.xi.length);
}

function play(ctx: CupContext, home: Entrant, away: Entrant, slot: number, round: string, neutral = false): CupMatch {
  const m = simulateMatch(side(ctx, home), side(ctx, away), ctx.rng, neutral);
  if (typeof home === 'number' || typeof away === 'number') ctx.onMatch(m);
  return { slot, round, home, away, hg: m.hg, ag: m.ag, scorers: m.goals };
}

/** Shoot-out: close to a coin flip, slightly favouring the stronger side. */
function shootout(ctx: CupContext, a: Entrant, b: Entrant): 0 | 1 {
  const edge = (strengthOf(ctx, a) - strengthOf(ctx, b)) * 0.01;
  return ctx.rng() < 0.5 + edge ? 0 : 1;
}

function single(ctx: CupContext, a: Entrant, b: Entrant, slot: number, round: string, neutral: boolean, out: CupMatch[]): Entrant {
  const m = play(ctx, a, b, slot, round, neutral);
  out.push(m);
  if (m.hg !== m.ag) return m.hg > m.ag ? a : b;
  m.pens = shootout(ctx, a, b);
  return m.pens === 0 ? a : b;
}

function twoLegs(ctx: CupContext, a: Entrant, b: Entrant, slots: [number, number], round: string, out: CupMatch[]): Entrant {
  const first = play(ctx, a, b, slots[0], round);
  first.leg = 1;
  const second = play(ctx, b, a, slots[1], round);
  second.leg = 2;
  out.push(first, second);
  const aGoals = first.hg + second.ag;
  const bGoals = first.ag + second.hg;
  if (aGoals !== bGoals) return aGoals > bGoals ? a : b;
  second.pens = shootout(ctx, b, a);
  return second.pens === 0 ? b : a;
}

function markReached(reached: Record<number, string>, teams: Entrant[], round: string) {
  for (const t of teams) if (typeof t === 'number') reached[t] = round;
}

/** FA Cup from the third round: the 20 clubs plus 44 lower-league sides. */
export function simulateFaCup(ctx: CupContext, clubs: number[], lower: [string, number, number][]): CupResult {
  const rng = ctx.rng;
  const championship = lower.filter((t) => t[1] === 2);
  const below = shuffle(rng, lower.filter((t) => t[1] > 2));
  const others = [...championship, ...below].slice(0, 64 - clubs.length);
  let alive: Entrant[] = shuffle(rng, [...clubs, ...others.map((t) => t[0])]);
  const matches: CupMatch[] = [];
  const reached: Record<number, string> = {};
  FA_ROUNDS.forEach((round, r) => {
    markReached(reached, alive, round);
    const next: Entrant[] = [];
    const neutral = r >= FA_ROUNDS.length - 2;
    for (let i = 0; i < alive.length; i += 2) {
      next.push(single(ctx, alive[i], alive[i + 1], FA_SLOTS[r], round, neutral, matches));
    }
    alive = shuffle(rng, next);
  });
  markReached(reached, alive, WINNER);
  return { matches, winner: alive[0], reached, ratings: ctx.ratings };
}

/** Champions League: 8 groups of 4, then two-legged ties and a one-off final. */
export function simulateChampionsLeague(ctx: CupContext, english: number[], europe: [string, string, number][]): CupResult {
  const rng = ctx.rng;
  const outside = europe.slice(0, 32 - english.length).map((t) => t[0]);
  const all: Entrant[] = [...english, ...outside].sort((a, b) => strengthOf(ctx, b) - strengthOf(ctx, a));
  const pots = [0, 1, 2, 3].map((k) => shuffle(rng, all.slice(k * 8, k * 8 + 8)));
  // Draw groups, keeping English clubs apart.
  let groups: Entrant[][] = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    groups = Array.from({ length: 8 }, (_, g) => pots.map((pot) => pot[g]));
    if (groups.every((g) => g.filter((t) => typeof t === 'number').length <= 1)) break;
    pots.forEach((pot, k) => (pots[k] = shuffle(rng, pot)));
  }

  const matches: CupMatch[] = [];
  const reached: Record<number, string> = {};
  markReached(reached, all, CL_ROUNDS[0]);
  const tables: GroupRow[][] = [];
  const winners: Entrant[] = [];
  const runners: Entrant[] = [];
  const pairs: [number, number][][] = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  for (const g of groups) {
    const rows = g.map((team): GroupRow => ({ team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
    for (let md = 0; md < 6; md++) {
      for (const [x, y] of pairs[md % 3]) {
        const [h, a] = md < 3 ? [x, y] : [y, x];
        const m = play(ctx, g[h], g[a], CL_GROUP_SLOTS[md], CL_ROUNDS[0]);
        matches.push(m);
        const rh = rows[h], ra = rows[a];
        rh.p++; ra.p++; rh.gf += m.hg; rh.ga += m.ag; ra.gf += m.ag; ra.ga += m.hg;
        if (m.hg > m.ag) { rh.w++; ra.l++; rh.pts += 3; }
        else if (m.hg < m.ag) { ra.w++; rh.l++; ra.pts += 3; }
        else { rh.d++; ra.d++; rh.pts++; ra.pts++; }
      }
    }
    rows.sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
    tables.push(rows);
    winners.push(rows[0].team);
    runners.push(rows[1].team);
  }

  // Round of 16: group winners against runners-up from other groups.
  let order = shuffle(rng, runners.map((_, i) => i));
  for (let attempt = 0; attempt < 50 && order.some((r, w) => r === w); attempt++) order = shuffle(rng, order);
  let alive: Entrant[] = [];
  markReached(reached, [...winners, ...runners], CL_ROUNDS[1]);
  winners.forEach((w, i) => alive.push(twoLegs(ctx, runners[order[i]], w, CL_KO_SLOTS[0], CL_ROUNDS[1], matches)));
  for (let r = 2; r <= 3; r++) {
    markReached(reached, alive, CL_ROUNDS[r]);
    alive = shuffle(rng, alive);
    const next: Entrant[] = [];
    for (let i = 0; i < alive.length; i += 2) next.push(twoLegs(ctx, alive[i], alive[i + 1], CL_KO_SLOTS[r - 1], CL_ROUNDS[r], matches));
    alive = next;
  }
  markReached(reached, alive, CL_ROUNDS[4]);
  const winner = single(ctx, alive[0], alive[1], CL_FINAL_SLOT, CL_ROUNDS[4], true, matches);
  markReached(reached, [winner], WINNER);
  return { matches, winner, reached, groups: tables, ratings: ctx.ratings };
}

export function entrantName(e: Entrant, clubName: (club: number) => string): string {
  return typeof e === 'number' ? clubName(e) : e;
}
