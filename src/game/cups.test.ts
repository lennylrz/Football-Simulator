import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from './data';
import { closeWindow, newGame, simulate, trophiesOf } from './game';
import { loadTestData } from './testData';

let data: GameData;
beforeAll(async () => {
  data = await loadTestData();
});

describe('cups', () => {
  it('plays a full FA Cup and Champions League each season', () => {
    const s = newGame(data, 3, 11);
    closeWindow(s, data);
    simulate(s, data);
    const r = s.result!;
    expect(r.fa.matches).toHaveLength(63);
    expect(r.cl.matches).toHaveLength(96 + 8 * 2 + 4 * 2 + 2 * 2 + 1);
    expect(Object.keys(r.cl.reached)).toHaveLength(4);
    expect(Object.keys(r.fa.reached)).toHaveLength(20);
    // A club knocked out plays no later rounds.
    const user = 3;
    const userFa = r.fa.matches.filter((m) => m.home === user || m.away === user);
    const out = userFa[userFa.length - 1];
    if (r.fa.winner !== user) {
      const lost = out.hg !== out.ag ? (out.home === user ? out.hg < out.ag : out.ag < out.hg) : (out.home === user) === (out.pens === 1);
      expect(lost).toBe(true);
    }
  });

  it('makes the treble hard even for the strongest side', () => {
    // The same 2015/16 squads after one AI window, replayed with many seeds.
    const SEASONS = 400;
    const trebles: Record<number, number> = {};
    const s = newGame(data, -1, 20_000);
    closeWindow(s, data);
    for (let i = 0; i < SEASONS; i++) {
      s.seed = 20_000 + i;
      s.history = [];
      simulate(s, data);
      const h = s.history[0];
      for (const c of s.clubs) if (trophiesOf(h, c.id).length === 3) trebles[c.id] = (trebles[c.id] ?? 0) + 1;
    }
    const city = data.meta.gameClubs.indexOf('Manchester City');
    const everton = data.meta.gameClubs.indexOf('Everton');
    expect((trebles[city] ?? 0) / SEASONS).toBeLessThan(0.06);
    expect(trebles[everton] ?? 0).toBe(0);
    const total = Object.values(trebles).reduce((a, b) => a + b, 0);
    expect(total / SEASONS).toBeLessThan(0.08);
  });
});
