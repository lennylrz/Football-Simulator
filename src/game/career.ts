// Career statistics for the user's run: trophy cabinet, best players,
// signings and money. Used by the Hall of Fame and the run summary.
import { type GameState, type TransferRecord, trophiesOf } from './game';
import type { PlayerSeasonStats } from './season';

export type Trophy = 'league' | 'fa' | 'cl';

export interface CareerPlayer {
  id: number;
  apps: number;
  goals: number;
  assists: number;
  avg: number;
  seasons: number;
}

export interface Signing {
  t: TransferRecord;
  /** sale fee, or current value if still at the club */
  exitValue: number;
  sold: boolean;
  apps: number;
  goals: number;
  avg: number;
  /** value created, €k: resale minus fee plus on-pitch contribution */
  score: number;
}

export interface Career {
  seasons: { season: number; finish: number; trophies: Trophy[] }[];
  trophies: Record<Trophy, number>;
  trebles: number;
  players: CareerPlayer[];
  playerOfCareer: CareerPlayer | null;
  bestRated: CareerPlayer[];
  topScorers: CareerPlayer[];
  signings: Signing[];
  bestSigning: Signing | null;
  worstSigning: Signing | null;
  spent: number;
  earned: number;
}

/**
 * Player of the career: rewards sustained quality over many matches.
 * Appearances times rating above an average performance, plus goals and
 * assists.
 */
export function careerScore(p: CareerPlayer): number {
  return p.apps * (p.avg - 6.4) + 0.5 * p.goals + 0.3 * p.assists;
}

function signingScore(fee: number, exitValue: number, apps: number, avg: number): number {
  return exitValue - fee + apps * (avg - 6.5) * 400;
}

export function career(state: GameState): Career {
  const user = state.user;
  const totals = new Map<number, { apps: number; goals: number; assists: number; ratingSum: number; seasons: Set<number> }>();
  const add = (s: PlayerSeasonStats, season: number) => {
    let t = totals.get(s.id);
    if (!t) {
      t = { apps: 0, goals: 0, assists: 0, ratingSum: 0, seasons: new Set() };
      totals.set(s.id, t);
    }
    t.apps += s.apps;
    t.goals += s.goals;
    t.assists += s.assists;
    t.ratingSum += s.ratingSum;
    t.seasons.add(season);
  };
  for (const h of state.history) {
    for (const s of h.userStats) add(s, h.season);
    for (const s of h.userCupStats) add(s, h.season);
  }
  const players: CareerPlayer[] = [...totals].map(([id, t]) => ({
    id, apps: t.apps, goals: t.goals, assists: t.assists, avg: t.ratingSum / t.apps, seasons: t.seasons.size,
  }));

  const seasons = state.history.map((h) => ({
    season: h.season,
    finish: h.table.findIndex((r) => r.club === user) + 1,
    trophies: trophiesOf(h, user),
  }));
  const trophies: Record<Trophy, number> = { league: 0, fa: 0, cl: 0 };
  for (const s of seasons) for (const t of s.trophies) trophies[t]++;

  const regulars = players.filter((p) => p.apps >= 15);
  const byScore = regulars.slice().sort((a, b) => careerScore(b) - careerScore(a));
  const bestRated = regulars.slice().sort((a, b) => b.avg - a.avg).slice(0, 5);
  const topScorers = players.slice().sort((a, b) => b.goals - a.goals || a.apps - b.apps).slice(0, 5);

  // Signings: each purchase, valued at its resale fee or current value.
  const signings: Signing[] = [];
  state.transfers.forEach((t, i) => {
    if (t.to !== user || t.from === user) return;
    const exit = state.transfers.slice(i + 1).find((x) => x.player === t.player && x.from === user);
    const p = state.players[t.player];
    const exitValue = exit ? exit.fee : p.retired ? 0 : p.value;
    const stats = players.find((x) => x.id === t.player);
    const apps = stats?.apps ?? 0;
    const avg = stats?.avg ?? 6.5;
    signings.push({ t, exitValue, sold: !!exit, apps, goals: stats?.goals ?? 0, avg, score: signingScore(t.fee, exitValue, apps, avg) });
  });
  const paid = signings.filter((s) => s.t.fee > 0);
  const bestSigning = paid.length ? paid.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const worstSigning = paid.length > 1 ? paid.reduce((a, b) => (b.score < a.score ? b : a)) : null;

  let spent = 0;
  let earned = 0;
  for (const t of state.transfers) {
    if (t.to === user && t.from !== user) spent += t.fee;
    if (t.from === user && t.to !== user) earned += t.fee;
  }

  return {
    seasons,
    trophies,
    trebles: seasons.filter((s) => s.trophies.length === 3).length,
    players,
    playerOfCareer: byScore[0] ?? null,
    bestRated,
    topScorers,
    signings,
    bestSigning,
    worstSigning: worstSigning && worstSigning !== bestSigning ? worstSigning : null,
    spent,
    earned,
  };
}

