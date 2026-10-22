import { beforeAll, describe, expect, it } from 'vitest';
import type { Era, GameData } from './data';
import { autoDraft, emptySlots, playDraftSeason, startRedraft } from './draft';
import { autoSeason, endSeason, type GameState, newGame, REAL_CLUBS } from './game';
import { firstSeasonNotes, MAX_NOTE, SQUAD_BANK, type SquadNote, squadNotes } from './squadStories';
import { STYLE_ORDER } from './styles';
import { loadTestData } from './testData';

let data: GameData;
beforeAll(async () => {
  data = await loadTestData();
});

interface Summer { state: GameState; club: number; notes: SquadNote[] }

/** A drafted career: each summer's notes, checked against the squad of that summer. */
function draftCareer(seed: number, check: (s: Summer) => void, style = STYLE_ORDER[seed % STYLE_ORDER.length], redraft = true): SquadNote[][] {
  const s = newGame(data, REAL_CLUBS, seed, 'draft', '4-3-3');
  const out: SquadNote[][] = [];
  for (let k = 0; k < 5; k++) {
    autoDraft(s, data);
    while (emptySlots(s).length) {
      startRedraft(s, data, emptySlots(s)[0]);
      autoDraft(s, data);
    }
    // Re-draft a position or two now and then, so there are new faces.
    if (redraft && k > 0 && (seed + k) % 2 === 0) {
      startRedraft(s, data, (seed + k) % 11);
      autoDraft(s, data);
    }
    s.clubs[s.user].style = style;
    const notes = squadNotes(s, data, s.user);
    check({ state: s, club: s.user, notes });
    out.push(notes);
    expect(playDraftSeason(s, data)).toBeNull();
    endSeason(s, data);
  }
  return out;
}

function wellFormed({ state, club, notes }: Summer, data: GameData): void {
  expect(notes.length, JSON.stringify(notes)).toBeGreaterThanOrEqual(2);
  expect(notes.length).toBeLessThanOrEqual(4);
  const squad = new Set(state.clubs[club].squad);
  for (const n of notes) {
    expect(n.text).not.toMatch(/undefined|NaN|\{|\}|\[|\]|\bnull\b/);
    expect(n.text.length, n.text).toBeLessThanOrEqual(MAX_NOTE);
    expect(n.text).toMatch(/^[\p{Lu}\d]/u);
    expect(n.text).toMatch(/[.!?]$/);
    expect(n.text).not.toMatch(/\b1 (goals|games|points|appearances|assists|seasons|years|players)\b/);
    expect(n.text).not.toMatch(/\b([02-9]|\d\d+) (goal|game|point|appearance|assist|season|year|player)\b(?![-'])/);
    expect(n.text).not.toMatch(/\bone (goals|games|points|seasons|years|players)\b/);
    expect(n.text).not.toMatch(/\ba [aeio]|\ban [^aeiouAEIOU\d]/i);
    expect(n.text).not.toMatch(/\b(finished|past it|washed)\b/i);
    expect(n.text).not.toMatch(/\b(she|her)\b/i);
    expect(n.players.length).toBeGreaterThan(0);
    for (const id of n.players) {
      expect(squad.has(id), `${n.kind}: ${id}`).toBe(true);
      expect(n.text).toContain(data.names[id][0]);
    }
    expect(SQUAD_BANK[n.kind]).toBeDefined();
  }
  // One note per situation.
  expect(new Set(notes.map((n) => n.kind)).size).toBe(notes.length);
}

describe('squad notes', () => {
  it('are short, well formed, about the squad and rarely repeat', () => {
    const careers = Array.from({ length: 16 }, (_, i) => draftCareer(1300 + i, (s) => wellFormed(s, data)));
    const all = careers.flat().flat();
    // Within a career, a note is never told twice.
    for (const c of careers) {
      const texts = c.flat().map((n) => n.text);
      expect(new Set(texts).size, texts.join('\n')).toBe(texts.length);
    }
    const texts = all.map((n) => n.text);
    const distinct = new Set(texts).size / texts.length;
    const kinds = new Set(all.map((n) => n.kind));
    const counts = careers.flat().map((n) => n.length);
    console.log(JSON.stringify({ notes: texts.length, distinct: +distinct.toFixed(3), kinds: kinds.size, per: counts.reduce((a, b) => a + b, 0) / counts.length }));
    expect(distinct).toBeGreaterThan(0.95);
    expect(kinds.size).toBeGreaterThan(25);
    // Not always the same number of notes.
    expect(new Set(counts).size).toBeGreaterThan(1);
    for (const c of careers.slice(0, 2)) console.log(c.map((st, k) => `Summer ${k + 1}:\n  ${st.map((n) => `[${n.kind}] ${n.text}`).join('\n  ')}`).join('\n'));
  }, 180_000);

  it('are deterministic', () => {
    const a = draftCareer(77, () => {});
    const b = draftCareer(77, () => {});
    expect(a).toEqual(b);
  }, 60_000);

  it('tell the first summer from the drafted squad alone', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      draftCareer(1500 + i, (s) => {
        if (s.state.season > 0) return;
        expect(s.notes).toEqual(firstSeasonNotes(s.state, data, s.club));
        for (const n of s.notes) {
          seen.add(n.kind);
          // Nothing that needs a season played.
          expect(n.kind).not.toMatch(/^(rival\.form|rival\.newcomer|growth|legend|milestone|record|goals|duo|pens|pots|ballon|ever|supersub|form|originals|new)/);
        }
      }, undefined, false);
    }
    expect(seen.size).toBeGreaterThan(6);
  }, 180_000);

  it('cover every play style and a managed club', async () => {
    for (const style of STYLE_ORDER) {
      const kinds = new Set<string>();
      for (let i = 0; i < 4; i++) draftCareer(1600 + i * 4 + STYLE_ORDER.indexOf(style), (s) => s.notes.forEach((n) => kinds.add(n.kind)), style);
      expect(kinds.has(`style.${style}`), style).toBe(true);
    }
    // A real club run by the user, in another era too.
    for (const era of [2015, 2020] as Era[]) {
      const d = await loadTestData(era);
      for (let i = 0; i < 3; i++) {
        const s = newGame(d, i * 6, 1700 + i);
        for (let k = 0; k < 5; k++) {
          wellFormed({ state: s, club: s.user, notes: squadNotes(s, d, s.user) }, d);
          autoSeason(s, d);
        }
      }
    }
    data = await loadTestData();
  }, 180_000);
});
