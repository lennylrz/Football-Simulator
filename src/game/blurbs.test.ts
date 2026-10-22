import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPECIAL } from './blurbData';
import { ALL_ARCHETYPES, ALL_ARCS, type BlurbInput, playerBlurb } from './blurbs';
import type { Row } from './data';

const ERAS = [2010, 2015, 2020];
const read = (era: number, file: string) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', String(era), file), 'utf8'));
const BANNED = [/no growth/i, /\bfinished\b/i, /past it/i, /past his best/i, /washed/i, /over the hill/i, /declin/i, /useless/i, /undefined/, /NaN/, /\{s\}/];

/** A deterministic spread of 100 players from each era's first season. */
function sample(): BlurbInput[] {
  const out: BlurbInput[] = [];
  for (const era of ERAS) {
    const names: Record<string, [string, string]> = read(era, 'players.json');
    const clubs: string[] = read(era, 'meta.json').clubNames;
    const season: Record<string, Row> = read(era, `season_${era}.json`);
    const ids = Object.keys(season).sort();
    const step = Math.floor(ids.length / 100);
    for (let i = 0; i < 100; i++) {
      const id = ids[i * step];
      const [ovr, pot, age, value, , pos, club] = season[id];
      out.push({ id: +id, era, name: names[id][0], nation: names[id][1], pos, age, ovr, pot, value, club: clubs[club] });
    }
  }
  return out;
}

describe('hand-written blurbs', () => {
  it('name real players of their era, with sensible copy', () => {
    for (const era of ERAS) {
      const names: Record<string, [string, string]> = read(era, 'players.json');
      const stars = Object.entries(SPECIAL[era]);
      expect(stars.length).toBeGreaterThanOrEqual(25);
      for (const [id, s] of stars) {
        expect(names[id]?.[0], `${era} ${id}`).toBe(s.name);
        for (const [kicker, text] of s.v) {
          expect(kicker).toBe(kicker.toUpperCase());
          expect(text.length, text).toBeLessThanOrEqual(210);
          expect(text, 'spell numbers out').not.toMatch(/\d/);
          for (const b of BANNED) expect(text).not.toMatch(b);
        }
      }
    }
  });

  it('give Messi and Ronaldo several variants in every era', () => {
    for (const era of ERAS) {
      expect(SPECIAL[era][158023].v.length).toBeGreaterThanOrEqual(3);
      expect(SPECIAL[era][20801].v.length).toBeGreaterThanOrEqual(3);
      const kickers = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((seed) => playerBlurb({
        id: 158023, era, name: 'L. Messi', nation: 'Argentina', pos: 'RW', age: 28, ovr: 94, pot: 94, value: 1, seed,
      }).kicker));
      expect(kickers.size).toBeGreaterThan(1);
    }
  });
});

describe('generated blurbs', () => {
  const players = sample().filter((p) => !SPECIAL[p.era][p.id]);

  it('read cleanly and never sound dismissive', () => {
    for (const hidden of [false, true]) {
      for (const p of players) {
        const b = playerBlurb({ ...p, hidden });
        expect(b.special).toBe(false);
        expect(b.kicker.length).toBeGreaterThan(0);
        expect(b.text.length).toBeGreaterThan(40);
        expect(b.text.length).toBeLessThanOrEqual(260);
        for (const bad of BANNED) {
          expect(b.text, `${p.name}: ${b.text}`).not.toMatch(bad);
          expect(b.kicker).not.toMatch(bad);
        }
      }
    }
  });

  it('never leak ratings in hidden mode', () => {
    for (const p of players) {
      const b = playerBlurb({ ...p, hidden: true });
      const numbers = b.text.replace(p.club ?? '', '').match(/\d+/g) ?? [];
      for (const n of numbers) expect(n, b.text).toBe(String(p.age));
      expect(b.text).not.toMatch(/€/);
      for (const k of ['WORLD CLASS', 'THE REAL DEAL', 'TOP DRAWER', 'WONDERKID ALERT', 'ONE FOR THE FUTURE', 'THE NEXT BIG THING']) {
        expect(b.kicker).not.toBe(k);
      }
    }
  });

  it('are stable per player and seed, and varied across players', () => {
    const p = players[0];
    expect(playerBlurb(p)).toEqual(playerBlurb(p));
    const texts = new Set(players.map((q) => playerBlurb(q).text));
    expect(texts.size).toBeGreaterThan(players.length * 0.95);
    const kickers = new Set(players.map((q) => playerBlurb(q).kicker));
    expect(kickers.size).toBeGreaterThan(40);
    const seeds = new Set([1, 2, 3, 4, 5, 6].map((seed) => playerBlurb({ ...p, seed }).text));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('use banned words nowhere in the phrase banks', () => {
    const lines = [...Object.values(ALL_ARCHETYPES).flat().flatMap((a) => [...a.lines, ...a.kicker]), ...Object.values(ALL_ARCS).flat()];
    for (const l of lines) for (const b of BANNED.slice(0, 8)) expect(l).not.toMatch(b);
  });
});
