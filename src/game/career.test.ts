import { describe, expect, it } from 'vitest';
import { career } from './career';
import { closeWindow, endSeason, newGame, simulate } from './game';
import { acceptIncomingBid, buyOffer } from './market';
import { loadTestData } from './testData';

describe('career', () => {
  it('summarises a run: finishes, trophies, players, signings and money', async () => {
    const data = await loadTestData();
    const s = newGame(data, 8, 2024);
    let bought = 0;
    let sold = 0;
    for (let k = 0; k < 5; k++) {
      s.offers.forEach((o, i) => {
        if (o.fee <= s.clubs[8].cash && buyOffer(s, data, i) === null) bought += o.fee;
      });
      const bid = s.bids[0];
      if (bid && acceptIncomingBid(s, data, 0) === null) sold += bid.fee;
      closeWindow(s, data);
      simulate(s, data);
      endSeason(s, data);
    }
    const c = career(s);
    expect(c.seasons).toHaveLength(5);
    expect(c.seasons.every((x) => x.finish >= 1 && x.finish <= 20)).toBe(true);
    const counted = c.seasons.reduce((n, x) => n + x.trophies.length, 0);
    expect(c.trophies.league + c.trophies.fa + c.trophies.cl).toBe(counted);
    expect(c.spent).toBe(bought);
    expect(c.earned).toBe(sold);
    expect(c.playerOfCareer).not.toBeNull();
    expect(c.playerOfCareer!.apps).toBeGreaterThanOrEqual(15);
    expect(c.bestSigning).not.toBeNull();
    expect(c.worstSigning!.score).toBeLessThanOrEqual(c.bestSigning!.score);
    expect(c.bestRated[0].avg).toBeGreaterThanOrEqual(c.bestRated[c.bestRated.length - 1].avg);
  });
});
