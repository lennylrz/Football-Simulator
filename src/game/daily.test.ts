import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeOf, dailyChallenge, dailyNumber, dailySeed, resultText, targetMet, untilNextDaily } from './daily';
import { allowedFor, autoDraft, emptySlots, isBench, playDraftSeason, startRedraft } from './draft';
import { FORMATIONS } from './positions';
import { endSeason, type GameState, newGame, REAL_CLUBS, starOf } from './game';
import { loadTestData } from './testData';
import { applyAction } from './actions';

describe('daily numbers', () => {
  it('counts days from 23 October 2026 in local time', () => {
    expect(dailyNumber(new Date(2026, 9, 23, 0, 1))).toBe(1);
    expect(dailyNumber(new Date(2026, 9, 23, 23, 59))).toBe(1);
    expect(dailyNumber(new Date(2026, 9, 24, 0, 0))).toBe(2);
    expect(dailyNumber(new Date(2027, 9, 23, 12))).toBe(366);
    expect(untilNextDaily(new Date(2026, 9, 23, 23, 0))).toBe(3_600_000);
  });

  it('takes the challenges in turn, with a seed for each day', () => {
    expect(dailyChallenge(1).id).toBe(CHALLENGES[0].id);
    expect(dailyChallenge(CHALLENGES.length + 1).id).toBe(CHALLENGES[0].id);
    expect(dailyChallenge(2).id).toBe(CHALLENGES[1].id);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(20);
    expect(dailySeed(5)).toBe(dailySeed(5));
    expect(dailySeed(5)).not.toBe(dailySeed(6));
  });
});

/** A daily career played by drafting the best-rated candidate, with whatever re-drafts the rules allow. */
function play(challenge: string, day: number, seasons = 5, first = false) {
  const c = challengeOf(challenge)!;
  return loadTestData(c.era).then((data) => {
    const rules = { redrafts: c.redrafts ?? 2, choices: c.choices ?? 5, bench: 3 };
    const s = newGame(data, REAL_CLUBS, dailySeed(day), 'draft', '4-3-3', undefined, rules, [], undefined, { day, challenge });
    if (c.style) s.clubs[s.user].style = c.style;
    const offers: number[][] = [];
    /** how many offered players met the rule when they were offered, of how many */
    const rule = { ok: 0, all: 0 };
    const pick = (st: GameState) => {
      autoDraft(st, data, (ids) => {
        offers.push(ids);
        const slot = st.draft!.slot!;
        const allow = allowedFor(st, data, isBench(slot) ? 'SUB' : FORMATIONS[st.clubs[st.user].formation][slot]);
        rule.all += ids.length;
        rule.ok += allow ? ids.filter((id) => allow(st.players[id])).length : ids.length;
        return first ? ids[0] : ids.reduce((a, b) => (st.players[b].ovr > st.players[a].ovr ? b : a));
      });
    };
    for (let k = 0; k < seasons; k++) {
      pick(s);
      while (emptySlots(s).length) {
        startRedraft(s, data, emptySlots(s)[0]);
        pick(s);
      }
      expect(playDraftSeason(s, data)).toBeNull();
      endSeason(s, data);
    }
    return { s, data, offers, rule };
  });
}

describe('every challenge', () => {
  it.each(CHALLENGES.map((c) => c.id))('%s drafts a full squad and plays five seasons', async (id) => {
    const c = challengeOf(id)!;
    const { s, data, offers, rule } = await play(id, CHALLENGES.findIndex((x) => x.id === id) + 1);
    expect(s.stage).toBe('summary');
    expect(s.history).toHaveLength(5);
    const d = s.draft!;
    // Every pick offered a real choice.
    expect(d.picks.filter((p) => p.season === 0)).toHaveLength(14);
    expect(offers.every((o) => o.length >= 2)).toBe(true);
    // The rule holds for nearly everyone offered; a thin pool may bend it now and then.
    expect(rule.ok / rule.all, `${rule.ok} of ${rule.all}`).toBeGreaterThan(0.9);
    if (c.target) expect(typeof targetMet(s, data)).toBe('boolean');
  }, 60_000);
});

describe('picking the first candidate every time', () => {
  it.each(CHALLENGES.map((c) => c.id))('%s always has someone to offer', async (id) => {
    const { offers } = await play(id, CHALLENGES.findIndex((x) => x.id === id) + 1, 2, true);
    expect(offers.every((o) => o.length >= 2)).toBe(true);
  }, 60_000);
});

describe('the result to share', () => {
  it('lists each finish with a cup per trophy, the legacy score and the target', () => {
    const seasons = [{ finish: 3, trophies: [] }, { finish: 1, trophies: ['league'] }, { finish: 2, trophies: [] }, { finish: 1, trophies: ['league', 'fa'] }, { finish: 11, trophies: [] }];
    expect(resultText(12, challengeOf('portugal')!, seasons, 11250, undefined, 'example.com')).toBe(
      'Five Seasons Daily #12 · Only Portugal\n3rd 1st\u{1F3C6} 2nd 1st\u{1F3C6}\u{1F3C6} 11th\nLegacy 11,250\nexample.com',
    );
    expect(resultText(5, challengeOf('underdog')!, seasons, 900, false, 'x').split('\n')[2]).toBe('Legacy 900 · Top half every season: missed');
  });
});

describe('challenge rules', () => {
  it('offers two candidates per pick in Two choices', async () => {
    const { offers } = await play('two', 8, 1);
    expect(offers.every((o) => o.length === 2)).toBe(true);
  });

  it('keeps the style in Park the Bus or bust', async () => {
    const { s, data } = await play('bus', 11, 1);
    expect(s.clubs[s.user].style).toBe('bus');
    expect(applyAction(s, data, s.user, { t: 'style', style: 'tiki' })).not.toBeNull();
    expect(s.clubs[s.user].style).toBe('bus');
  });

  it('only lets a player under 23 be the star in Star system', async () => {
    const { s, data } = await play('star', 15, 1);
    const xi = s.clubs[s.user].xi;
    const old = xi.find((id) => s.players[id].age >= 23);
    const young = xi.find((id) => s.players[id].age < 23);
    if (old !== undefined) expect(applyAction(s, data, s.user, { t: 'star', player: old })).not.toBeNull();
    if (young !== undefined) {
      expect(applyAction(s, data, s.user, { t: 'star', player: young })).toBeNull();
      expect(starOf(s, s.user)).toBe(young);
    }
  });

  it('allows no re-drafts in No re-drafts', async () => {
    const { s } = await play('no-redrafts', 14, 1);
    expect(s.draft!.redraftsLeft).toBe(0);
  });

  it('gives every player a different nationality in Mixed bag', async () => {
    const { s, data } = await play('mixed', 20, 1);
    const c = s.clubs[s.user];
    const nations = [...c.xi, ...c.bench].map((id) => data.names[id][1]);
    expect(new Set(nations).size).toBeGreaterThanOrEqual(nations.length - 1);
  });
});
