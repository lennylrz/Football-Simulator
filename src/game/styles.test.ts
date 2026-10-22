import { describe, expect, it } from 'vitest';
import { autoDraft, playDraftSeason } from './draft';
import { endSeason, newGame, REAL_CLUBS } from './game';
import { AREA, type Area, FORMATIONS, parsePositions } from './positions';
import { type PlayStyle, STYLE_ORDER } from './styles';
import { loadTestData } from './testData';

interface Outcome { pts: number; gf: number; ga: number; starShare: number; starDev: number; starPots: number; dev: Record<Area, number> }

/** The four styles, and Through the Star built around a defender or keeper of the manager's choosing. */
type Variant = PlayStyle | 'defstar';
const VARIANTS: Variant[] = [...STYLE_ORDER, 'defstar'];

describe('play styles', () => {
  it('trade goals, who scores them and who grows, without one being best', async () => {
    const data = await loadTestData();
    const RUNS = 24;
    const out = {} as Record<Variant, Outcome>;
    for (const variant of VARIANTS) {
      const style: PlayStyle = variant === 'defstar' ? 'star' : variant;
      const o: Outcome = { pts: 0, gf: 0, ga: 0, starShare: 0, starDev: 0, starPots: 0, dev: { GK: 0, DEF: 0, MID: 0, ATT: 0 } };
      const counts: Record<Area, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
      for (let r = 0; r < RUNS; r++) {
        // The same drafted XI each time, so only the style differs.
        const s = newGame(data, REAL_CLUBS, 500 + r, 'draft', '4-3-3');
        autoDraft(s, data);
        const c = s.clubs[s.user];
        c.style = style;
        if (variant === 'defstar') {
          // The best defender (the keeper counts) is made the star.
          const slots = FORMATIONS[c.formation];
          const back = c.xi.filter((_, i) => AREA[slots[i]] === 'DEF' || AREA[slots[i]] === 'GK');
          c.starPick = back.reduce((a, b) => (s.players[b].ovr > s.players[a].ovr ? b : a));
        }
        const before = new Map(c.squad.map((id) => [id, s.players[id].ovr]));
        playDraftSeason(s, data);
        const h = s.history[0];
        const row = h.table.find((x) => x.club === s.user)!;
        o.pts += row.pts / RUNS;
        o.gf += row.gf / RUNS;
        o.ga += row.ga / RUNS;
        const goals = h.userStats.reduce((a, x) => a + x.goals, 0);
        o.starShare += (h.userStats.find((x) => x.id === c.star)?.goals ?? 0) / goals / RUNS;
        if (h.pots === c.star) o.starPots += 1 / RUNS;
        if (variant === 'defstar') expect(c.star).toBe(c.starPick);
        endSeason(s, data);
        for (const [id, ovr] of before) {
          if (id === c.star) {
            o.starDev += (s.players[id].ovr - ovr) / RUNS;
            continue;
          }
          const a = AREA[parsePositions(s.players[id].pos)[0]];
          o.dev[a] += s.players[id].ovr - ovr;
          counts[a]++;
        }
      }
      for (const a of Object.keys(counts) as Area[]) o.dev[a] /= counts[a];
      out[variant] = o;
    }
    console.log(JSON.stringify(out));
    const pts = VARIANTS.map((s) => out[s].pts);
    expect(Math.max(...pts) - Math.min(...pts)).toBeLessThan(5);
    // Through the Star: his share of the goals and his growth.
    expect(out.star.starShare).toBeGreaterThan(0.33);
    expect(out.star.starShare).toBeGreaterThan(out.tiki.starShare + 0.08);
    expect(out.star.starDev).toBeGreaterThan(out.tiki.starDev + 0.5);
    expect(out.star.dev.MID).toBeLessThan(out.tiki.dev.MID);
    // Park the Bus: fewest goals both ways, defenders grow most.
    expect(out.bus.ga).toBeLessThan(Math.min(out.tiki.ga, out.star.ga, out.press.ga));
    expect(out.bus.gf).toBeLessThan(Math.min(out.tiki.gf, out.star.gf, out.press.gf));
    expect(out.bus.dev.DEF).toBeGreaterThan(out.tiki.dev.DEF);
    // Gegenpress: most goals both ways, forwards grow most.
    expect(out.press.gf).toBeGreaterThan(Math.max(out.tiki.gf, out.bus.gf));
    expect(out.press.ga).toBeGreaterThan(Math.max(out.tiki.ga, out.bus.ga, out.star.ga));
    expect(out.press.dev.ATT).toBeGreaterThan(out.tiki.dev.ATT);
    // A defender as the star: the leader. The defence tightens, he grows most,
    // and he is often the club's player of the season.
    expect(out.defstar.ga).toBeLessThan(out.star.ga);
    expect(out.defstar.starDev).toBeGreaterThan(out.tiki.dev.DEF + 0.5);
    expect(out.defstar.starDev).toBeGreaterThan(Math.max(...(['GK', 'DEF', 'MID', 'ATT'] as Area[]).map((a) => out.defstar.dev[a])));
    expect(out.defstar.starPots).toBeGreaterThan(0.15);
  }, 300000);
});
