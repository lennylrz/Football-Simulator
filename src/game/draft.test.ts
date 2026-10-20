import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from './data';
import { autoDraft, chooseSlot, emptySlots, fits, pickCandidate, playDraftSeason, startRedraft } from './draft';
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
    expect(s.draft!.redraftsLeft).toBe(2);
    expect(s.draft!.reveal.length).toBeGreaterThan(8);
  });

  it('lets the user gamble on the re-drafts the rules allow', () => {
    const s = newGame(data, REAL_CLUBS, 4, 'draft', '4-4-2', undefined, { redrafts: 3, choices: 3 });
    expect(s.draft!.candidates).toHaveLength(3);
    autoDraft(s, data);
    playDraftSeason(s, data);
    endSeason(s, data);
    const before = s.clubs[s.user].xi[0];
    expect(startRedraft(s, data, 0)).toBeNull();
    expect(s.clubs[s.user].xi[0]).toBe(-1);
    expect(s.players[before].club).not.toBe(s.user);
    expect(s.draft!.candidates).toHaveLength(3);
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

describe('draft rules', () => {
  it('offers candidates in their main position only', () => {
    for (let seed = 0; seed < 5; seed++) {
      const s = newGame(data, REAL_CLUBS, 40 + seed, 'draft', '4-3-3');
      const slots = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CDM', 'CM', 'LW', 'ST', 'RW'];
      while (s.draft!.slot !== null) {
        const slot = slots[s.draft!.slot];
        for (const id of s.draft!.candidates) expect(fits(s.players[id], slot as never), `${s.players[id].pos} at ${slot}`).toBe(true);
        pickCandidate(s, data, s.draft!.candidates[0]);
      }
    }
  });

  it('lets the user choose the order of the opening draft without re-rolling', () => {
    const s = newGame(data, REAL_CLUBS, 8, 'draft', '4-3-3');
    const first = s.draft!.candidates.slice();
    expect(chooseSlot(s, data, 0)).toBeNull();
    expect(s.draft!.slot).toBe(0);
    const keepers = s.draft!.candidates.slice();
    expect(chooseSlot(s, data, 9)).toBeNull();
    expect(s.draft!.candidates).toEqual(first);
    pickCandidate(s, data, first[0]);
    expect(chooseSlot(s, data, 9)).not.toBeNull();
    expect(chooseSlot(s, data, 0)).toBeNull();
    expect(s.draft!.candidates).toEqual(keepers);
    pickCandidate(s, data, keepers[0]);
    expect(s.clubs[s.user].xi[0]).toBe(keepers[0]);
    autoDraft(s, data);
    expect(s.stage).toBe('summer');
  });

  it('allows one re-draft per position each summer', () => {
    const s = newGame(data, REAL_CLUBS, 9, 'draft', '4-3-3', undefined, { redrafts: 3, choices: 5 });
    autoDraft(s, data);
    playDraftSeason(s, data);
    endSeason(s, data);
    expect(startRedraft(s, data, 4)).toBeNull();
    pickCandidate(s, data, s.draft!.candidates[0]);
    expect(startRedraft(s, data, 4)).not.toBeNull();
    expect(startRedraft(s, data, 5)).toBeNull();
  });

  it('steers recent careers\' players away from the draw', () => {
    const a = newGame(data, REAL_CLUBS, 11, 'draft', '4-3-3');
    autoDraft(a, data);
    const seen = a.draft!.shown!;
    const b = newGame(data, REAL_CLUBS, 11, 'draft', '4-3-3', undefined, undefined, seen);
    autoDraft(b, data);
    const again = b.draft!.shown!.filter((id) => seen.includes(id)).length;
    expect(again / b.draft!.shown!.length).toBeLessThan(0.2);
  });
});
