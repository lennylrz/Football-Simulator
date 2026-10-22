// A manager's season in a few lines: the finish, then a handful of the
// stories the season actually told (a title race, a run, the star's arc,
// a youngster, the cups, the rival). The phrases live in storyText.ts;
// this file works out what happened and which stories it supports.
// Short on purpose: five sentences at most, read in passing.
//
// Variety comes from three places: many wordings per situation, a weighted
// draw between the stories a season supports, and the earlier seasons'
// stories, read back so the same wordings and arcs are not told again.
import type { BallonEntry } from './awards';
import { CLUBS } from './clubs';
import { type CupResult, type Entrant, entrantName, tiesOf, WINNER } from './cups';
import { type GameData, NUM_SEASONS } from './data';
import type { GameState, SeasonHistory } from './game';
import { AREA, parsePositions } from './positions';
import { type Rng, shuffle, stream } from './rng';
import type { PlayerSeasonStats, SeasonResult } from './season';
import { BANK, DERBIES } from './storyText';

const ORD = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The longest line a story may carry. */
export const MAX_LINE = 175;

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

// ─────────────────────────── Templates ───────────────────────────

type Vars = Record<string, string | number | undefined>;
type Tok = { t: 'text'; s: string } | { t: 'var'; k: string; m?: string } | { t: 'alt'; opts: Tok[][] };

function parse(tpl: string): Tok[] {
  const out: Tok[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ t: 'text', s: text });
    text = '';
  };
  for (let i = 0; i < tpl.length; i++) {
    const c = tpl[i];
    if (c === '{') {
      flush();
      const end = tpl.indexOf('}', i);
      const [k, m] = tpl.slice(i + 1, end).split('|');
      out.push({ t: 'var', k, m });
      i = end;
    } else if (c === '[') {
      flush();
      const end = tpl.indexOf(']', i);
      const opts: string[] = [];
      let depth = 0;
      let cur = '';
      for (const ch of tpl.slice(i + 1, end)) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        if (ch === '|' && !depth) {
          opts.push(cur);
          cur = '';
        } else cur += ch;
      }
      opts.push(cur);
      out.push({ t: 'alt', opts: opts.map(parse) });
      i = end;
    } else text += c;
  }
  flush();
  return out;
}

const parsed = new Map<string, Tok[]>();
const toks = (tpl: string) => {
  let t = parsed.get(tpl);
  if (!t) parsed.set(tpl, (t = parse(tpl)));
  return t;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function pattern(ts: Tok[]): string {
  return ts.map((t) => (t.t === 'text' ? escape(t.s) : t.t === 'var' ? '.+?' : `(?:${t.opts.map(pattern).join('|')})`)).join('');
}
const regexes = new Map<string, RegExp>();
/** Whether a line could have come from a template. */
function matches(tpl: string, line: string): boolean {
  let r = regexes.get(tpl);
  if (!r) regexes.set(tpl, (r = new RegExp(`^${pattern(toks(tpl))}$`, 'i')));
  return r.test(line);
}

function plural(noun: string): string {
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(ch|sh|s|x)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

function article(n: number): string {
  const s = String(n);
  return s[0] === '8' || n === 11 || n === 18 ? 'an' : 'a';
}

function format(v: string | number, m?: string): string {
  if (m === undefined) return String(v);
  const n = Number(v);
  if (m.toLowerCase() === 'ord') return ORD(n);
  if (m === 'a') return `${article(n)} ${n}`;
  if (m === 'w' || m === 'W') {
    const w = n >= 0 && n <= 10 ? WORDS[n] : String(n);
    return m === 'W' ? cap(w) : w;
  }
  const words = m.startsWith('~');
  let noun = words ? m.slice(1) : m;
  const upper = noun[0] !== noun[0].toLowerCase();
  noun = noun[0].toLowerCase() + noun.slice(1);
  let out: string;
  if (words && noun === 'time' && (n === 1 || n === 2)) out = n === 1 ? 'once' : 'twice';
  else out = `${words && n >= 0 && n <= 10 ? WORDS[n] : n} ${n === 1 ? noun : plural(noun)}`;
  return upper ? cap(out) : out;
}

/** Every fact a template has asked for, and every fact story.ts has given (for tests). */
export const factsGiven = new Set<string>();
export function factsAsked(): Set<string> {
  const out = new Set<string>();
  const walk = (ts: Tok[]) => {
    for (const t of ts) {
      if (t.t === 'var') out.add(t.k);
      else if (t.t === 'alt') t.opts.forEach(walk);
    }
  };
  for (const list of Object.values(BANK)) for (const tpl of list) walk(toks(tpl));
  return out;
}

function render(ts: Tok[], vars: Vars, rng: Rng): string | null {
  let out = '';
  for (const t of ts) {
    if (t.t === 'text') out += t.s;
    else if (t.t === 'alt') {
      const r = render(t.opts[Math.floor(rng() * t.opts.length)], vars, rng);
      if (r === null) return null;
      out += r;
    } else {
      const v = vars[t.k];
      if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return null;
      out += format(v, t.m);
    }
  }
  return cap(anBeforeVowelNumbers(out));
}

/** "a 8th-place squad" -> "an 8th-place squad", "a 11-game run" -> "an 11-game run". */
function anBeforeVowelNumbers(s: string): string {
  return s.replace(/\b([Aa]) (\d+)/g, (m, a: string, n: string) => (article(Number(n)) === 'an' ? `${a}n ${n}` : m));
}

const firstWord = (s: string) => s.split(' ')[0].replace(/[^\p{L}\d]/gu, '').toLowerCase();

// ─────────────────────────── Facts ───────────────────────────

interface Res { md: number; k: number; opp: number; f: number; a: number; home: boolean }

interface Cand {
  key: string;
  /** one line per group */
  group: string;
  /** where the line sits in the story */
  order: number;
  /** what it is about, when two groups could tell the same thing */
  topic?: string;
  /** 0: always; 1: kept first, in this order; 2: drawn by weight */
  p: 0 | 1 | 2;
  w: number;
}

function storyOf(h: SeasonHistory, club: number, user: number): string[] {
  return h.byUser?.[club]?.story ?? (club === user ? h.story ?? [] : []);
}
function statsOf(h: SeasonHistory, club: number, user: number): PlayerSeasonStats[] | undefined {
  return h.byUser?.[club]?.userStats ?? (club === user ? h.userStats : undefined);
}

export function seasonStory(x: StoryInput): string[] {
  const { state, data, club, league } = x;
  const rng = stream(state.seed, 'story', state.season, club);
  const name = (c: number) => {
    const n = data.meta.gameClubs[c];
    return CLUBS.find((i) => i.name === n)?.short ?? n;
  };
  const player = (id: number) => data.names[id]?.[0] ?? 'He';
  const v: Vars = {};
  const cands: Cand[] = [];
  const add = (key: string, group: string, order: number, p: 0 | 1 | 2, w = 1, topic?: string) => {
    if (BANK[key]) cands.push({ key, group, order, p, w, topic });
  };

  // ── The table, matchday by matchday.
  const table = league.table;
  const n = table.length;
  const M = league.rounds.length;
  const finish = table.findIndex((r) => r.club === club) + 1;
  const me = table[finish - 1];
  const champ = table[0];
  Object.assign(v, {
    club: name(club), pos: finish, n, M, pts: me.pts, gf: me.gf, ga: me.ga, w: me.w, d: me.d, l: me.l,
    champ: name(champ.club), season: state.season + 1, pred: x.predicted || undefined,
  });

  const results: Res[] = [];
  const cum = new Map(table.map((r) => [r.club, { pts: 0, gd: 0, gf: 0 }]));
  const posAt: number[] = [];
  const leadAt: number[] = [];
  let k = 0;
  league.rounds.forEach((round, i) => {
    for (const [h, a, hg, ag] of round) {
      const ch = cum.get(h)!;
      const ca = cum.get(a)!;
      ch.gf += hg; ca.gf += ag; ch.gd += hg - ag; ca.gd += ag - hg;
      ch.pts += hg > ag ? 3 : hg === ag ? 1 : 0;
      ca.pts += ag > hg ? 3 : hg === ag ? 1 : 0;
      if (h === club) results.push({ md: i + 1, k, opp: a, f: hg, a: ag, home: true });
      else if (a === club) results.push({ md: i + 1, k, opp: h, f: ag, a: hg, home: false });
      k++;
    }
    const order = [...cum.entries()].sort(([ca, a], [cb, b]) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || ca - cb);
    posAt.push(order.findIndex(([c]) => c === club) + 1);
    const mine = cum.get(club)!.pts;
    leadAt.push(mine - Math.max(...order.filter(([c]) => c !== club).map(([, r]) => r.pts)));
  });
  const topDays = posAt.filter((p) => p === 1).length;
  const lastTopMd = posAt.lastIndexOf(1) + 1;
  const half = Math.floor(M / 2);

  // ── Earlier seasons.
  const past = state.history.filter((h) => h.season < state.season);
  const prevH = past.find((h) => h.season === state.season - 1);
  const prevPos = prevH ? prevH.table.findIndex((r) => r.club === club) + 1 : 0;
  const prevStats = prevH && statsOf(prevH, club, state.user);
  const prevChamp = prevH?.table[0].club === club;
  // Which wordings and stories were told before, and how many seasons ago.
  const usedTpl = new Set<string>();
  const told = new Set(past.flatMap((h) => storyOf(h, club, state.user)));
  const keyAgo = new Map<string, number>();
  for (const h of past) {
    const ago = state.season - h.season;
    for (const line of storyOf(h, club, state.user)) {
      for (const [key, list] of Object.entries(BANK)) {
        for (const tpl of list) {
          if (!matches(tpl, line)) continue;
          usedTpl.add(tpl);
          keyAgo.set(key, Math.min(keyAgo.get(key) ?? 99, ago));
        }
      }
    }
  }
  const novelty = (key: string) => ({ 1: 0.2, 2: 0.45, 3: 0.7 } as Record<number, number>)[keyAgo.get(key) ?? 99] ?? 1;
  const prevCollapse = keyAgo.get('near.collapse') === 1;
  const titles = state.history.filter((h) => h.table[0].club === club).length;
  const trophies = state.history.reduce((a, h) => a + (h.table[0].club === club ? 1 : 0) + (h.faWinner === club ? 1 : 0) + (h.clWinner === club ? 1 : 0), 0);
  Object.assign(v, { prevPos: prevPos || undefined, titles, trophies });

  // ── The headline: the finish, told through the race.
  const heads: [string, number][] = [];
  if (finish === 1) {
    const lead = me.pts - table[1].pts;
    v.lead = lead;
    v.second = name(table[1].club);
    v.topDays = topDays;
    let deficit = 0;
    for (let i = half; i < M; i++) {
      if (-leadAt[i] > deficit) {
        deficit = -leadAt[i];
        v.deficitMd = i + 1;
      }
    }
    v.deficit = deficit;
    if (lead === 0) heads.push(['champ.gd', 5]);
    else {
      if (prevChamp && titles >= 2) heads.push(['champ.repeat', 3.5]);
      if (x.predicted && x.predicted >= 5) heads.push(['champ.underdog', 3]);
      if (deficit >= 6) heads.push(['champ.comeback', 4]);
      if (M > 1 && Math.abs(leadAt[M - 2]) <= 3) heads.push(['champ.finalDay', 4]);
      if (posAt.slice(Math.floor(M * 0.2)).every((p) => p === 1)) heads.push(['champ.wire', 3]);
      if (lead >= 8) heads.push(['champ.procession', 3]);
      if (lead <= 4) heads.push(['champ.close', 2]);
      heads.push(['champ.generic', 0.8]);
    }
  } else {
    const behind = champ.pts - me.pts;
    v.behind = behind;
    const collapse = lastTopMd >= M - 10 && lastTopMd > 0;
    if (collapse) {
      v.lastTopMd = lastTopMd;
      const leadMax = Math.max(...leadAt.slice(half));
      if (leadMax >= 2) v.leadMax = leadMax;
    }
    if (finish <= 3 && (behind <= 6 || collapse)) {
      if (behind === 0) heads.push(['near.gd', 5]);
      else {
        if (collapse) heads.push(['near.collapse', 5]);
        if (finish === 2 && M > 1 && leadAt[M - 2] >= -3) heads.push(['near.finalDay', 4]);
        heads.push(['near.close', 2]);
      }
    } else if (finish === 2) heads.push(['near.distant', 3]);
    else if (finish <= 4) {
      const gap4 = me.pts - table[4].pts;
      if (finish === 4 && gap4 > 0 && gap4 <= 2) {
        Object.assign(v, { gap4, edgeTeam: name(table[4].club) });
        heads.push(['top4.scrape', 3]);
      }
      if (x.predicted && x.predicted >= finish + 4) heads.push(['top4.over', 3]);
      if (prevPos > 4) heads.push(['top4.return', 2.5]);
      heads.push(['top4.generic', 1.5]);
    } else {
      const over = x.predicted && x.predicted >= finish + 4;
      const under = x.predicted && finish >= x.predicted + 4;
      if (finish <= 7) {
        const gap4 = table[3].pts - me.pts;
        if (finish === 5 && gap4 > 0 && gap4 <= 3) {
          Object.assign(v, { gap4, edgeTeam: name(table[3].club) });
          heads.push(['eur.miss', 3]);
        }
        if (over) heads.push(['mid.over', 3]);
        if (under) heads.push(['mid.under', 3]);
        heads.push(['eur.generic', 1.5]);
      } else if (finish <= n - 3) {
        if (over) heads.push(['mid.over', 3]);
        if (under) heads.push(['mid.under', 3]);
        if (!over && !under) heads.push(['mid.drift', 1.5]);
      } else {
        if (finish === n) heads.push(['low.bottom', 3]);
        if (x.predicted && x.predicted <= n / 2) heads.push(['low.under', 3]);
        heads.push(['low.scrap', 2]);
      }
    }
  }
  const headKey = weighted(rng, heads.map(([key, w]) => [key, w * novelty(key)]));
  add(headKey, 'head', 0, 0);

  // ── Continuity.
  const finalSeason = state.season >= NUM_SEASONS - 1;
  if (state.mode === 'draft' && state.season === 0 && finish > 1) add('prev.debut', 'prev', 1, 2, 2.5);
  if (prevH) {
    if (prevCollapse && headKey === 'near.collapse') add('prev.collapseAgain', 'prev', 1, 2, 5);
    else if (prevCollapse && finish <= 2) add('prev.afterCollapse', 'prev', 1, 2, 5);
    if (prevChamp && finish > 1) add('prev.dethroned', 'prev', 1, 2, 3.5);
    if (headKey !== 'top4.return') {
      v.climb = prevPos - finish;
      v.slide = finish - prevPos;
      if (prevPos - finish >= 5) add('prev.climb', 'prev', 1, 2, 2.5);
      if (finish - prevPos >= 5 && !prevChamp) add('prev.slump', 'prev', 1, 2, 2.5);
      if (prevPos === finish && finish > 1) add('prev.same', 'prev', 1, 2, 0.8);
    }
  }
  if (finalSeason) add(trophies === 0 ? 'prev.finalNone' : titles >= 2 || trophies >= 3 ? 'prev.finalWin' : 'prev.finalSome', 'final', 99, 1);
  else add('close.next', 'close', 99, 2, 0.25);

  // ── The race.
  if (M >= 20) {
    const halfPos = posAt[half - 1];
    const startPos = posAt[5];
    const surgePos = posAt[M - 11];
    Object.assign(v, { halfPos, startPos, surgePos, surgeMd: M - 10 });
    if (headKey !== 'champ.comeback') {
      if (halfPos - finish >= 5) add('race.riseAfterHalf', 'race', 2, 2, 2.5);
      if (startPos >= n / 2 && finish <= startPos - 6) add('race.slowStart', 'race', 2, 2, 2);
      if (surgePos - finish >= 3) add('race.lateSurge', 'race', 2, 2, 2);
    }
    if (finish - halfPos >= 5) add('race.fallAfterHalf', 'race', 2, 2, 2.5);
    if (startPos <= 3 && finish >= startPos + 6) add('race.flyingStart', 'race', 2, 2, 2);
    if (finish - surgePos >= 3 && headKey !== 'near.collapse') add('race.lateFade', 'race', 2, 2, 2);
  }

  // ── Runs.
  const streak = (ok: (r: Res) => boolean) => {
    let best = { n: 0, from: 0, end: 0 };
    let cur = { n: 0, from: 0 };
    results.forEach((r, i) => {
      cur = ok(r) ? { n: cur.n + 1, from: cur.n ? cur.from : r.md } : { n: 0, from: 0 };
      if (cur.n > best.n) best = { ...cur, end: i };
    });
    return best;
  };
  const wins = streak((r) => r.f > r.a);
  const unbeaten = streak((r) => r.f >= r.a);
  const winless = streak((r) => r.f <= r.a);
  const losses = streak((r) => r.f < r.a);
  Object.assign(v, {
    winRun: wins.n, winFrom: wins.from, unbRun: unbeaten.n, unbFrom: unbeaten.from,
    wlRun: winless.n, wlFrom: winless.from, lossRun: losses.n, lossFrom: losses.from,
  });
  if (wins.n >= 6) add('run.wins', 'run', 3, 2, 1.5 + (wins.n - 6) / 2);
  if (unbeaten.n >= 12 && unbeaten.n >= wins.n + 4) add('run.unbeaten', 'run', 3, 2, 1.5 + (unbeaten.n - 12) / 4);
  if (winless.n >= 6) add('run.winless', 'run', 3, 2, 2 + (winless.n - 6) / 3);
  if (losses.n >= 4) add('run.losses', 'run', 3, 2, 2);

  // ── Days.
  const vs = (r: Res) => `${r.home ? 'at home to' : 'away at'} ${name(r.opp)}`;
  const best = results.slice().sort((p, q) => q.f - q.a - (p.f - p.a) || q.f - p.f)[0];
  const worst = results.slice().sort((p, q) => p.f - p.a - (q.f - q.a) || q.a - p.a)[0];
  const thriller = results.slice().sort((p, q) => q.f + q.a - (p.f + p.a) || Math.abs(p.f - p.a) - Math.abs(q.f - q.a))[0];
  if (best && best.f - best.a >= 4) {
    Object.assign(v, { bestF: best.f, bestA: best.a, bestVs: vs(best), bestMd: best.md });
    add('day.best', 'day', 6, 2, 1.2);
  }
  if (worst && worst.a - worst.f >= 3) {
    Object.assign(v, { worstF: worst.a, worstA: worst.f, worstVs: vs(worst), worstMd: worst.md });
    add('day.worst', 'day', 6, 2, 1.2);
  }
  if (thriller && thriller.f + thriller.a >= 7 && Math.abs(thriller.f - thriller.a) <= 2) {
    Object.assign(v, {
      thrF: Math.max(thriller.f, thriller.a), thrA: Math.min(thriller.f, thriller.a), thrVs: vs(thriller), thrMd: thriller.md,
      thrRes: thriller.f > thriller.a ? 'win' : thriller.f < thriller.a ? 'defeat' : 'draw',
    });
    add('day.thriller', 'day', 6, 2, 1.6);
  }
  const top4 = new Set(table.slice(0, 4).map((r) => r.club).filter((c) => c !== club));
  const big = results.filter((r) => top4.has(r.opp));
  const bigPts = big.reduce((a, r) => a + (r.f > r.a ? 3 : r.f === r.a ? 1 : 0), 0);
  Object.assign(v, { t4Pts: bigPts, t4Games: big.length });
  if (big.length >= 4 && bigPts >= big.length * 2) add('day.bigGames', 'day', 6, 2, 2, 'big');
  if (big.length >= 4 && bigPts <= big.length * 0.7 && finish <= 8) add('day.bigGamesBad', 'day', 6, 2, 2);
  if (finish > 1) {
    const vsChamp = results.filter((r) => r.opp === champ.club);
    if (vsChamp.length >= 2 && vsChamp.every((r) => r.f > r.a)) add('day.doubleChamp', 'day', 6, 2, 2.5);
  }

  // ── Home and away.
  const home = results.filter((r) => r.home);
  const away = results.filter((r) => !r.home);
  const cs = results.filter((r) => r.a === 0).length;
  const oneNil = results.filter((r) => r.f === 1 && r.a === 0).length;
  Object.assign(v, {
    homeW: home.filter((r) => r.f > r.a).length, homeD: home.filter((r) => r.f === r.a).length, homeL: home.filter((r) => r.f < r.a).length,
    awayW: away.filter((r) => r.f > r.a).length, cs, oneNil: oneNil >= 3 ? oneNil : undefined,
  });
  const style = state.clubs[club].style;
  if (home.length >= 10 && v.homeL === 0) add('ground.fortress', 'ground', 5.5, 2, 2.5);
  if ((v.homeL as number) >= 8) add('ground.homeWoe', 'ground', 5.5, 2, 1.5);
  if ((v.awayW as number) >= 12) add('ground.roadWarriors', 'ground', 5.5, 2, 1.5);
  if (away.length >= 10 && (v.awayW as number) <= 2) add('ground.roadWoe', 'ground', 5.5, 2, 1.8);
  if (me.d >= 13) add('ground.draws', 'ground', 5.5, 2, 1.5);
  if (cs >= 16 && style !== 'bus') add('ground.cleanSheets', 'ground', 5.5, 2, 1.5, 'cs');

  // ── The players.
  const s = (id: number) => x.stats.find((t) => t.id === id);
  const avg = (t: PlayerSeasonStats) => t.ratingSum / Math.max(1, t.apps);
  const teamAvg = x.stats.reduce((a, t) => a + t.ratingSum, 0) / Math.max(1, x.stats.reduce((a, t) => a + t.apps, 0));
  const age = (id: number) => state.players[id]?.age ?? 27;
  const isGk = (id: number) => parsePositions(state.players[id]?.pos ?? '')[0] === 'GK';
  // League goals by player, match by match.
  const goalsIn = new Map<number, number[]>();
  results.forEach((r, i) => {
    for (const [scorer, , side] of league.scorers[r.k] ?? []) {
      if (side !== (r.home ? 0 : 1) || scorer < 0) continue;
      if (!goalsIn.has(scorer)) goalsIn.set(scorer, results.map(() => 0));
      goalsIn.get(scorer)![i]++;
    }
  });
  const scorers = [...goalsIn.values()].map((g) => g.reduce((a, b) => a + b, 0));
  Object.assign(v, { scN: scorers.filter((g) => g > 0).length, sc5: scorers.filter((g) => g >= 5).length });

  const star = state.clubs[club].star;
  const st = star !== undefined ? s(star) : undefined;
  let songName: string | undefined;
  if (style === 'star' && star !== undefined && st && st.apps >= 8) {
    const seq = goalsIn.get(star) ?? results.map(() => 0);
    const slg = seq.reduce((a, b) => a + b, 0);
    const firstHalf = results.reduce((a, r, i) => a + (r.md <= half ? seq[i] : 0), 0);
    // The longest run without a goal, and what came after it.
    let dry = { n: 0, from: 0, end: -1 };
    let cur = 0;
    seq.forEach((g, i) => {
      cur = g ? 0 : cur + 1;
      if (cur > dry.n) dry = { n: cur, from: results[i - cur + 1].md, end: i };
    });
    const after = seq.slice(dry.end + 1, dry.end + 9);
    const sAfter = after.reduce((a, b) => a + b, 0);
    const prev = prevStats?.find((t) => t.id === star && t.apps >= 10);
    const sPrev = prev?.goals;
    const rating = avg(st);
    const area = AREA[parsePositions(state.players[star]?.pos ?? '')[0]];
    const attacker = area === 'ATT' || area === 'MID';
    Object.assign(v, {
      star: player(star), sg: st.goals, sa: st.assists, slg, sAge: age(star), sRat: rating.toFixed(1),
      sFirst: firstHalf, sSecond: slg - firstHalf, sDry: dry.n, sDryFrom: dry.from, sAfter, sAfterN: after.length,
      sHat: seq.filter((g) => g >= 3).length, sBig: results.reduce((a, r, i) => a + (top4.has(r.opp) ? seq[i] : 0), 0),
      sShare: me.gf ? Math.round((100 * slg) / me.gf) : 0, sMates: Math.max(0, me.gf - slg), sPrev, sDelta: sPrev !== undefined ? Math.abs(slg - sPrev) : undefined,
    });
    const arcs: [string, number][] = [];
    const poor = rating < 7 || (attacker && st.goals < 10);
    if (dry.n >= 5 && sAfter >= 4 && after.length >= 3) arcs.push(['star.doubt', 3 + sAfter / 3]);
    if (slg >= 10 && firstHalf <= slg * 0.38) arcs.push(['star.slowBurn', 3]);
    if (slg >= 10 && slg - firstHalf <= slg * 0.35) arcs.push(['star.faded', 2.5]);
    if ((v.sShare as number) >= 40) arcs.push(['star.carry', Math.min(4, 1 + ((v.sShare as number) - 40) / 5)]);
    if (poor) arcs.push(['star.pressure', 4]);
    if (sPrev !== undefined && sPrev >= 12 && slg <= sPrev - 8) arcs.push(['star.dip', 3.5]);
    if (sPrev !== undefined && slg >= sPrev + 8) arcs.push(['star.rebound', 3.5]);
    if (sPrev !== undefined && sPrev >= 20 && slg >= 20 && Math.abs(slg - sPrev) < 8) arcs.push(['star.sameAgain', 2]);
    if ((v.sHat as number) >= 2) arcs.push(['star.hattricks', 1.5 + (v.sHat as number) / 2]);
    if ((v.sBig as number) >= 4 && big.length) arcs.push(['star.bigGame', 2]);
    if (st.goals >= 32) arcs.push(['star.record', st.goals >= 40 ? 2.5 : 1.2]);
    if (age(star) <= 21) arcs.push(['star.young', 2]);
    if (age(star) >= 32) arcs.push(['star.old', 2]);
    if (st.goals >= 12) arcs.push(['star.feud', losses.n >= 3 || winless.n >= 5 ? 1.4 : 0.4]);
    if (!poor) arcs.push(st.goals >= 15 ? ['star.steady', 1] : ['star.quiet', 1]);
    const arc = weighted(rng, arcs.map(([key, w]) => [key, w * novelty(key) * (0.6 + rng())]));
    add(arc, 'star', 4, 1, 1, arc === 'star.bigGame' ? 'big' : undefined);
    if (st.goals >= 25) songName = player(star);
  }

  const others = x.stats.filter((t) => t.id !== star && t.id !== x.pots);
  const young = others
    .filter((t) => t.apps >= 15 && age(t.id) <= 21 && avg(t) >= teamAvg)
    .sort((p, q) => avg(q) - avg(p))[0];
  if (young) {
    Object.assign(v, { yName: player(young.id), yAge: age(young.id), yApps: young.apps, yGoals: young.goals });
    add('p.young', 'p', 4.5, 2, 2.5);
  }
  const vet = others
    .filter((t) => t.apps >= 15 && age(t.id) >= 33 && avg(t) >= teamAvg - 0.05)
    .sort((p, q) => avg(q) - avg(p))[0];
  if (vet) {
    Object.assign(v, { vName: player(vet.id), vAge: age(vet.id), vApps: vet.apps });
    add('p.vet', 'p', 4.5, 2, 2.2);
  }
  const gk = x.stats.filter((t) => isGk(t.id) && t.apps >= 20).sort((p, q) => q.apps - p.apps)[0];
  if (gk && cs >= 12) {
    v.gkName = player(gk.id);
    add('p.gk', 'p', 4.5, 2, 1.5 + (cs - 12) / 4, 'cs');
  }
  if (prevStats && prevStats.length) {
    const before = new Set(prevStats.map((t) => t.id));
    const fresh = others.filter((t) => !before.has(t.id) && t.apps >= 15).sort((p, q) => q.goals - p.goals || avg(q) - avg(p))[0];
    if (fresh) {
      Object.assign(v, { nwName: player(fresh.id), nwApps: fresh.apps, nwGoals: fresh.goals });
      if (fresh.goals >= 8) add('p.newcomer', 'p', 4.5, 2, 2);
      else if (avg(fresh) >= teamAvg + 0.15) add('p.newcomerQuiet', 'p', 4.5, 2, 1.2);
    }
  }
  const boot = league.stats.slice().sort((p, q) => q.goals - p.goals || p.apps - q.apps)[0];
  if (boot && boot.club === club && boot.goals >= 15) {
    Object.assign(v, { bootName: player(boot.id), bootGoals: boot.goals });
    if (!(style === 'star' && boot.id === star)) add('p.boot', 'p', 4.5, 2, 3);
  }
  const top = x.stats.slice().sort((p, q) => q.goals - p.goals)[0];
  if (top && top.goals >= 15 && !(style === 'star' && top.id === star)) {
    Object.assign(v, { tsName: player(top.id), tsGoals: top.goals });
    add('p.scorer', 'p', 4.5, 2, 1.2);
    if (top.goals >= 22) songName ??= player(top.id);
  }
  const creator = x.stats.slice().sort((p, q) => q.assists - p.assists)[0];
  if (creator && creator.assists >= 12 && !(style === 'star' && creator.id === star)) {
    Object.assign(v, { asName: player(creator.id), asN: creator.assists });
    add('p.assists', 'p', 4.5, 2, 1.2);
  }
  if (!songName && young && young.goals >= 8) songName = player(young.id);

  // ── The style.
  if (style === 'tiki') {
    if ((v.scN as number) >= 10 || (v.sc5 as number) >= 4) add('style.tiki', 'style', 5, 2, 2);
    if (me.ga <= 35) add('style.tikiControl', 'style', 5, 2, 1.5);
  } else if (style === 'bus') {
    if (me.ga <= 35 || cs >= 14 || oneNil >= 5) add('style.bus', 'style', 5, 2, 2.5, 'cs');
    if (me.gf <= 45) add('style.busBore', 'style', 5, 2, 1.5);
  } else if (style === 'press') {
    if (me.gf >= 80) add('style.press', 'style', 5, 2, 2.5);
    if (me.gf >= 70 && me.ga >= 50) add('style.pressChaos', 'style', 5, 2, 2);
  }

  // ── The manager and the fans.
  const troubled = winless.n >= 6 || losses.n >= 4 || (x.predicted !== undefined && finish >= x.predicted + 5);
  if (troubled) {
    const recovered = finish <= 6 || (v.halfPos !== undefined && finish <= (v.halfPos as number) - 4);
    add(recovered ? 'mgr.vindicated' : 'mgr.pressure', 'mgr', 6.5, 2, 1.5);
  }
  if (songName) {
    v.songName = songName;
    add('fans.song', 'fans', 7, 2, 1);
  } else if (finish >= n - 5 || (x.predicted !== undefined && finish >= x.predicted + 5)) add('fans.restless', 'fans', 7, 2, 1.2);
  if (finish === 1) add('fans.party', 'fans', 7, 2, 0.8);

  // ── The cups.
  const cupFacts = (cup: CupResult, tag: 'cl' | 'fa') => {
    const reached = cup.reached[club];
    if (!reached || reached === 'Group stage') return reached;
    const round = reached === WINNER ? 'Final' : reached;
    const tie = tiesOf(cup.matches, round).find((t) => t.a === club || t.b === club);
    if (!tie) return reached;
    const [f, a] = tie.a === club ? [tie.ga, tie.gb] : [tie.gb, tie.ga];
    const opp: Entrant = tie.a === club ? tie.b : tie.a;
    const won = tie.winner === club;
    const two = tie.legs.length > 1;
    const score = tie.pens && !won && round !== 'Final' ? 'on penalties' : `${Math.max(f, a)}–${Math.min(f, a)}`;
    v[`${tag}Opp`] = entrantName(opp, name);
    v[`${tag}Round`] = round.toLowerCase();
    v[`${tag}Score`] = tie.pens ? `${f}–${a}` : score;
    if (tag === 'fa' && !won && round !== 'Final') v.faScore = score;
    if (tag === 'cl') v.clOut = tie.pens ? 'on penalties' : two ? `${score} on aggregate` : score;
    // The final's hero: our scorer with the most goals in it.
    if (round === 'Final') {
      const m = tie.legs[0];
      const side = m.home === club ? 0 : 1;
      const count = new Map<number, number>();
      for (const [sc, , sd] of m.scorers) if (sd === side && sc >= 0) count.set(sc, (count.get(sc) ?? 0) + 1);
      const hero = [...count.entries()].sort((p, q) => q[1] - p[1])[0];
      if (hero) {
        v[`${tag}Hero`] = player(hero[0]);
        v[`${tag}HeroG`] = hero[1];
      }
    }
    return { reached, pens: tie.pens, outside: typeof opp === 'string' };
  };
  const clr = cupFacts(x.cl, 'cl');
  const far = cupFacts(x.fa, 'fa');
  const clReached = typeof clr === 'string' ? clr : clr?.reached;
  const faReached = typeof far === 'string' ? far : far?.reached;
  const pens = (r: typeof clr) => typeof r === 'object' && r.pens;
  const clWin = clReached === WINNER;
  const faWin = faReached === WINNER;
  const cupWin = (tag: 'cl' | 'fa', r: typeof clr) => (pens(r) ? `${tag}.winPens` : v[`${tag}Hero`] && rng() < 0.45 ? `${tag}.winHero` : `${tag}.win`);
  if (finish === 1 && clWin && faWin) add('cup.treble', 'cup', 8, 1);
  else if (finish === 1 && faWin) {
    add('cup.doubleFa', 'cup', 8, 1);
    if (clReached === 'Final') add(pens(clr) ? 'cl.finalPens' : 'cl.final', 'cl', 8.2, 1);
  } else if (finish === 1 && clWin) {
    add('cup.doubleCl', 'cup', 8, 1);
    if (faReached === 'Final') add(pens(far) ? 'fa.finalPens' : 'fa.final', 'fa', 8.1, 1);
  } else if (clWin && faWin) add('cup.cupDouble', 'cup', 8, 1);
  else {
    if (clWin) add(cupWin('cl', clr), 'cl', 8.2, 1);
    else if (clReached === 'Final') add(pens(clr) ? 'cl.finalPens' : 'cl.final', 'cl', 8.2, 1);
    else if (clReached === 'Semi-final') add('cl.semi', 'cl', 8.2, 1);
    else if (clReached === 'Quarter-final') add('cl.quarter', 'cl', 8.2, 2, 1.4);
    else if (clReached === 'Round of 16') add('cl.r16', 'cl', 8.2, 2, 0.8);
    else if (clReached === 'Group stage') add('cl.group', 'cl', 8.2, 2, finish <= 4 ? 1.6 : 0.8);
    if (faWin) add(cupWin('fa', far), 'fa', 8.1, 1);
    else if (faReached === 'Final') add(pens(far) ? 'fa.finalPens' : 'fa.final', 'fa', 8.1, 1);
    else if (faReached === 'Semi-final') add('fa.semi', 'fa', 8.1, 2, 1.2);
    else if (typeof far === 'object' && far.outside) add('fa.giantKilling', 'fa', 8.1, 2, 2.2);
  }

  // ── The Ballon d'Or.
  const b = x.ballon.findIndex((e) => e.club === club);
  if (b >= 0) {
    Object.assign(v, { bName: player(x.ballon[b].player), bPlace: b + 1 });
    if (b === 0) add('ballon.win', 'ballon', 8.5, 1);
    else add('ballon.podium', 'ballon', 8.5, 2, 3);
  }

  // ── The rival: the other manager, or a derby.
  const record = (h2h: Res[]) => h2h.map((r) => (r.f > r.a ? `won ${r.f}–${r.a}` : r.f < r.a ? `lost ${r.a}–${r.f}` : `drew ${r.f}–${r.a}`)).join(' and ');
  if (x.rival !== undefined) {
    const h2h = results.filter((r) => r.opp === x.rival);
    if (h2h.length) {
      const w = h2h.filter((r) => r.f > r.a).length;
      const l = h2h.filter((r) => r.f < r.a).length;
      Object.assign(v, { rival: name(x.rival), rRec: record(h2h) });
      add(w > l ? 'rival.won' : l > w ? 'rival.lost' : 'rival.even', 'rival', 7.5, 1);
    }
  } else {
    const mine = data.meta.gameClubs[club];
    for (const [a, bb, label] of DERBIES) {
      const other = a === mine ? bb : bb === mine ? a : undefined;
      const oi = other ? data.meta.gameClubs.indexOf(other) : -1;
      const h2h = oi >= 0 ? results.filter((r) => r.opp === oi) : [];
      if (!h2h.length) continue;
      const w = h2h.filter((r) => r.f > r.a).length;
      const l = h2h.filter((r) => r.f < r.a).length;
      Object.assign(v, { derby: label, dOpp: name(oi), rRec: record(h2h) });
      add(w > l ? 'derby.won' : l > w ? 'derby.lost' : 'derby.even', 'rival', 7.5, 2, w !== l ? 1.8 : 0.8);
      break;
    }
  }

  for (const key of Object.keys(v)) if (v[key] !== undefined) factsGiven.add(key);

  // ── Choose: the headline, the musts, then a weighted draw of the rest.
  const target = 4 + (rng() < 0.55 ? 1 : 0);
  const chosen: Cand[] = [];
  const groups = new Set<string>();
  const take = (c: Cand) => {
    chosen.push(c);
    groups.add(c.group);
    if (c.topic) groups.add(`topic:${c.topic}`);
  };
  const free = (c: Cand) => !groups.has(c.group) && !(c.topic && groups.has(`topic:${c.topic}`));
  const must = cands.filter((c) => c.p < 2).sort((a, b) => rank(a) - rank(b));
  for (const c of must) if (chosen.length < 5 && free(c)) take(c);
  const optional = cands
    .filter((c) => c.p === 2)
    .map((c) => ({ c, score: c.w * novelty(c.key) * (0.35 + rng()) }))
    .sort((a, b) => b.score - a.score);
  for (const { c } of optional) if (chosen.length < Math.max(target, 3) && free(c)) take(c);

  // Write the lines, never opening two the same way or reusing an old wording.
  const firsts = new Set<string>();
  const lines: { order: number; text: string }[] = [];
  for (const c of chosen) {
    const list = shuffle(rng, BANK[c.key]);
    let text: string | null = null;
    // Fresh wording and a fresh opening; then an old wording, never an old
    // line; then a repeated opening; then anything.
    for (let pass = 0; pass < 4 && text === null; pass++) {
      for (const tpl of list) {
        if ((pass === 0 || pass === 2) && usedTpl.has(tpl)) continue;
        const t = render(toks(tpl), v, rng);
        if (t === null || t.length > MAX_LINE) continue;
        if (pass < 2 && firsts.has(firstWord(t))) continue;
        if (pass === 1 && told.has(t)) continue;
        text = t;
        break;
      }
    }
    if (text === null) continue;
    firsts.add(firstWord(text));
    lines.push({ order: c.order, text });
  }
  return lines.sort((a, b) => a.order - b.order).map((l) => l.text);
}

/** Which must-tell lines win when there are more than five. */
function rank(c: Cand): number {
  if (c.p === 0) return 0;
  const k = c.key;
  if (k.startsWith('cup.')) return 1;
  if (k.startsWith('cl.win')) return 2;
  if (k.startsWith('fa.win')) return 2.5;
  if (k === 'ballon.win') return 3;
  if (c.group === 'star') return 4;
  if (k.startsWith('cl.final')) return 5;
  if (k.startsWith('fa.final')) return 5.5;
  if (c.group === 'rival') return 6;
  if (c.group === 'final') return 7;
  return 8;
}

function weighted(rng: Rng, options: [string, number][]): string {
  const total = options.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [key, w] of options) {
    r -= w;
    if (r <= 0) return key;
  }
  return options[options.length - 1][0];
}
