export const POSITIONS = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST',
] as const;
export type Position = (typeof POSITIONS)[number];

export type Area = 'GK' | 'DEF' | 'MID' | 'ATT';

export const AREA: Record<Position, Area> = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', CF: 'ATT', ST: 'ATT',
};

export const FORMATIONS = {
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CDM', 'CM', 'LW', 'ST', 'RW'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LW', 'CAM', 'RW', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LWB', 'CM', 'CAM', 'CM', 'RWB', 'ST', 'ST'],
  '5-3-2': ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'CM', 'CDM', 'CM', 'ST', 'ST'],
} satisfies Record<string, Position[]>;
export type Formation = keyof typeof FORMATIONS;
export const FORMATION_NAMES = Object.keys(FORMATIONS) as Formation[];

// Positions that are nearly interchangeable (0.95) or related (0.88).
const CLOSE: [Position, Position][] = [
  ['LB', 'LWB'], ['RB', 'RWB'], ['CDM', 'CM'], ['CM', 'CAM'], ['CAM', 'CF'],
  ['CF', 'ST'], ['LM', 'LW'], ['RM', 'RW'],
];
const RELATED: [Position, Position][] = [
  ['CB', 'CDM'], ['LB', 'CB'], ['RB', 'CB'], ['LB', 'RB'], ['LWB', 'RWB'],
  ['LB', 'LM'], ['RB', 'RM'], ['LWB', 'LM'], ['RWB', 'RM'], ['CM', 'LM'],
  ['CM', 'RM'], ['LM', 'RM'], ['LW', 'RW'], ['CAM', 'LW'], ['CAM', 'RW'],
  ['CAM', 'ST'], ['LW', 'ST'], ['RW', 'ST'], ['LW', 'CF'], ['RW', 'CF'],
  ['CAM', 'LM'], ['CAM', 'RM'],
];
const AREA_ORDER: Area[] = ['GK', 'DEF', 'MID', 'ATT'];

function pairFit(a: Position, b: Position): number {
  if (a === b) return 1;
  if (a === 'GK' || b === 'GK') return 0.3;
  const has = (list: [Position, Position][]) =>
    list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (has(CLOSE)) return 0.95;
  if (has(RELATED)) return 0.88;
  const gap = Math.abs(AREA_ORDER.indexOf(AREA[a]) - AREA_ORDER.indexOf(AREA[b]));
  return gap === 0 ? 0.8 : gap === 1 ? 0.7 : 0.55;
}

const FIT: Record<string, number> = {};
for (const a of POSITIONS) for (const b of POSITIONS) FIT[a + b] = pairFit(a, b);

/** How well a player with these natural positions fits a slot, 0..1. */
export function positionFit(natural: readonly Position[], slot: Position): number {
  let best = 0;
  for (const p of natural) best = Math.max(best, FIT[p + slot]);
  return best;
}

/** Effective rating in a slot: out-of-position players are penalised. */
export function effectiveRating(ovr: number, natural: readonly Position[], slot: Position): number {
  return ovr * positionFit(natural, slot);
}

export function parsePositions(s: string): Position[] {
  return s.split(',').filter((p): p is Position => (POSITIONS as readonly string[]).includes(p));
}
