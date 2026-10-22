// Play styles for a manager's club. A style shifts the team's strength
// between areas, decides who gets the goals, and whose good seasons turn
// into the biggest rating gains. None is better overall: each trades
// something away (tuned by the play-style tests).
import type { Strength } from './lineup';
import type { Area } from './positions';

export type PlayStyle = 'tiki' | 'star' | 'bus' | 'press';

export interface StyleInfo {
  key: PlayStyle;
  name: string;
  /** one line for the club and summer screens */
  desc: string;
  /** rating points added to each area of the team's strength */
  shift: Pick<Strength, 'att' | 'mid' | 'def'>;
  /** how evenly the goals are shared out (higher: more even) */
  spread: number;
  /** how far the star's share of the goals moves towards half (assists half as far) */
  starPull: number;
  /** positive form boosts, by area, for the star, and for everyone else */
  growth: Partial<Record<Area, number>> & { star?: number; rest?: number };
}

export const STYLES: Record<PlayStyle, StyleInfo> = {
  tiki: {
    key: 'tiki', name: 'Tiki-Taka', desc: 'Keep the ball, share the goals. Everyone grows, midfielders most.',
    shift: { att: -0.5, mid: 1.2, def: 0 }, spread: 1.6, starPull: 0, growth: { MID: 1.2 },
  },
  star: {
    key: 'star', name: 'Through the Star', desc: 'Everything goes through your best player. He can have a huge season; the rest grow less.',
    shift: { att: 1.5, mid: 0, def: 0 }, spread: 1, starPull: 0.4, growth: { star: 1.6, rest: 0.85 },
  },
  bus: {
    key: 'bus', name: 'Park the Bus', desc: 'Defend deep and nick goals. Fewer goals both ways; defenders and keepers grow most.',
    shift: { att: -2, mid: -0.5, def: 5.2 }, spread: 1, starPull: 0, growth: { GK: 1.4, DEF: 1.4, ATT: 0.75 },
  },
  press: {
    key: 'press', name: 'Gegenpress', desc: 'Win it back high and attack. More goals both ways; forwards grow most.',
    shift: { att: 1.8, mid: 0.3, def: -3 }, spread: 1, starPull: 0, growth: { ATT: 1.3, MID: 1.1, DEF: 0.8 },
  },
};

export const STYLE_ORDER: PlayStyle[] = ['tiki', 'star', 'bus', 'press'];

export function applyStyle(s: Strength, style?: PlayStyle): Strength {
  if (!style) return s;
  const { shift } = STYLES[style];
  return { gk: s.gk, att: s.att + shift.att, mid: s.mid + shift.mid, def: s.def + shift.def };
}

/** Multiplier on a player's positive form boost under his club's style. */
export function styleGrowth(style: PlayStyle | undefined, area: Area, isStar: boolean): number {
  if (!style) return 1;
  const g = STYLES[style].growth;
  if (style === 'star') return isStar ? g.star! : g.rest!;
  return g[area] ?? 1;
}
