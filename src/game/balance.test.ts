// Balancing: simulate many seasons with no user input and check the results
// look like real Premier League seasons (2010s averages: champion ~87 pts,
// bottom ~25 pts, ~2.7 goals a match, ~46% home wins, golden boot ~25).
import { beforeAll, describe, expect, it } from 'vitest';
import { BIG_SIX as BIG_SIX_CLUBS } from './clubs';
import { autoSeason, newGame, trophiesOf } from './game';
import type { GameData } from './data';
import { autoLineup, type PlayerLite } from './lineup';
import { parsePositions } from './positions';
import { mulberry32 } from './rng';
import { type SeasonResult, type SeasonTeam, simulateSeason } from './season';
import { loadTestData } from './testData';

const BIG_SIX = BIG_SIX_CLUBS;

interface Summary {
  seasons: number;
  champions: string[];
  championPts: number;
  lastPts: number;
  goalsPerMatch: number;
  homeWins: number;
  draws: number;
  topScorer: number;
  topAssister: number;
}

export function summarise(results: SeasonResult[], clubNames: string[]): Summary {
  let goals = 0, matches = 0, homeWins = 0, draws = 0, top = 0, topA = 0, champ = 0, last = 0;
  for (const r of results) {
    champ += r.table[0].pts;
    last += r.table[r.table.length - 1].pts;
    for (const round of r.rounds) {
      for (const [, , hg, ag] of round) {
        goals += hg + ag;
        matches++;
        if (hg > ag) homeWins++;
        if (hg === ag) draws++;
      }
    }
    top += Math.max(...r.stats.map((s) => s.goals));
    topA += Math.max(...r.stats.map((s) => s.assists));
  }
  const n = results.length;
  return {
    seasons: n,
    champions: results.map((r) => clubNames[r.table[0].club]),
    championPts: champ / n,
    lastPts: last / n,
    goalsPerMatch: goals / matches,
    homeWins: homeWins / matches,
    draws: draws / matches,
    topScorer: top / n,
    topAssister: topA / n,
  };
}

export function expectPlausible(s: Summary) {
  const bigSixRate = s.champions.filter((c) => BIG_SIX.includes(c)).length / s.seasons;
  // The strongest squads win the league; a mid-table title is a near-miracle.
  expect(bigSixRate).toBeGreaterThan(0.9);
  expect(s.championPts).toBeGreaterThan(80);
  expect(s.championPts).toBeLessThan(96);
  expect(s.lastPts).toBeGreaterThan(17);
  expect(s.lastPts).toBeLessThan(34);
  expect(s.goalsPerMatch).toBeGreaterThan(2.5);
  expect(s.goalsPerMatch).toBeLessThan(3.0);
  expect(s.homeWins).toBeGreaterThan(0.41);
  expect(s.homeWins).toBeLessThan(0.51);
  expect(s.draws).toBeGreaterThan(0.19);
  expect(s.draws).toBeLessThan(0.3);
  expect(s.topScorer).toBeGreaterThan(20);
  expect(s.topScorer).toBeLessThan(32);
  expect(s.topAssister).toBeGreaterThan(9);
  expect(s.topAssister).toBeLessThan(20);
}

describe('balance: 2015/16 squads', () => {
  let data: GameData;
  let teams: SeasonTeam[];
  beforeAll(async () => {
    data = await loadTestData();
    teams = data.meta.gameClubs.map((name, club) => {
      const players: PlayerLite[] = data.squads[name].map((id) => {
        const r = data.seasons[0][id];
        return { id, ovr: r[0], pos: parsePositions(r[5]) };
      });
      const lu = autoLineup(players);
      const byId = new Map(players.map((p) => [p.id, p]));
      return { club, formation: lu.formation, xi: lu.xi.map((i) => byId.get(i)!), bench: lu.bench.map((i) => byId.get(i)!) };
    });
  });

  it('300 seasons look like real Premier League seasons', () => {
    const results = Array.from({ length: 300 }, (_, i) => simulateSeason(teams, mulberry32(1000 + i)));
    const s = summarise(results, data.meta.gameClubs);
    console.log(JSON.stringify({ ...s, champions: undefined }));
    expectPlausible(s);
  });
});

describe('balance: full five-season runs with AI transfers and cups', () => {
  it('stays plausible season after season, with rare trebles and slow climbers', async () => {
    const data = await loadTestData();
    const RUNS = 16;
    const bySeason: SeasonResult[][] = [[], [], [], [], []];
    let trebles = 0;
    let englishCl = 0;
    let eliteToSmall = 0;
    const repGain: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const s = newGame(data, -1, 777 + r);
      const start = s.clubs.map((c) => c.rep);
      for (let k = 0; k < 5; k++) {
        autoSeason(s, data);
        const h = s.history[k];
        bySeason[k].push({ table: h.table, rounds: [], scorers: [], stats: [] });
        if (typeof h.clWinner === 'number') englishCl++;
        if (s.clubs.some((c) => trophiesOf(h, c.id).length === 3)) trebles++;
      }
      for (const t of s.transfers) {
        if (t.to >= 0 && t.ovr >= 86 && !BIG_SIX.includes(data.meta.gameClubs[t.to])) eliteToSmall++;
      }
      s.clubs.forEach((c, i) => {
        if (!BIG_SIX.includes(data.meta.gameClubs[i])) repGain.push(c.rep - start[i]);
      });
    }
    const seasons = RUNS * 5;
    for (let k = 0; k < 5; k++) {
      const champs = bySeason[k].map((r) => data.meta.gameClubs[r.table[0].club]);
      const big = champs.filter((c) => BIG_SIX.includes(c)).length / champs.length;
      expect(big, `season ${k + 1} champions`).toBeGreaterThan(0.75);
      const pts = bySeason[k].reduce((a, r) => a + r.table[0].pts, 0) / RUNS;
      expect(pts).toBeGreaterThan(80);
      expect(pts).toBeLessThan(100);
    }
    // English clubs won 1 of 5 Champions Leagues 2015/16-2019/20.
    expect(englishCl / seasons).toBeGreaterThan(0.05);
    expect(englishCl / seasons).toBeLessThan(0.4);
    // The treble should be very rare.
    expect(trebles / seasons).toBeLessThan(0.05);
    // A club outside the big six signing an 86+ player is extremely unlikely.
    expect(eliteToSmall / RUNS).toBeLessThan(0.5);
    // Reputation moves slowly: no club outside the big six jumps 25 points in five years.
    expect(Math.max(...repGain)).toBeLessThan(25);
  });
});
