import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from './data';
import {
  autoSeason, closeWindow, EXTERNAL, endSeason, type GameState, goToDeadline, MIN_SQUAD, newGame, simulate,
} from './game';
import { acceptBid, bidsFor, buyOffer } from './market';
import { loadTestData } from './testData';

let data: GameData;
beforeAll(async () => {
  data = await loadTestData();
});

function checkInvariants(s: GameState) {
  const owner = new Map<number, number>();
  for (const c of s.clubs) {
    for (const id of c.squad) {
      expect(owner.has(id), `player ${id} in two squads`).toBe(false);
      owner.set(id, c.id);
      expect(s.players[id].club).toBe(c.id);
      expect(s.players[id].retired).toBeFalsy();
    }
    expect(c.squad.length).toBeGreaterThanOrEqual(MIN_SQUAD);
  }
  for (const p of Object.values(s.players)) {
    if (p.club !== EXTERNAL) expect(owner.get(p.id)).toBe(p.club);
  }
}

describe('game flow', () => {
  it('runs five seasons on autopilot and ends at the summary', () => {
    const s = newGame(data, -1, 123);
    for (let i = 0; i < 5; i++) {
      checkInvariants(s);
      autoSeason(s, data);
    }
    expect(s.stage).toBe('summary');
    expect(s.history).toHaveLength(5);
  });

  it('is replayable from the seed', () => {
    const run = () => {
      const s = newGame(data, 3, 99);
      autoSeason(s, data);
      autoSeason(s, data);
      return s.history.map((h) => h.table.map((r) => r.pts));
    };
    expect(run()).toEqual(run());
  });

  it('lets the user buy and sell, and keeps squads consistent', () => {
    const s = newGame(data, 6, 7);
    expect(s.offers).toHaveLength(5);
    const user = s.clubs[6];
    const cash = user.cash;
    const i = s.offers.findIndex((o) => o.fee <= cash);
    expect(buyOffer(s, data, i)).toBeNull();
    expect(user.cash).toBe(cash - s.offers[i].fee);
    expect(user.squad).toContain(s.offers[i].player);

    const seller = user.squad[user.squad.length - 1];
    const bids = bidsFor(s, data, seller);
    expect(bids.length).toBeGreaterThan(0);
    expect(acceptBid(s, data, seller, bids[0])).toBeNull();
    expect(user.squad).not.toContain(seller);
    goToDeadline(s, data);
    closeWindow(s, data);
    checkInvariants(s);
    expect(s.stage).toBe('lineup');
    simulate(s, data);
    expect(s.history[0].userStats.length).toBeGreaterThan(11);
    endSeason(s, data);
    expect(s.season).toBe(1);
    expect(s.devReport.length).toBeGreaterThan(0);
    checkInvariants(s);
  });

  it('develops players around their real next-season rating', () => {
    const s = newGame(data, -1, 5);
    autoSeason(s, data);
    let n = 0, sum = 0, sumSq = 0;
    for (const p of Object.values(s.players)) {
      const real = data.seasons[1][p.id];
      if (!real || p.retired || !data.seasons[0][p.id]) continue;
      const d = p.ovr - real[0];
      n++; sum += d; sumSq += d * d;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.3);
    expect(sd).toBeGreaterThan(1.8);
    expect(sd).toBeLessThan(3.5);
  });
});
