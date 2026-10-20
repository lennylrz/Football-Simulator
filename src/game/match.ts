import { type PlayerLite, type Strength, teamStrength } from './lineup';
import { AREA, type Position, positionFit } from './positions';
import { type Rng, clamp, normal, poisson, weightedIndex } from './rng';

export interface MatchTeam {
  club: number;
  slots: Position[];
  /** starters, one per slot */
  xi: PlayerLite[];
  bench: PlayerLite[];
  /** season-long form offset */
  form?: number;
  /** teams outside the 20 clubs have a fixed strength and no players */
  fixed?: Strength;
}

export interface PlayerLine {
  id: number;
  club: number;
  started: boolean;
  goals: number;
  assists: number;
  rating: number;
}

export interface MatchResult {
  home: number;
  away: number;
  hg: number;
  ag: number;
  /** [scorer id, assister id or -1, 0 = home / 1 = away] */
  goals: [number, number, 0 | 1][];
  lines: PlayerLine[];
}

// Tuned by the balancing tests (src/game/balance.test.ts).
export const ENGINE = {
  base: 1.2,
  home: 0.13,
  attack: 0.056,
  midfield: 0.034,
  /** match-to-match form, in rating points */
  formSd: 1.5,
  /** season-long form of a team (a hot or cold season), in rating points */
  seasonFormSd: 0.6,
  /** how strongly a player's rating drives his share of goals and assists */
  starPower: 14,
  missChance: 0.05,
  missChanceGk: 0.015,
  assistShare: 0.75,
};

const SCORE_W: Record<Position, number> = {
  GK: 0, CB: 0.12, LB: 0.07, RB: 0.07, LWB: 0.1, RWB: 0.1, CDM: 0.14, CM: 0.3,
  CAM: 0.55, LM: 0.42, RM: 0.42, LW: 0.65, RW: 0.65, CF: 0.75, ST: 0.8,
};
const ASSIST_W: Record<Position, number> = {
  GK: 0.01, CB: 0.06, LB: 0.25, RB: 0.25, LWB: 0.32, RWB: 0.32, CDM: 0.18, CM: 0.45,
  CAM: 0.8, LM: 0.6, RM: 0.6, LW: 0.7, RW: 0.7, CF: 0.55, ST: 0.42,
};

interface OnPitch {
  p: PlayerLite;
  slot: Position;
  eff: number;
  /** fraction of the match played */
  share: number;
  started: boolean;
  goals: number;
  assists: number;
}

function lineUp(team: MatchTeam, rng: Rng): { on: OnPitch[]; strength: Strength } {
  if (team.fixed) return { on: [], strength: team.fixed };
  const bench = team.bench.slice();
  const take = (slot: Position): PlayerLite | undefined => {
    let bi = -1;
    let best = -1;
    bench.forEach((b, i) => {
      const e = b.ovr * positionFit(b.pos, slot);
      if (e > best) {
        best = e;
        bi = i;
      }
    });
    return bi >= 0 ? bench.splice(bi, 1)[0] : undefined;
  };

  // Knocks and rotation: a starter sometimes misses the match.
  const on: OnPitch[] = team.xi.map((p, i) => {
    const slot = team.slots[i];
    const miss = slot === 'GK' ? ENGINE.missChanceGk : ENGINE.missChance;
    let player = p;
    if (rng() < miss) player = take(slot) ?? p;
    return { p: player, slot, eff: player.ovr * positionFit(player.pos, slot), share: 1, started: true, goals: 0, assists: 0 };
  });
  const strength = teamStrength(team.slots, on.map((o) => o.eff));

  // Up to three substitutions in the last half hour.
  const subs: OnPitch[] = [];
  for (let k = 0; k < 3 && bench.length > 0; k++) {
    if (rng() > 0.8) continue;
    const outfield = on.filter((o) => o.slot !== 'GK' && o.share === 1);
    if (outfield.length === 0) break;
    const off = outfield[Math.floor(rng() * outfield.length)];
    const sub = take(off.slot);
    if (!sub) break;
    const minute = 55 + Math.floor(rng() * 30);
    off.share = minute / 90;
    subs.push({ p: sub, slot: off.slot, eff: sub.ovr * positionFit(sub.pos, off.slot), share: 1 - minute / 90, started: false, goals: 0, assists: 0 });
  }
  return { on: [...on, ...subs], strength };
}

function defending(s: Strength): number {
  return 0.85 * s.def + 0.15 * s.gk;
}

export function expectedGoals(home: Strength, away: Strength, homeForm = 0, awayForm = 0, neutral = false): [number, number] {
  const e = ENGINE;
  const adv = neutral ? 0 : e.home;
  const lh = e.base * Math.exp(
    e.attack * (home.att + homeForm - defending(away) - awayForm) + e.midfield * (home.mid - away.mid + homeForm - awayForm) + adv,
  );
  const la = e.base * Math.exp(
    e.attack * (away.att + awayForm - defending(home) - homeForm) + e.midfield * (away.mid - home.mid + awayForm - homeForm) - adv,
  );
  return [lh, la];
}

function attribute(on: OnPitch[], rng: Rng, goals: number, side: 0 | 1, out: MatchResult['goals']) {
  if (on.length === 0) return;
  for (let g = 0; g < goals; g++) {
    const sw = on.map((o) => SCORE_W[o.slot] * Math.exp((o.eff - 75) / ENGINE.starPower) * o.share);
    const scorer = on[weightedIndex(rng, sw)];
    scorer.goals++;
    let assist = -1;
    if (rng() < ENGINE.assistShare) {
      const aw = on.map((o) => (o === scorer ? 0 : ASSIST_W[o.slot] * Math.exp((o.eff - 75) / (ENGINE.starPower + 1)) * o.share));
      const a = on[weightedIndex(rng, aw)];
      a.assists++;
      assist = a.p.id;
    }
    out.push([scorer.p.id, assist, side]);
  }
}

function rate(o: OnPitch, scored: number, conceded: number, teamAvg: number, rng: Rng): number {
  const area = AREA[o.slot];
  let r = 6.4 + (scored > conceded ? 0.35 : scored < conceded ? -0.35 : 0);
  r += o.goals * 0.9 + o.assists * 0.55 + (o.eff - teamAvg) * 0.035;
  if (area === 'GK' || area === 'DEF') r += conceded === 0 ? 0.55 : -0.22 * conceded;
  if (area === 'ATT' && scored === 0) r -= 0.2;
  r += normal(rng, 0, 0.5);
  if (!o.started) r = 6.3 + (r - 6.4) * 0.6;
  return Math.round(clamp(r, 3.5, 10) * 10) / 10;
}

export function simulateMatch(home: MatchTeam, away: MatchTeam, rng: Rng, neutral = false): MatchResult {
  const h = lineUp(home, rng);
  const a = lineUp(away, rng);
  const [lh, la] = expectedGoals(
    h.strength,
    a.strength,
    (home.form ?? 0) + normal(rng, 0, ENGINE.formSd),
    (away.form ?? 0) + normal(rng, 0, ENGINE.formSd),
    neutral,
  );
  const hg = poisson(rng, lh);
  const ag = poisson(rng, la);
  const result: MatchResult = { home: home.club, away: away.club, hg, ag, goals: [], lines: [] };
  attribute(h.on, rng, hg, 0, result.goals);
  attribute(a.on, rng, ag, 1, result.goals);
  for (const [side, club, scored, conceded] of [[h, home.club, hg, ag], [a, away.club, ag, hg]] as const) {
    if (side.on.length === 0) continue;
    const avg = side.on.reduce((s, o) => s + o.eff, 0) / side.on.length;
    for (const o of side.on) {
      result.lines.push({ id: o.p.id, club, started: o.started, goals: o.goals, assists: o.assists, rating: rate(o, scored, conceded, avg, rng) });
    }
  }
  return result;
}
