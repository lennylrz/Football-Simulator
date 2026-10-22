import { describe, expect, it } from 'vitest';
import type { Era } from './data';
import { GOAT_CEILING, GOATS, NEAR_CEILING, NEYMAR } from './development';
import { autoSeason, newGame } from './game';
import { loadTestData } from './testData';

// Messi and Ronaldo: the two exceptions.
describe.each([2010, 2015] as Era[])('Messi and Ronaldo in the %i era', (era) => {
  it('nearly always make the Ballon d\'Or podium, and usually win it', async () => {
    const data = await loadTestData(era);
    let podiums = 0;
    let seats = 0;
    let wins = 0;
    let both = 0;
    for (let r = 0; r < 4; r++) {
      const s = newGame(data, -1, 300 + r);
      for (let k = 0; k < 5; k++) {
        autoSeason(s, data);
        const top = s.history[k].ballon!.map((e) => e.player);
        const n = top.filter((id) => GOATS.has(id)).length;
        podiums += 1;
        seats += n;
        if (GOATS.has(top[0])) wins++;
        if (n === 2) both++;
      }
    }
    expect(seats / podiums).toBeGreaterThan(1.6);
    expect(both / podiums).toBeGreaterThan(0.6);
    expect(wins / podiums).toBeGreaterThan(0.7);
  });

  it('can grow to 98, and no one else is given that ceiling', async () => {
    const data = await loadTestData(era);
    const s = newGame(data, -1, 7);
    for (const id of GOATS) if (s.players[id].age <= 31) expect(s.players[id].pot).toBe(GOAT_CEILING);
    let best = 0;
    for (let k = 0; k < 5; k++) {
      autoSeason(s, data);
      for (const id of GOATS) best = Math.max(best, s.players[id].ovr);
    }
    expect(best).toBeGreaterThanOrEqual(era === 2010 ? 95 : 94);
    expect(best).toBeLessThanOrEqual(GOAT_CEILING);
  });
});

describe('the very top', () => {
  it('is Messi, Ronaldo and Neymar\'s; everyone else finds 92 hard to reach', async () => {
    const data = await loadTestData(2015);
    let neymar = 0;
    let others = 0;
    const RUNS = 4;
    for (let r = 0; r < RUNS; r++) {
      const s = newGame(data, -1, 40 + r);
      expect(s.players[NEYMAR].pot).toBe(NEAR_CEILING);
      let peak = 0;
      for (let k = 0; k < 5; k++) {
        autoSeason(s, data);
        peak = Math.max(peak, s.players[NEYMAR].ovr);
        expect(s.players[NEYMAR].ovr).toBeLessThanOrEqual(NEAR_CEILING);
      }
      if (peak >= 93) neymar++;
      others += Object.values(s.players).filter((p) => !p.retired && p.ovr >= 92 && !GOATS.has(p.id) && p.id !== NEYMAR).length;
    }
    expect(neymar).toBeGreaterThanOrEqual(RUNS - 1);
    // The 2015 era's best (De Bruyne, Hazard, Kane, Salah...) mostly stop short of 92.
    expect(others / RUNS).toBeLessThan(2.5);
  });
});
