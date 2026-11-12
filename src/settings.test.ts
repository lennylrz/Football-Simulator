import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, roomRulesOf, roomSettings } from './settings';

describe('room settings', () => {
  it("gives the guest the host's draft and season settings, but keeps their own motion setting", () => {
    const host = { ...DEFAULT_SETTINGS, hiddenRatings: true, pickTimer: 20, choices: 3, redrafts: 0, bench: 5, matchSpeed: 'instant' as const };
    const guest = { ...DEFAULT_SETTINGS, reduceMotion: true };
    expect(roomSettings(guest, roomRulesOf(host))).toEqual({ ...host, reduceMotion: true });
  });

  it("keeps a guest's own draft settings for rooms made before they were shared", () => {
    const guest = { ...DEFAULT_SETTINGS, pickTimer: 30 };
    expect(roomSettings(guest, { redrafts: 1, choices: 4 })).toEqual({ ...guest, redrafts: 1, choices: 4, bench: 3 });
  });
});
