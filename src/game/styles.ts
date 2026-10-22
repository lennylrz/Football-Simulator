// Play styles for a manager's club. A style shifts the team's strength
// between areas, decides who gets the goals, and whose good seasons turn
// into the biggest rating gains. None is better overall: each trades
// something away (tuned by the play-style tests).
import type { Strength } from './lineup';
import { AREA, type Area, type Position } from './positions';

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
  /** positive form boosts, by area, and for everyone but the star (Through the Star, see STAR_ROLES) */
  growth: Partial<Record<Area, number>> & { rest?: number };
}

/** What the star does in Through the Star, by where he plays. */
export type StarRole = 'ATT' | 'MID' | 'DEF';

export interface StarRoleInfo {
  /** rating points added to each area of the team's strength (replaces the style's shift) */
  shift: Pick<Strength, 'att' | 'mid' | 'def'>;
  /** how far his share of the goals, and of the assists, moves towards half */
  goals: number;
  assists: number;
  /** multiplier on his positive form boost */
  growth: number;
  /** the leader at the back: his match ratings carry the defence's clean sheets */
  lead?: boolean;
}

/**
 * A forward star gets the goals; a midfield star makes them, and scores a
 * few; a defender or keeper star is the leader: the defence is built around
 * him, he takes the credit for its clean sheets, and he grows most.
 */
export const STAR_ROLES: Record<StarRole, StarRoleInfo> = {
  ATT: { shift: { att: 1, mid: 0, def: 0 }, goals: 0.4, assists: 0.2, growth: 1.6 },
  MID: { shift: { att: 0.4, mid: 0.6, def: 0 }, goals: 0.15, assists: 0.45, growth: 1.6 },
  DEF: { shift: { att: 0, mid: 0, def: 1.9 }, goals: 0.04, assists: 0, growth: 1.8, lead: true },
};

export function starRole(slot: Position | undefined): StarRole {
  const a = slot ? AREA[slot] : 'ATT';
  return a === 'GK' || a === 'DEF' ? 'DEF' : a;
}

export const STYLES: Record<PlayStyle, StyleInfo> = {
  tiki: {
    key: 'tiki', name: 'Tiki-Taka', desc: 'Keep the ball, share the goals. Everyone grows, midfielders most.',
    shift: { att: -0.5, mid: 1.2, def: 0 }, spread: 1.6, growth: { MID: 1.2 },
  },
  star: {
    key: 'star', name: 'Through the Star', desc: 'Everything goes through your star: a forward scores, a midfielder creates, a defender leads the back line. He can have a huge season; the rest grow less.',
    shift: STAR_ROLES.ATT.shift, spread: 1, growth: { rest: 0.85 },
  },
  bus: {
    key: 'bus', name: 'Park the Bus', desc: 'Defend deep and nick goals. Fewer goals both ways; defenders and keepers grow most.',
    shift: { att: -2, mid: -0.5, def: 5.2 }, spread: 1, growth: { GK: 1.6, DEF: 1.6, ATT: 0.7 },
  },
  press: {
    key: 'press', name: 'Gegenpress', desc: 'Win it back high and attack. More goals both ways; forwards grow most.',
    shift: { att: 2, mid: 0.3, def: -3 }, spread: 1, growth: { ATT: 1.3, MID: 1.1, DEF: 0.8 },
  },
};

export const STYLE_ORDER: PlayStyle[] = ['tiki', 'star', 'bus', 'press'];

export function applyStyle(s: Strength, style?: PlayStyle, role: StarRole = 'ATT'): Strength {
  if (!style) return s;
  const shift = style === 'star' ? STAR_ROLES[role].shift : STYLES[style].shift;
  return { gk: s.gk, att: s.att + shift.att, mid: s.mid + shift.mid, def: s.def + shift.def };
}

/** Multiplier on a player's positive form boost under his club's style. */
export function styleGrowth(style: PlayStyle | undefined, area: Area, isStar: boolean, role: StarRole = 'ATT'): number {
  if (!style) return 1;
  const g = STYLES[style].growth;
  if (style === 'star') return isStar ? STAR_ROLES[role].growth : g.rest!;
  return g[area] ?? 1;
}
