import type { Meta, Row } from './data';
import { type Rng, clamp, normal } from './rng';

export interface Developing {
  /** the player's id, to pick out the two exceptions (see GOATS) */
  id?: number;
  ovr: number;
  pot: number;
  age: number;
  /** real (or modelled) rating the game rating is anchored to */
  ref: number;
  pos: string;
}

/** How a player did last season: average match rating and appearances. */
export interface Form {
  avg: number;
  apps: number;
  /** average match rating of his club's players, and of the whole league */
  team?: number;
  league?: number;
  /** match rating his overall alone is worth against his team-mates (see ENGINE.quality) */
  quality?: number;
  /**
   * How far a typical regular in his area of the pitch rates above his
   * team-mates, across the league. Goals and assists lift forwards' match
   * ratings, so without this a defender or keeper would be judged against
   * the goalscorers and grow less for the same good season.
   */
  areaPar?: number;
}

/**
 * Messi and Cristiano Ronaldo: the two exceptions. Their ceiling is 98
 * while they are young enough to reach it, they keep growing from good
 * seasons at the very top where everyone else slows down, and the Ballon
 * d'Or all but keeps two seats for them (see awards.ts).
 */
export const GOATS: ReadonlySet<number> = new Set([20801, 158023]);
export const GOAT_CEILING = 98;
export const isGoat = (id: number | undefined) => id !== undefined && GOATS.has(id);

/**
 * Neymar: the almost-exception. He is not spared at the Ballon d'Or, but he
 * grows past where the top slows everyone else down, fastest while young,
 * to a ceiling a little below the two.
 */
export const NEYMAR = 190871;
export const NEAR_CEILING = 96;

/** The ceiling of an exception while he is young enough to reach it, or undefined. */
export function exceptionCeiling(id: number | undefined, age: number): number | undefined {
  if (age > 31) return undefined;
  if (isGoat(id)) return GOAT_CEILING;
  return id === NEYMAR ? NEAR_CEILING : undefined;
}

/** Potential as the game sees it: the exceptions can reach their ceiling until their thirties. */
export function goatPotential(id: number | undefined, pot: number, age: number): number {
  const ceiling = exceptionCeiling(id, age);
  return ceiling ? Math.max(pot, ceiling) : pot;
}

/** Where growth starts to slow for everyone else: 90, or just below his real rating if higher. */
const TOP = 90;
/** Rating points above that a player approaches but never quite reaches. */
const TOP_ROOM = 3;

/**
 * Above 90 (or a point below his real rating, if higher) every extra point
 * is harder to earn: the excess is squeezed so that 92 is rare and 93 a
 * great career's peak, while the exceptions keep climbing.
 */
export function topDamp(raw: number, ref: number, room = 0): number {
  const top = Math.max(TOP + room, ref - 1);
  const over = raw - top;
  return over <= 0 ? raw : top + over / (1 + over / (TOP_ROOM + room));
}

/**
 * Extra room at the top for the players a style is built on: a back line
 * that parks the bus, or the defender a team is built around. Without it no
 * defender could ever join the strikers above 92.
 */
export const BUILT_ON_ROOM = 4;

/** Share of a player's deviation from his real rating that carries over. */
const PERSIST = 0.75;
/** How far the game rating may drift below and above the real one; youngsters can outgrow history. */
const DRIFT_LOW = -6;
const driftHigh = (age: number) => (age <= 23 ? 12 : 7);
/** Without club and league averages: a match rating that leaves the rating where history puts it. */
const PAR = 6.75;

/** Players in their prime barely move; youngsters and veterans move more. */
const isPrime = (age: number) => age >= 27 && age <= 30;

function noise(rng: Rng, age: number): number {
  if (isPrime(age)) return normal(rng, 0, 0.6);
  // Small, with the odd surprise either way.
  return rng() < 0.05 ? normal(rng, 0, 2.5) : normal(rng, 0, age <= 23 ? 1.2 : 1);
}

/**
 * Rating points earned (or lost) by last season's performances. A player is
 * judged against his team-mates, and half as much on how his club did, so a
 * keeper behind a weak defence is not punished for it. Regulars only.
 * Youngsters respond most: a teenager who plays well also closes much of the
 * gap to his potential, so a star season can be worth ten points or more.
 * Players in their prime move a point at most; veterans decline faster
 * than they improve.
 */
export function formBoost(p: Pick<Developing, 'age' | 'ovr' | 'id'> & { pot?: number }, form: Form | undefined): number {
  if (!form || form.apps < 8) return 0;
  const perf = form.team === undefined || form.league === undefined
    ? form.avg - PAR
    : form.avg - form.team + 0.5 * (form.team - form.league);
  // Judged on what his rating predicts: a youngster among stars is not
  // marked down for being less good than them, only for playing below himself.
  // And against what his area of the pitch usually earns: a centre-back is
  // not marked down for scoring fewer goals than the strikers.
  const fair = perf - (form.quality ?? 0) - (form.areaPar ?? 0);
  const played = Math.min(1, form.apps / 25);
  let b = clamp(fair * 4, -2, 3) * played;
  if (p.age <= 23) {
    if (b > 0) {
      b *= p.age <= 20 ? 2 : 1.5;
      // Playing well unlocks potential.
      const headroom = Math.max(0, (p.pot ?? p.ovr) - p.ovr);
      b += 0.3 * headroom * Math.min(1, fair / 0.5) * played;
    }
    b = clamp(b, -2, p.age <= 20 ? 9 : 6);
  } else if (isPrime(p.age)) {
    b = clamp(b * 0.4, -1.2, 1.2);
  } else if (p.age >= 31) {
    b *= b > 0 ? 0.5 : 1;
  }
  if (b > 0 && p.ovr >= 88 && !isGoat(p.id) && p.id !== NEYMAR) b *= 0.5;
  return b;
}

/**
 * Moves a player one season on. His real rating next season is the expected
 * value, adjusted by how he played; without one, he follows the average
 * change for his age. In his prime, only part of the real change applies.
 */
export function developPlayer(p: Developing, next: Row | undefined, meta: Meta, rng: Rng, form?: Form, growth = 1, room = 0): void {
  const raw0 = formBoost(p, form);
  // A play style turns good seasons into bigger (or smaller) gains for some players.
  // The players a style is built on also improve a little from the role
  // itself, after any season he played well enough in (see BUILT_ON_ROOM).
  const boost = (raw0 > 0 ? raw0 * growth : raw0) + (room > 0 && raw0 >= 0 && (form?.apps ?? 0) >= 15 ? 0.6 : 0);
  const age = p.age;
  let expected: number;
  if (next) {
    expected = isPrime(age) ? p.ovr + 0.5 * (next[0] - p.ref) : next[0] + PERSIST * (p.ovr - p.ref);
    p.ref = next[0];
    p.age = next[2];
    p.pos = next[5];
  } else {
    const dev = meta.devByAge[String(clamp(p.age, 17, 39))];
    let d = dev ? dev[0] : -1;
    if (p.age <= 23) d = Math.max(d, meta.headroomRate * (p.pot - p.ovr));
    if (p.age >= 34) d -= 1;
    expected = p.ovr + d;
    p.ref += d;
    p.age += 1;
  }
  const before = p.ovr;
  const ceiling = exceptionCeiling(p.id, age);
  let raw = expected + boost + noise(rng, age);
  // The exceptions drift up a little each year they are at their best;
  // Neymar, younger, faster while he is young.
  if (ceiling && boost >= 0) raw += isGoat(p.id) ? 0.7 : 0.7 + 0.25 * Math.max(0, 24 - age);
  // Everyone else finds the very top hard going.
  else if (!ceiling) raw = topDamp(raw, p.ref, room);
  const lo = p.ref + DRIFT_LOW;
  const hi = ceiling ?? Math.min(p.ref + driftHigh(age) + room, Math.max(96, p.ref));
  p.ovr = Math.round(clamp(clamp(raw, lo, hi), 40, 99));
  const realPot = next ? next[1] + (p.ovr - next[0]) : p.pot + (p.ovr - before) * 0.5;
  p.pot = goatPotential(p.id, Math.round(clamp(Math.max(p.ovr, realPot), p.ovr, 99)), p.age);
}

/** Chance that a player with no next-season data retires. */
export function retireChance(age: number): number {
  if (age >= 35) return 0.55;
  if (age >= 33) return 0.35;
  if (age >= 31) return 0.15;
  return 0.03;
}
