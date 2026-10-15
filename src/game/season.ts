import { FORMATIONS, type Formation } from './positions';
import type { PlayerLite } from './lineup';
import { ENGINE, type MatchTeam, simulateMatch } from './match';
import { type Rng, normal, shuffle } from './rng';

export interface SeasonTeam {
  club: number;
  formation: Formation;
  xi: PlayerLite[];
  bench: PlayerLite[];
}

export interface TableRow {
  club: number;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface PlayerSeasonStats {
  id: number;
  club: number;
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  ratingSum: number;
}

export interface SeasonResult {
  /** sorted, champion first */
  table: TableRow[];
  /** per round: [home, away, home goals, away goals] */
  rounds: [number, number, number, number][][];
  /** per match (same order as rounds flattened): [scorer, assister, side] */
  scorers: [number, number, 0 | 1][][];
  stats: PlayerSeasonStats[];
}

/** Double round robin (circle method): 38 rounds of 10 matches for 20 clubs. */
export function fixtures(clubs: number[], rng: Rng): [number, number][][] {
  const teams = shuffle(rng, clubs);
  const n = teams.length;
  const first: [number, number][][] = [];
  const rot = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const order = [teams[0], ...rot];
    const round: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    first.push(round);
    rot.unshift(rot.pop()!);
  }
  const second = first.map((round) => round.map(([a, b]) => [b, a] as [number, number]));
  return [...first, ...second];
}

export function sortTable(rows: TableRow[]): TableRow[] {
  return rows.slice().sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.club - b.club,
  );
}

export function simulateSeason(teams: SeasonTeam[], rng: Rng): SeasonResult {
  const byClub = new Map<number, MatchTeam>();
  for (const t of teams) {
    const form = normal(rng, 0, ENGINE.seasonFormSd);
    byClub.set(t.club, { club: t.club, slots: FORMATIONS[t.formation], xi: t.xi, bench: t.bench, form });
  }
  const table = new Map<number, TableRow>();
  for (const t of teams) table.set(t.club, { club: t.club, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  const stats = new Map<number, PlayerSeasonStats>();
  const rounds: SeasonResult['rounds'] = [];
  const scorers: SeasonResult['scorers'] = [];

  for (const round of fixtures(teams.map((t) => t.club), rng)) {
    const out: [number, number, number, number][] = [];
    for (const [h, a] of round) {
      const m = simulateMatch(byClub.get(h)!, byClub.get(a)!, rng);
      out.push([h, a, m.hg, m.ag]);
      scorers.push(m.goals);
      const th = table.get(h)!;
      const ta = table.get(a)!;
      th.p++; ta.p++;
      th.gf += m.hg; th.ga += m.ag; ta.gf += m.ag; ta.ga += m.hg;
      if (m.hg > m.ag) { th.w++; ta.l++; th.pts += 3; }
      else if (m.hg < m.ag) { ta.w++; th.l++; ta.pts += 3; }
      else { th.d++; ta.d++; th.pts++; ta.pts++; }
      for (const line of m.lines) {
        let s = stats.get(line.id);
        if (!s) {
          s = { id: line.id, club: line.club, apps: 0, starts: 0, goals: 0, assists: 0, ratingSum: 0 };
          stats.set(line.id, s);
        }
        s.apps++;
        if (line.started) s.starts++;
        s.goals += line.goals;
        s.assists += line.assists;
        s.ratingSum += line.rating;
      }
    }
    rounds.push(out);
  }
  return { table: sortTable([...table.values()]), rounds, scorers, stats: [...stats.values()] };
}
