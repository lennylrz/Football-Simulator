// A manager's season in a few lines: the finish, the run that made or broke
// it, the best and worst days, who stood out, the cups and the rival.
// Short on purpose: four or five sentences, read in passing.
import type { BallonEntry } from './awards';
import { CLUBS } from './clubs';
import { type CupResult, WINNER } from './cups';
import type { GameData } from './data';
import type { GameState } from './game';
import { type Rng, stream } from './rng';
import type { PlayerSeasonStats, SeasonResult } from './season';
import { STYLES } from './styles';

const ORD = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

function pick<T>(rng: Rng, options: T[]): T {
  return options[Math.floor(rng() * options.length)];
}

export interface StoryInput {
  state: GameState;
  data: GameData;
  club: number;
  league: SeasonResult;
  fa: CupResult;
  cl: CupResult;
  /** the club's league and cup stats */
  stats: PlayerSeasonStats[];
  predicted?: number;
  pots?: number;
  ballon: BallonEntry[];
  rival?: number;
}

export function seasonStory(x: StoryInput): string[] {
  const { state, data, club, league } = x;
  const rng = stream(state.seed, 'story', state.season, club);
  const name = (c: number) => {
    const n = data.meta.gameClubs[c];
    return CLUBS.find((i) => i.name === n)?.short ?? n;
  };
  const player = (id: number) => data.names[id]?.[0] ?? '';
  // Lower priority numbers are kept first when there is too much to say.
  const lines: { p: number; text: string }[] = [];
  const add = (p: number, text: string) => lines.push({ p, text });

  // The finish.
  const finish = league.table.findIndex((r) => r.club === club) + 1;
  const me = league.table[finish - 1];
  const top = league.table[0];
  if (finish === 1) {
    const gap = me.pts - league.table[1].pts;
    add(0, gap >= 8
      ? pick(rng, [`Champions, and it was never close: ${gap} points clear.`, `A procession to the title, ${gap} points ahead of ${name(league.table[1].club)}.`])
      : pick(rng, [`Champions by ${gap} point${gap === 1 ? '' : 's'}, holding off ${name(league.table[1].club)}.`, `The title, won by ${gap} point${gap === 1 ? '' : 's'} in a race that went deep.`]));
  } else if (finish <= 3 && top.pts - me.pts <= 6) {
    add(0, `So close: ${ORD(finish)}, ${top.pts - me.pts} points behind champions ${name(top.club)}.`);
  } else if (finish <= 4) {
    add(0, pick(rng, [`${ORD(finish)} place and Champions League football next season.`, `A top-four finish, ${ORD(finish)}, with ${me.pts} points.`]));
  } else if (x.predicted && finish >= x.predicted + 4) {
    add(0, `Predicted ${ORD(x.predicted)}, finished ${ORD(finish)}: a season that never got going.`);
  } else if (x.predicted && finish <= x.predicted - 4) {
    add(0, `Predicted ${ORD(x.predicted)}, finished ${ORD(finish)}: far better than anyone expected.`);
  } else {
    add(0, finish <= 6
      ? `${ORD(finish)} with ${me.pts} points, just short of the top four.`
      : `${ORD(finish)} with ${me.pts} points: ${finish >= league.table.length - 2 ? 'a season to forget' : 'mid-table, for now'}.`);
  }

  // The run of the season: the longest winning or winless streak.
  const results: { md: number; opp: number; f: number; a: number; home: boolean }[] = [];
  league.rounds.forEach((round, i) => {
    for (const [h, a, hg, ag] of round) {
      if (h === club) results.push({ md: i + 1, opp: a, f: hg, a: ag, home: true });
      else if (a === club) results.push({ md: i + 1, opp: h, f: ag, a: hg, home: false });
    }
  });
  const streak = (ok: (r: (typeof results)[number]) => boolean) => {
    let best = { n: 0, from: 0 };
    let cur = { n: 0, from: 0 };
    for (const r of results) {
      cur = ok(r) ? { n: cur.n + 1, from: cur.n ? cur.from : r.md } : { n: 0, from: 0 };
      if (cur.n > best.n) best = cur;
    }
    return best;
  };
  const wins = streak((r) => r.f > r.a);
  const winless = streak((r) => r.f <= r.a);
  if (wins.n >= 6) add(3, `${wins.n} wins in a row from matchday ${wins.from} defined the season.`);
  else if (winless.n >= 6) add(3, `${winless.n === 8 || winless.n === 11 || winless.n === 18 ? 'An' : 'A'} ${winless.n}-game winless run from matchday ${winless.from} cost dearly.`);

  // The best and worst days.
  const best = results.slice().sort((p, q) => q.f - q.a - (p.f - p.a) || q.f - p.f)[0];
  const worst = results.slice().sort((p, q) => p.f - p.a - (q.f - q.a) || q.a - p.a)[0];
  if (best && best.f - best.a >= 4) add(4, `Best day: ${best.f}–${best.a} ${best.home ? 'against' : 'away at'} ${name(best.opp)}.`);
  if (worst && worst.a - worst.f >= 3) add(4, `Worst day: a ${worst.f}–${worst.a} defeat ${worst.home ? 'at home to' : 'at'} ${name(worst.opp)}.`);

  // Who stood out.
  const style = state.clubs[club].style;
  const star = state.clubs[club].star;
  const s = (id: number) => x.stats.find((t) => t.id === id);
  // The player of the season has his own card beside the story; only a
  // season built around him is part of it.
  if (x.pots !== undefined && style === 'star' && star === x.pots) {
    const p = s(x.pots)!;
    add(1, `Everything went through ${player(x.pots)}, and he delivered: ${p.goals} goals and ${p.assists} assists in all competitions.`);
  }
  // A youngster who broke through.
  const teamAvg = x.stats.reduce((a, t) => a + t.ratingSum, 0) / Math.max(1, x.stats.reduce((a, t) => a + t.apps, 0));
  const young = x.stats
    .filter((t) => t.id !== x.pots && t.apps >= 15 && (state.players[t.id]?.age ?? 99) <= 21 && t.ratingSum / t.apps >= teamAvg)
    .sort((p, q) => q.ratingSum / q.apps - p.ratingSum / p.apps)[0];
  if (young) add(3, `${player(young.id)}, just ${state.players[young.id].age}, broke through: ${young.apps} games, ${young.goals} goals.`);
  else if (style === 'bus' && me.ga <= 30) add(3, `The bus stayed parked: just ${me.ga} conceded all season.`);
  else if (style === 'press' && me.gf >= 85) add(3, `Relentless: ${me.gf} league goals.`);

  // The cups.
  const clr = x.cl.reached[club];
  const far = x.fa.reached[club];
  if (clr === WINNER) add(1, 'And Europe: Champions League winners.');
  else if (clr === 'Final') add(1, 'A Champions League final, lost.');
  else if (clr === 'Semi-final') add(1, 'A run to the Champions League semi-finals.');
  if (far === WINNER) add(1, 'The FA Cup is coming home too.');

  // The Ballon d'Or.
  const b = x.ballon.findIndex((e) => e.club === club);
  if (b >= 0) add(1, b === 0 ? `${player(x.ballon[0].player)} won the Ballon d'Or.` : `${player(x.ballon[b].player)} finished ${ORD(b + 1)} for the Ballon d'Or.`);

  // The rival.
  if (x.rival !== undefined) {
    const h2h = results.filter((r) => r.opp === x.rival);
    const w = h2h.filter((r) => r.f > r.a).length;
    const l = h2h.filter((r) => r.f < r.a).length;
    if (h2h.length) {
      add(2, w > l ? `Bragging rights: ${w}–${l} in the league against ${name(x.rival)}.`
        : l > w ? `${name(x.rival)} had the better of you, ${l}–${w}. Next season.`
        : `Honours even against ${name(x.rival)}.`);
    }
  }

  // Five lines at most: the finish, then the most telling, in season order.
  const kept = new Set(lines.slice().sort((a, b) => a.p - b.p).slice(0, 5));
  const out = lines.filter((l) => kept.has(l)).map((l) => l.text);
  if (style && out.length < 3) out.push(`Style: ${STYLES[style].name}.`);
  return out;
}
