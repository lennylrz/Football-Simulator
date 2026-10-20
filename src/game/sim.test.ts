import { describe, expect, it } from 'vitest';
import { formBoost } from './development';
import { autoLineup, pickXI, type PlayerLite } from './lineup';
import { effectiveRating, FORMATIONS } from './positions';
import { mulberry32 } from './rng';
import { fixtures, simulateSeason, type SeasonTeam } from './season';

const p = (id: number, ovr: number, ...pos: string[]): PlayerLite => ({ id, ovr, pos: pos as PlayerLite['pos'] });

function squad(base: number, idOffset: number): PlayerLite[] {
  const spec = ['GK', 'GK', 'CB', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST', 'CB'];
  return spec.map((pos, i) => p(idOffset + i, base - (i % 3), pos));
}

describe('positions', () => {
  it('penalises players out of position', () => {
    expect(effectiveRating(80, ['ST'], 'ST')).toBe(80);
    expect(effectiveRating(80, ['ST'], 'CF')).toBeLessThan(80);
    expect(effectiveRating(80, ['ST'], 'CB')).toBeLessThan(effectiveRating(80, ['ST'], 'CAM'));
    expect(effectiveRating(80, ['CB'], 'GK')).toBeLessThan(30);
  });

  it('puts players in their own positions when possible', () => {
    const players = squad(80, 0);
    const xi = pickXI(players, '4-4-2');
    const slots = FORMATIONS['4-4-2'];
    const byId = new Map(players.map((x) => [x.id, x]));
    xi.forEach((id, i) => expect(byId.get(id)!.pos).toContain(slots[i]));
  });

  it('auto lineup fills 11 distinct slots and a bench with a keeper', () => {
    const lu = autoLineup(squad(78, 0));
    expect(new Set(lu.xi).size).toBe(11);
    expect(lu.bench).toHaveLength(5);
    expect(lu.bench.some((id) => id === 0 || id === 1)).toBe(true);
  });
});

describe('fixtures', () => {
  it('is a valid double round robin', () => {
    const clubs = Array.from({ length: 20 }, (_, i) => i);
    const rounds = fixtures(clubs, mulberry32(7));
    expect(rounds).toHaveLength(38);
    const pairs = new Set<string>();
    for (const round of rounds) {
      const seen = new Set<number>();
      for (const [h, a] of round) {
        expect(seen.has(h) || seen.has(a)).toBe(false);
        seen.add(h);
        seen.add(a);
        pairs.add(`${h}-${a}`);
      }
      expect(seen.size).toBe(20);
    }
    expect(pairs.size).toBe(380);
  });
});

describe('season', () => {
  const teams: SeasonTeam[] = Array.from({ length: 20 }, (_, c) => {
    const players = squad(70 + c * 0.5, c * 100);
    const lu = autoLineup(players);
    const byId = new Map(players.map((x) => [x.id, x]));
    return { club: c, formation: lu.formation, xi: lu.xi.map((i) => byId.get(i)!), bench: lu.bench.map((i) => byId.get(i)!) };
  });

  it('is deterministic for a seed', () => {
    const a = simulateSeason(teams, mulberry32(42));
    const b = simulateSeason(teams, mulberry32(42));
    expect(a.table).toEqual(b.table);
    expect(a.rounds).toEqual(b.rounds);
  });

  it('keeps the books consistent', () => {
    const r = simulateSeason(teams, mulberry32(1));
    const goals = r.table.reduce((s, t) => s + t.gf, 0);
    expect(goals).toBe(r.table.reduce((s, t) => s + t.ga, 0));
    expect(r.table.every((t) => t.p === 38 && t.w + t.d + t.l === 38)).toBe(true);
    expect(r.stats.reduce((s, x) => s + x.goals, 0)).toBe(goals);
    const ratings = r.stats.map((x) => x.ratingSum / x.apps);
    expect(Math.min(...ratings)).toBeGreaterThan(4);
    expect(Math.max(...ratings)).toBeLessThan(9);
  });
});

describe('development', () => {
  it('rewards a great season and punishes a poor one, most of all for the young', () => {
    expect(formBoost({ age: 22, ovr: 80 }, { avg: 7.5, apps: 38 })).toBeGreaterThan(3);
    expect(formBoost({ age: 27, ovr: 80 }, { avg: 7.5, apps: 38 })).toBeCloseTo(3);
    expect(formBoost({ age: 27, ovr: 80 }, { avg: 6.2, apps: 38 })).toBeLessThan(-1.5);
    expect(formBoost({ age: 27, ovr: 80 }, { avg: 7.5, apps: 3 })).toBe(0);
    expect(formBoost({ age: 27, ovr: 90 }, { avg: 7.5, apps: 38 })).toBeLessThan(2);
    // Judged against team-mates: an average player in a weak side keeps his rating.
    const weak = { team: 6.3, league: 6.6, apps: 38 };
    expect(Math.abs(formBoost({ age: 27, ovr: 75 }, { ...weak, avg: 6.3 }))).toBeLessThan(0.7);
    expect(formBoost({ age: 22, ovr: 80 }, { ...weak, avg: 7.2 })).toBeGreaterThan(3);
  });
});
