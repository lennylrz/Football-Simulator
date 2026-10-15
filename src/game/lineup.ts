import { AREA, FORMATIONS, FORMATION_NAMES, type Formation, type Position, positionFit } from './positions';

export interface PlayerLite {
  id: number;
  ovr: number;
  pos: Position[];
}

export interface Lineup {
  formation: Formation;
  /** player ids, one per formation slot */
  xi: number[];
  bench: number[];
}

export const BENCH_SIZE = 5;

/** Assign players to slots, greedily by effective rating, then improve by swaps. */
export function pickXI(players: PlayerLite[], formation: Formation): number[] {
  const slots = FORMATIONS[formation];
  const pairs: [number, number, number][] = [];
  players.forEach((p, pi) =>
    slots.forEach((s, si) => pairs.push([p.ovr * positionFit(p.pos, s), pi, si])),
  );
  pairs.sort((a, b) => b[0] - a[0]);
  const slotTaken: number[] = slots.map(() => -1);
  const used = new Set<number>();
  for (const [, pi, si] of pairs) {
    if (slotTaken[si] !== -1 || used.has(pi)) continue;
    slotTaken[si] = pi;
    used.add(pi);
  }
  // Local improvement: swap two assigned players, or swap in a reserve.
  const eff = (pi: number, si: number) => players[pi].ovr * positionFit(players[pi].pos, slots[si]);
  let improved = true;
  for (let iter = 0; improved && iter < 20; iter++) {
    improved = false;
    for (let a = 0; a < slots.length; a++) {
      for (let b = a + 1; b < slots.length; b++) {
        const pa = slotTaken[a], pb = slotTaken[b];
        if (pa < 0 || pb < 0) continue;
        if (eff(pb, a) + eff(pa, b) > eff(pa, a) + eff(pb, b) + 1e-9) {
          slotTaken[a] = pb;
          slotTaken[b] = pa;
          improved = true;
        }
      }
      for (let r = 0; r < players.length; r++) {
        if (used.has(r) || slotTaken[a] < 0) continue;
        if (eff(r, a) > eff(slotTaken[a], a) + 1e-9) {
          used.delete(slotTaken[a]);
          slotTaken[a] = r;
          used.add(r);
          improved = true;
        }
      }
    }
  }
  return slotTaken.map((pi) => (pi >= 0 ? players[pi].id : -1));
}

/** Best five reserves, keeping a goalkeeper among them when there is one. */
export function pickBench(players: PlayerLite[], xi: number[]): number[] {
  const inXI = new Set(xi);
  const rest = players.filter((p) => !inXI.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  const gk = rest.find((p) => p.pos[0] === 'GK');
  const outfield = rest.filter((p) => p.pos[0] !== 'GK');
  const bench = gk ? [gk, ...outfield.slice(0, BENCH_SIZE - 1)] : outfield.slice(0, BENCH_SIZE);
  return bench.map((p) => p.id);
}

export function xiScore(players: PlayerLite[], xi: number[], formation: Formation): number {
  const byId = new Map(players.map((p) => [p.id, p]));
  return FORMATIONS[formation].reduce((sum, slot, i) => {
    const p = byId.get(xi[i]);
    return sum + (p ? p.ovr * positionFit(p.pos, slot) : 0);
  }, 0);
}

/** The formation and lineup that maximise the summed effective rating. */
export function autoLineup(players: PlayerLite[], prefer?: Formation): Lineup {
  let best: Lineup | null = null;
  let bestScore = -Infinity;
  for (const f of FORMATION_NAMES) {
    const xi = pickXI(players, f);
    // Slight preference keeps a club's shape stable when options are close.
    const score = xiScore(players, xi, f) + (f === prefer ? 3 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { formation: f, xi, bench: [] };
    }
  }
  best!.bench = pickBench(players, best!.xi);
  return best!;
}

// How much each slot contributes to defence, midfield and attack.
const SLOT_WEIGHTS: Record<Position, [number, number, number]> = {
  GK: [0, 0, 0],
  CB: [1, 0.1, 0],
  LB: [0.8, 0.3, 0.15], RB: [0.8, 0.3, 0.15],
  LWB: [0.6, 0.4, 0.25], RWB: [0.6, 0.4, 0.25],
  CDM: [0.45, 0.8, 0.1],
  CM: [0.15, 1, 0.3],
  CAM: [0, 0.7, 0.6],
  LM: [0.15, 0.7, 0.5], RM: [0.15, 0.7, 0.5],
  LW: [0, 0.3, 1], RW: [0, 0.3, 1],
  CF: [0, 0.3, 0.9],
  ST: [0, 0.1, 1],
};

export interface Strength {
  gk: number;
  def: number;
  mid: number;
  att: number;
}

/** Area ratings from effective ratings of the players in each slot. */
export function teamStrength(slots: Position[], effective: number[]): Strength {
  let gk = 0;
  const sum = [0, 0, 0];
  const w = [0, 0, 0];
  slots.forEach((s, i) => {
    if (s === 'GK') {
      gk = effective[i];
      return;
    }
    SLOT_WEIGHTS[s].forEach((x, k) => {
      sum[k] += x * effective[i];
      w[k] += x;
    });
  });
  return { gk, def: sum[0] / w[0], mid: sum[1] / w[1], att: sum[2] / w[2] };
}

export { AREA };
