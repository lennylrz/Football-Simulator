import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from './data';
import { autoDraft, emptySlots, pickCandidate, playDraftSeason, startRedraft } from './draft';
import { endSeason, type GameState, newGame, REAL_CLUBS, trophiesOf } from './game';
import { loadTestData } from './testData';

let data: GameData;
beforeAll(async () => {
  data = await loadTestData();
});

function run(seed: number, choose?: (s: GameState) => (ids: number[]) => number): GameState {
  const s = newGame(data, REAL_CLUBS, seed, 'draft', '4-3-3');
  for (let k = 0; k < 5; k++) {
    autoDraft(s, data, choose?.(s));
    while (emptySlots(s).length) {
      startRedraft(s, data, emptySlots(s)[0]);
      autoDraft(s, data, choose?.(s));
    }
    expect(playDraftSeason(s, data)).toBeNull();
    endSeason(s, data);
  }
  return s;
}

describe('draft mode', () => {
  it('drafts an XI as the 21st club and plays five seasons', () => {
    const s = newGame(data, REAL_CLUBS, 3, 'draft', '4-3-3');
    expect(s.user).toBe(REAL_CLUBS);
    expect(s.clubs).toHaveLength(21);
    expect(s.stage).toBe('draft');
    // Attack is picked first.
    expect(s.draft!.slot).toBe(9);
    expect(s.draft!.candidates).toHaveLength(5);
    expect(new Set(s.draft!.candidates).size).toBe(5);
    autoDraft(s, data);
    expect(s.stage).toBe('summer');
    expect(s.clubs[s.user].xi.every((id) => id >= 0)).toBe(true);
    expect(s.clubs[s.user].bench).toHaveLength(5);
    expect(playDraftSeason(s, data)).toBeNull();
    const h = s.history[0];
    expect(h.table).toHaveLength(21);
    expect(h.table.every((r) => r.p === 40)).toBe(true);
    endSeason(s, data);
    expect(s.stage).toBe('summer');
    expect(s.draft!.redraftsLeft).toBe(3);
    expect(s.draft!.reveal.length).toBeGreaterThan(8);
  });

  it('lets the user gamble on three re-drafts a summer', () => {
    const s = newGame(data, REAL_CLUBS, 4, 'draft', '4-4-2');
    autoDraft(s, data);
    playDraftSeason(s, data);
    endSeason(s, data);
    const before = s.clubs[s.user].xi[0];
    expect(startRedraft(s, data, 0)).toBeNull();
    expect(s.clubs[s.user].xi[0]).toBe(-1);
    expect(s.players[before].club).not.toBe(s.user);
    expect(pickCandidate(s, data, s.draft!.candidates[2])).toBeNull();
    startRedraft(s, data, 1); pickCandidate(s, data, s.draft!.candidates[0]);
    startRedraft(s, data, 2); pickCandidate(s, data, s.draft!.candidates[0]);
    expect(startRedraft(s, data, 3)).not.toBeNull();
  });

  it('makes a title possible but the treble rare for a strong draft', () => {
    let titles = 0;
    let trebles = 0;
    let seasons = 0;
    for (let seed = 0; seed < 12; seed++) {
      const s = run(100 + seed);
      for (const h of s.history) {
        seasons++;
        const t = trophiesOf(h, s.user);
        if (t.includes('league')) titles++;
        if (t.length === 3) trebles++;
      }
    }
    console.log(JSON.stringify({ seasons, titles, trebles }));
    expect(titles / seasons).toBeLessThan(0.6);
    expect(trebles / seasons).toBeLessThan(0.1);
  });
});
