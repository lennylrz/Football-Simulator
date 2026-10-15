import { useEffect, useMemo, useState } from 'react';
import type { CupMatch } from '../game/cups';
import type { SeasonPlay } from '../game/game';
import { ordinal } from './TransferWindow';

/** User's league position after each round. */
function positions(result: SeasonPlay, user: number): { pos: number; w: number; d: number; l: number }[] {
  const pts = new Map<number, [number, number, number]>(); // pts, gd, gf
  for (const [h, a] of result.rounds[0]) {
    pts.set(h, [0, 0, 0]);
    pts.set(a, [0, 0, 0]);
  }
  let w = 0, d = 0, l = 0;
  return result.rounds.map((round) => {
    for (const [h, a, hg, ag] of round) {
      const th = pts.get(h)!;
      const ta = pts.get(a)!;
      th[1] += hg - ag; th[2] += hg; ta[1] += ag - hg; ta[2] += ag;
      if (hg > ag) th[0] += 3;
      else if (hg < ag) ta[0] += 3;
      else { th[0]++; ta[0]++; }
      if (h === user || a === user) {
        const diff = h === user ? hg - ag : ag - hg;
        if (diff > 0) w++; else if (diff < 0) l++; else d++;
      }
    }
    const order = [...pts.entries()].sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1] || y[1][2] - x[1][2]);
    return { pos: order.findIndex(([c]) => c === user) + 1, w, d, l };
  });
}

/** Where the user stands in a cup after league round `round`. */
function cupStatus(matches: CupMatch[], user: number, round: number, entered: boolean): string {
  if (!entered) return '—';
  const mine = matches.filter((m) => (m.home === user || m.away === user) && m.slot <= round + 1);
  if (mine.length === 0) return 'Waiting';
  const last = mine[mine.length - 1];
  const all = matches.filter((m) => m.home === user || m.away === user);
  const isLast = all[all.length - 1] === last;
  if (last.leg === 1 || last.round === 'Group stage') return last.round;
  if (!isLast) return `Through: ${last.round}`;
  const userHome = last.home === user;
  const won = last.pens !== undefined ? (last.pens === 0) === userHome : userHome ? last.hg > last.ag : last.ag > last.hg;
  if (last.leg === 2) {
    const first = all[all.length - 2];
    const forUser = (userHome ? last.hg : last.ag) + (first.home === user ? first.hg : first.ag);
    const against = (userHome ? last.ag : last.hg) + (first.home === user ? first.ag : first.hg);
    const aggWon = forUser !== against ? forUser > against : won;
    return aggWon ? '🏆 Winners' : `Out: ${last.round}`;
  }
  if (last.round === 'Final') return won ? '🏆 Winners' : 'Runners-up';
  return won ? '🏆 Winners' : `Out: ${last.round}`;
}

export function SeasonReveal({ result, user, onDone }: { result: SeasonPlay; user: number; onDone: () => void }) {
  const run = useMemo(() => positions(result, user), [result, user]);
  const [round, setRound] = useState(0);
  const total = result.rounds.length;
  const clEntered = Object.keys(result.cl.reached).map(Number).includes(user);

  useEffect(() => {
    if (round >= total - 1) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRound((r) => r + 1), 65);
    return () => clearTimeout(t);
  }, [round, total, onDone]);

  const now = run[round];
  return (
    <button
      onClick={onDone}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-center"
      aria-label="Skip"
    >
      <div className="text-sm uppercase tracking-widest text-slate-400">Matchday {round + 1} of {total}</div>
      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${((round + 1) / total) * 100}%` }} />
      </div>
      <div>
        <div className="text-7xl font-black tabular-nums">{ordinal(now.pos)}</div>
        <div className="mt-1 text-slate-400 tabular-nums">
          W{now.w} D{now.d} L{now.l}
        </div>
      </div>
      <div className="grid w-full max-w-xs grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-xs text-slate-400">FA Cup</div>
          <div className="font-semibold">{cupStatus(result.fa.matches, user, round, true)}</div>
        </div>
        <div className="rounded-lg bg-slate-900 p-2">
          <div className="text-xs text-slate-400">Champions League</div>
          <div className="font-semibold">{cupStatus(result.cl.matches, user, round, clEntered)}</div>
        </div>
      </div>
      <div className="text-xs text-slate-500">Tap to skip</div>
    </button>
  );
}
