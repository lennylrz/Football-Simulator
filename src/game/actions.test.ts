import { beforeAll, describe, expect, it } from 'vitest';
import { type Action, applyAction, GUEST, HOST, newRoomGame, viewFor } from './actions';
import type { GameData } from './data';
import { emptySlots } from './draft';
import { asUser, type GameState } from './game';
import { loadTestData } from './testData';

let data: GameData;
beforeAll(async () => {
  data = await loadTestData();
});

const host = { club: { name: 'Host FC', short: 'Host', code: 'HOS', primary: '#123456', secondary: '#ffffff', rep: 72, budget: 0 }, formation: '4-3-3' as const };
const guest = { club: { name: 'Host FC', short: 'Guest', code: 'GUE', primary: '#654321', secondary: '#ffffff', rep: 72, budget: 0 }, formation: '4-4-2' as const };

type Logged = [number, Action];

/** Plays a room to the end, interleaving the managers, and returns the log. */
function playRoom(seed: number, check?: (s: GameState) => void): { state: GameState; log: Logged[] } {
  const s = newRoomGame(data, seed, { redrafts: 2, choices: 5 }, host, guest);
  const log: Logged[] = [];
  const act = (club: number, a: Action) => {
    log.push([club, a]);
    return applyAction(s, data, club, a);
  };
  const best = (ids: number[]) => ids.reduce((a, b) => (s.players[b].ovr > s.players[a].ovr ? b : a));
  for (let season = 0; season < 5; season++) {
    // Take turns until both have a full team.
    for (let guard = 0; guard < 200; guard++) {
      let moved = false;
      for (const club of [HOST, GUEST]) {
        const v = viewFor(s, club);
        if (v.draft?.slot !== null && v.draft?.slot !== undefined) {
          check?.(s);
          expect(act(club, { t: 'pick', player: best(v.draft.candidates) })).toBeNull();
          moved = true;
        } else {
          const empty = asUser(s, club, () => emptySlots(s));
          if (empty.length) {
            expect(act(club, { t: 'redraft', slot: empty[0] })).toBeNull();
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    expect(act(HOST, { t: 'simulate' })).toBe('Both managers must be ready.');
    expect(act(HOST, { t: 'ready', on: true })).toBeNull();
    expect(act(GUEST, { t: 'simulate' })).toBe('Only the host can play the season.');
    expect(act(GUEST, { t: 'ready', on: true })).toBeNull();
    expect(act(HOST, { t: 'simulate' })).toBeNull();
    expect(s.stage).toBe('results');
    expect(act(HOST, { t: 'continue' })).toBeNull();
    expect(s.season).toBe(season); // waits for the guest
    expect(act(GUEST, { t: 'continue' })).toBeNull();
    if (season < 4 && season === 1) {
      // A summer re-draft by each manager.
      expect(act(HOST, { t: 'redraft', slot: 0 })).toBeNull();
      expect(act(GUEST, { t: 'redraft', slot: 3 })).toBeNull();
    }
  }
  return { state: s, log };
}

describe('two-player rooms', () => {
  it('lets both managers draft, never offering them the same player, and plays five seasons', () => {
    const { state } = playRoom(77, (s) => {
      const a = new Set([...s.clubs[HOST].squad, ...(s.mp!.views[HOST].draft?.candidates ?? [])]);
      for (const id of [...s.clubs[GUEST].squad, ...(s.mp!.views[GUEST].draft?.candidates ?? [])]) expect(a.has(id)).toBe(false);
    });
    expect(state.stage).toBe('summary');
    expect(state.history).toHaveLength(5);
    expect(state.clubs).toHaveLength(22);
    expect(data.meta.gameClubs[GUEST]).toBe('Host FC 2');
    for (const h of state.history) {
      expect(h.table).toHaveLength(22);
      expect(h.byUser![HOST].userStats.length).toBeGreaterThan(10);
      expect(h.byUser![GUEST].userStats.length).toBeGreaterThan(10);
    }
    // Each manager sees his own stats.
    expect(viewFor(state, GUEST).history[0].userStats.every((x) => x.club === GUEST)).toBe(true);
  });

  it('replays the same log to the same game', () => {
    const { state, log } = playRoom(78);
    const replay = newRoomGame(data, 78, { redrafts: 2, choices: 5 }, host, guest);
    for (const [club, a] of log) applyAction(replay, data, club, a);
    expect(JSON.stringify(replay)).toBe(JSON.stringify(state));
  });
});
