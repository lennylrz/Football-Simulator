// End-of-season awards: a club's player of the season, and the Ballon d'Or
// for the best player in the world, from the league's clubs or abroad.
import type { CupResult } from './cups';
import type { GameData } from './data';
import { isGoat } from './development';
import { EXTERNAL, type GameState } from './game';
import { AREA, parsePositions } from './positions';
import { clamp, normal, stream } from './rng';
import type { PlayerSeasonStats, SeasonResult } from './season';

export interface BallonEntry {
  player: number;
  /** a league club's index, or the name of the club abroad */
  club: number | string;
  /** league goals and assists, for league players */
  goals?: number;
  assists?: number;
}

/**
 * A club's player of the season: sustained quality over the season, plus
 * goals and assists, among those who played at least ten times.
 */
export function playerOfSeason(stats: PlayerSeasonStats[]): number | undefined {
  const score = (s: PlayerSeasonStats) => s.apps * (s.ratingSum / s.apps - 6.4) + 0.5 * s.goals + 0.3 * s.assists;
  return stats.filter((s) => s.apps >= 10).sort((a, b) => score(b) - score(a) || a.id - b.id)[0]?.id;
}

/**
 * The Ballon d'Or podium. Quality first; then, for players in the league,
 * how they played (rating, goals, assists) and what their club won; for
 * players abroad, how their real rating moved the next year (the best hint
 * of a great season) and the Champions League. Forwards are favoured, as
 * voters do. Messi and Ronaldo all but have reserved seats: in their decade
 * one of them nearly always wins, and the other is rarely far behind.
 */
/** The two exceptions' head start: huge in the 2010s, fading as they age. */
function goatBonus(era: number, age: number): number {
  if (age >= 36) return 1;
  return era <= 2015 ? 6 : 3;
}

export function ballonDor(state: GameState, data: GameData, league: SeasonResult, fa: CupResult, cl: CupResult): BallonEntry[] {
  const rng = stream(state.seed, 'ballon', state.season);
  const stats = new Map(league.stats.map((s) => [s.id, s]));
  const champion = league.table[0].club;
  const rows = data.seasons[state.season];
  const next = data.seasons[state.season + 1];
  const area = { ATT: 1.5, MID: 0.5, DEF: -1, GK: -2 };
  const scored: (BallonEntry & { score: number })[] = [];
  for (const p of Object.values(state.players)) {
    if (p.retired || p.ovr < 84) continue;
    const pos = AREA[parsePositions(p.pos)[0] ?? 'CM'];
    let score = p.ovr + area[pos] + normal(rng, 0, 0.8);
    // Between the two of them it is a coin toss, as it was.
    if (isGoat(p.id)) score += goatBonus(data.era, p.age) - 0.6 * (p.ovr - 94) + normal(rng, 0, 1.8);
    let club: number | string;
    const s = stats.get(p.id);
    if (p.club !== EXTERNAL) {
      club = p.club;
      if (!s || s.apps < 15) continue;
      // Capped: the league's goal tallies run high, and players abroad have none here.
      score += clamp((s.ratingSum / s.apps - 6.9) * 3 + s.goals * 0.08 + s.assists * 0.04, -3, 4);
      if (champion === p.club) score += 2;
      if (fa.winner === p.club) score += 0.5;
      if (cl.winner === p.club) score += 3;
      else if (cl.reached[p.club] === 'Final') score += 1;
    } else {
      const row = rows[p.id];
      if (!row) continue;
      club = data.meta.clubNames[row[6]];
      // A star abroad is assumed to have had a good season, as stars mostly do.
      score += 1.5;
      const later = next?.[p.id];
      if (later) score += 0.8 * clamp(later[0] - row[0], -3, 3);
      if (cl.winner === club) score += 3;
    }
    scored.push({ player: p.id, club, goals: s?.goals, assists: s?.assists, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.player - b.player).slice(0, 3)
    .map((e) => ({ player: e.player, club: e.club, goals: e.goals, assists: e.assists }));
}
