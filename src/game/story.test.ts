import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from './data';
import { autoDraft, emptySlots, playDraftSeason, startRedraft } from './draft';
import { autoSeason, endSeason, type GameState, newGame, REAL_CLUBS } from './game';
import { factsAsked, MAX_LINE } from './story';
import { STYLE_ORDER } from './styles';
import { loadTestData } from './testData';

let data: GameData;
beforeAll(async () => {
  data = await loadTestData();
});

/** Five drafted seasons with one play style; each season's story. */
function draftCareer(seed: number, style = STYLE_ORDER[seed % STYLE_ORDER.length]): string[][] {
  const s = newGame(data, REAL_CLUBS, seed, 'draft', '4-3-3');
  const out: string[][] = [];
  for (let k = 0; k < 5; k++) {
    autoDraft(s, data);
    while (emptySlots(s).length) {
      startRedraft(s, data, emptySlots(s)[0]);
      autoDraft(s, data);
    }
    s.clubs[s.user].style = style;
    expect(playDraftSeason(s, data)).toBeNull();
    out.push(s.history[k].story ?? []);
    endSeason(s, data);
  }
  return out;
}

/** Five seasons managing a real club on autopilot. */
function clubCareer(seed: number, club: number): string[][] {
  const s: GameState = newGame(data, club, seed);
  for (let k = 0; k < 5; k++) autoSeason(s, data);
  return s.history.map((h) => h.story ?? []);
}

describe('season story', () => {
  it('is short, well formed and rarely repeats itself', () => {
    const careers = [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => draftCareer(700 + i)),
      ...[0, 1, 2, 3].map((i) => clubCareer(800 + i, i * 5)),
    ];
    const all = careers.flat();
    expect(all.length).toBe(60);
    for (const story of all) {
      expect(story.length).toBeGreaterThanOrEqual(3);
      expect(story.length).toBeLessThanOrEqual(5);
      for (const line of story) {
        expect(line).not.toMatch(/undefined|NaN|\{|\}|\[|\]|\bnull\b/);
        expect(line.length).toBeLessThanOrEqual(MAX_LINE);
        expect(line).toMatch(/^[\p{Lu}\d"]/u);
        expect(line).not.toMatch(/\b1 (goals|points|wins|games|defeats|assists|clean sheets)\b/);
        expect(line).not.toMatch(/(?<![-–])\b([02-9]|\d\d+) (goal|point|win|game|defeat|assist|clean sheet)\b(?![-–])/);
        expect(line).not.toMatch(/\ba [8]|\ba 1[18]\b/);
      }
      // No two lines open the same way.
      const firsts = story.map((l) => l.split(' ')[0].toLowerCase());
      expect(new Set(firsts).size, story.join(" / ")).toBe(firsts.length);
    }
    // Within a career, a line is never told twice.
    for (const c of careers) {
      const lines = c.flat();
      expect(new Set(lines).size).toBe(lines.length);
    }
    // Across careers: distinct lines, and distinct openings.
    const lines = all.flat();
    const distinct = new Set(lines).size / lines.length;
    const openings = new Set(lines.map((l) => l.split(' ').slice(0, 3).join(' '))).size / lines.length;
    console.log(JSON.stringify({ lines: lines.length, distinct: +distinct.toFixed(3), openings: +openings.toFixed(3) }));
    expect(distinct).toBeGreaterThan(0.9);
    expect(openings).toBeGreaterThan(0.6);
    for (const c of careers.slice(0, 3)) console.log(c.map((st, k) => `Season ${k + 1}:\n  ${st.join('\n  ')}`).join('\n'));
  }, 120_000);

  it('tells the Through the Star seasons in different ways', () => {
    const star = [0, 1, 2, 3, 4, 5].map((i) => draftCareer(900 + i, 'star'));
    // The star line opens each story's middle; across 30 seasons it should vary a lot.
    const lines = star.flat().flat();
    expect(new Set(lines).size / lines.length).toBeGreaterThan(0.9);
    console.log(star[0].map((st, k) => `Star season ${k + 1}:\n  ${st.join('\n  ')}`).join('\n'));
  }, 120_000);

  it('only asks for facts the story provides', () => {
    const src = readFileSync(join(process.cwd(), 'src/game/story.ts'), 'utf8');
    for (const k of factsAsked()) {
      const tagged = /^(cl|fa)[A-Z]/.test(k) && src.includes(`\${tag}${k.slice(2)}`);
      expect(tagged || new RegExp(`\\b${k}\\b`).test(src), k).toBe(true);
    }
  });
});
