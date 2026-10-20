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
/** How far the game rating may drift from the real one, below and above. */
const DRIFT: [number, number] = [-6, 7];
/** Without club and league averages: a match rating that leaves the rating where history puts it. */
const PAR = 6.75;

function noise(rng: Rng): number {
  // Small, with the odd surprise either way.
  return rng() < 0.05 ? normal(rng, 0, 2.5) : normal(rng, 0, 1);
}

/**
 * Rating points earned (or lost) by last season's performances. A player is
 * judged against his team-mates, and half as much on how his club did, so a
 * keeper behind a weak defence is not punished for it. Regulars only;
 * youngsters respond most, veterans and world-class players least.
 */
export function formBoost(p: Pick<Developing, 'age' | 'ovr'>, form: Form | undefined): number {
  if (!form || form.apps < 8) return 0;
  const perf = form.team === undefined || form.league === undefined
    ? form.avg - PAR
    : form.avg - form.team + 0.5 * (form.team - form.league);
  let b = clamp(perf * 4, -2, 3) * Math.min(1, form.apps / 25);
  if (b > 0) {
    if (p.age <= 23) b *= 1.3;
    else if (p.age >= 31) b *= 0.6;
    if (p.ovr >= 88) b *= 0.5;
  }
  return b;
}

/**
 * Moves a player one season on. His real rating next season is the expected
 * value, adjusted by how he played; without one, he follows the average
 * change for his age.
 */
export function developPlayer(p: Developing, next: Row | undefined, meta: Meta, rng: Rng, form?: Form): void {
  const boost = formBoost(p, form);
  let expected: number;
  if (next) {
    expected = next[0] + PERSIST * (p.ovr - p.ref);
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
  const raw = expected + boost + noise(rng);
  const lo = p.ref + DRIFT[0];
  const hi = Math.min(p.ref + DRIFT[1], Math.max(96, p.ref));
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
