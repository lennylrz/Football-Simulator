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

/** Share of a player's deviation from his real rating that carries over. */
const PERSIST = 0.5;

function noise(rng: Rng): number {
  // Usually small, with rare larger swings both ways.
  return rng() < 0.08 ? normal(rng, 0, 5) : normal(rng, 0, 2);
}

/**
 * Moves a player one season on. His real rating next season is the expected
 * value; without one, he follows the average change for his age.
 */
export function developPlayer(p: Developing, next: Row | undefined, meta: Meta, rng: Rng): void {
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
  p.ovr = Math.round(clamp(expected + noise(rng), 40, 99));
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
