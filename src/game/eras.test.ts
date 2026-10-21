import { describe, expect, it } from 'vitest';
import { BIG_SIX, CLUBS } from './clubs';
import { type Era, SEASON_YEARS } from './data';
import { autoDraft, emptySlots, playDraftSeason, startRedraft } from './draft';
import { autoSeason, endSeason, MIN_SQUAD, newGame, REAL_CLUBS, seasonLabel } from './game';
import { loadTestData } from './testData';

// The 2015 era has its own balance tests; these check every era plays.
describe.each([2010, 2020] as Era[])('the %i era', (era) => {
  it('starts with that season, its 20 clubs and full squads', async () => {
    const data = await loadTestData(era);
    const s = newGame(data, -1, 1);
    expect(SEASON_YEARS[0]).toBe(era);
    expect(seasonLabel(0)).toBe(`${era}/${String(era + 1).slice(2)}`);
    expect(data.meta.gameClubs).toHaveLength(REAL_CLUBS);
    for (const name of data.meta.gameClubs.slice(0, REAL_CLUBS)) expect(CLUBS.some((c) => c.name === name), name).toBe(true);
    for (const c of s.clubs) {
      expect(c.squad.length).toBeGreaterThanOrEqual(20);
      expect(c.squad.some((id) => s.players[id].pos.startsWith('GK'))).toBe(true);
    }
  });

  it('runs five seasons on autopilot with plausible champions', async () => {
    const data = await loadTestData(era);
    const champs: string[] = [];
    for (let r = 0; r < 4; r++) {
      const s = newGame(data, -1, 50 + r);
      for (let k = 0; k < 5; k++) {
        autoSeason(s, data);
        champs.push(data.meta.gameClubs[s.history[k].table[0].club]);
        for (const c of s.clubs) expect(c.squad.length).toBeGreaterThanOrEqual(MIN_SQUAD);
      }
      expect(s.stage).toBe('summary');
    }
    expect(champs.filter((c) => BIG_SIX.includes(c)).length / champs.length).toBeGreaterThan(0.6);
  });

  it('plays a draft career to the end', async () => {
    const data = await loadTestData(era);
    const s = newGame(data, REAL_CLUBS, 9, 'draft', '4-3-3');
    for (let k = 0; k < 5; k++) {
      autoDraft(s, data);
      while (emptySlots(s).length) {
        startRedraft(s, data, emptySlots(s)[0]);
        autoDraft(s, data);
      }
      expect(playDraftSeason(s, data)).toBeNull();
      endSeason(s, data);
    }
    expect(s.stage).toBe('summary');
    expect(s.history).toHaveLength(5);
  });
});
