// The Daily Challenge leaderboard: a `daily_scores` row per browser per day in
// the same Supabase project as the rooms. Rows can be read and added, never
// changed; a second entry from the same browser on the same day is refused.
import { db, playerId } from './room';

export interface DailyScore {
  club: string;
  score: number;
  /** each season's finish and trophies won */
  result: { finishes: number[]; trophies: number[]; met?: boolean };
  mine?: boolean;
}

export async function submitDaily(day: number, entry: Omit<DailyScore, 'mine'>): Promise<void> {
  const sb = await db();
  const { error } = await sb.from('daily_scores').insert({ day, pid: playerId(), ...entry });
  // 23505: this browser has an entry for the day already.
  if (error && error.code !== '23505') throw new Error(error.message);
}

/** The day's best scores, and this browser's place among them. */
export async function dailyBoard(day: number, limit = 10): Promise<{ top: DailyScore[]; total: number; rank?: number; mine?: DailyScore }> {
  const sb = await db();
  const me = playerId();
  const [top, mine, total] = await Promise.all([
    sb.from('daily_scores').select('club, score, result, pid').eq('day', day).order('score', { ascending: false }).order('id').limit(limit),
    sb.from('daily_scores').select('club, score, result').eq('day', day).eq('pid', me).maybeSingle(),
    sb.from('daily_scores').select('id', { count: 'exact', head: true }).eq('day', day),
  ]);
  if (top.error) throw new Error(top.error.message);
  const rows = (top.data ?? []).map(({ pid, ...r }) => ({ ...(r as DailyScore), mine: pid === me }));
  // This browser's place: from the top list when it is in it, else by counting the better scores.
  let rank: number | undefined = rows.findIndex((r) => r.mine) + 1 || undefined;
  if (mine.data && rank === undefined) {
    const above = await sb.from('daily_scores').select('id', { count: 'exact', head: true }).eq('day', day).gt('score', mine.data.score);
    if (above.count !== null) rank = above.count + 1;
  }
  return { top: rows, total: Math.max(total.count ?? 0, rows.length, rank ?? 0), rank, mine: mine.data ? { ...(mine.data as DailyScore), mine: true } : undefined };
}
