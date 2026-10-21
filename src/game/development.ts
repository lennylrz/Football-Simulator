import type { Meta, Row } from './data';
import { type Rng, clamp, normal } from './rng';

export interface Developing {
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
}

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
export function formBoost(p: Pick<Developing, 'age' | 'ovr'> & { pot?: number }, form: Form | undefined): number {
  if (!form || form.apps < 8) return 0;
  const perf = form.team === undefined || form.league === undefined
    ? form.avg - PAR
    : form.avg - form.team + 0.5 * (form.team - form.league);
  const played = Math.min(1, form.apps / 25);
  let b = clamp(perf * 4, -2, 3) * played;
  if (p.age <= 23) {
    if (b > 0) {
      b *= p.age <= 20 ? 2 : 1.5;
      // Playing well unlocks potential.
      const headroom = Math.max(0, (p.pot ?? p.ovr) - p.ovr);
      b += 0.3 * headroom * Math.min(1, perf / 0.5) * played;
    }
    b = clamp(b, -2, p.age <= 20 ? 9 : 6);
  } else if (isPrime(p.age)) {
    b = clamp(b * 0.4, -1.2, 1.2);
  } else if (p.age >= 31) {
    b *= b > 0 ? 0.5 : 1;
  }
  if (b > 0 && p.ovr >= 88) b *= 0.5;
  return b;
}

/**
 * Moves a player one season on. His real rating next season is the expected
 * value, adjusted by how he played; without one, he follows the average
 * change for his age. In his prime, only part of the real change applies.
 */
export function developPlayer(p: Developing, next: Row | undefined, meta: Meta, rng: Rng, form?: Form): void {
  const boost = formBoost(p, form);
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
  const raw = expected + boost + noise(rng, age);
  const lo = p.ref + DRIFT_LOW;
  const hi = Math.min(p.ref + driftHigh(age), Math.max(96, p.ref));
  p.ovr = Math.round(clamp(clamp(raw, lo, hi), 40, 99));
  const realPot = next ? next[1] + (p.ovr - next[0]) : p.pot + (p.ovr - before) * 0.5;
  p.pot = Math.round(clamp(Math.max(p.ovr, realPot), p.ovr, 99));
}

/** Chance that a player with no next-season data retires. */
export function retireChance(age: number): number {
  if (age >= 35) return 0.55;
  if (age >= 33) return 0.35;
  if (age >= 31) return 0.15;
  return 0.03;
}
