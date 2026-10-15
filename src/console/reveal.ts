// Running league position and cup progress, for the season reveal.
import type { CupMatch } from '../game/cups';
import type { SeasonPlay } from '../game/game';

/** User's league position after each round. */
export function positions(result: SeasonPlay, user: number): { pos: number; w: number; d: number; l: number }[] {
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
export function cupStatus(matches: CupMatch[], user: number, round: number, entered: boolean): string {
  if (!entered) return 'Not qualified';
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
    return aggWon ? 'Winners' : `Out: ${last.round}`;
  }
  if (last.round === 'Final') return won ? 'Winners' : 'Runners-up';
  return won ? 'Winners' : `Out: ${last.round}`;
}

