// The last matchday when the title is still open: the goals that matter,
// minute by minute, and the table as it stands.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameData } from '../game/data';
import type { GameState } from '../game/game';
import { stream } from '../game/rng';
import { clubOf, ordinal } from './ui';

export interface Standing { club: number; p: number; pts: number; gd: number; gf: number }

interface Goal { minute: number; match: number; side: 0 | 1; scorer: number }

/** The clock runs to 90 plus stoppage time. */
const END = 96;
const short = (data: GameData, club: number) => clubOf(data, club).short;
const clock = (minute: number) => (minute > 90 ? `90+${minute - 90}'` : `${minute}'`);

/** The table at a minute of the last matchday: the table before it, plus the scores so far. */
function standingsAt(before: Standing[], round: number[][], goals: Goal[], minute: number): Standing[] {
  const rows = new Map(before.map((x) => [x.club, { ...x }]));
  if (minute > 0) {
    round.forEach(([home, away], k) => {
      const hg = goals.filter((g) => g.match === k && g.side === 0 && g.minute <= minute).length;
      const ag = goals.filter((g) => g.match === k && g.side === 1 && g.minute <= minute).length;
      const th = rows.get(home)!;
      const ta = rows.get(away)!;
      th.p++; ta.p++;
      th.gd += hg - ag; ta.gd += ag - hg; th.gf += hg; ta.gf += ag;
      if (hg > ag) th.pts += 3; else if (hg < ag) ta.pts += 3; else { th.pts++; ta.pts++; }
    });
  }
  return [...rows.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

/** Whether the title is still open going into the last matchday: the user within three points of the top. */
export function titleRace(before: Standing[], user: number): boolean {
  const me = before.find((r) => r.club === user);
  return !!me && me.pts >= before[0].pts - 3;
}

export function FinalDay({ game, data, before, fast, paused, onDone }: {
  game: GameState; data: GameData; before: Standing[]; fast: boolean; paused: boolean; onDone: () => void;
}) {
  const r = game.result!;
  const last = r.rounds.length - 1;
  const round = r.rounds[last];
  const user = game.user;
  const name = (club: number) => short(data, club);
  // Everyone within three points of the top is still in it.
  const contenders = useMemo(() => new Set(before.filter((x) => x.club !== user && x.pts >= before[0].pts - 3).map((x) => x.club)), [before, user]);

  // The goals and their scorers are the real ones; only the minutes are made up.
  const goals = useMemo(() => {
    const offset = r.rounds.slice(0, last).reduce((s, x) => s + x.length, 0);
    const out: Goal[] = [];
    round.forEach(([home, , hg, ag], k) => {
      const rng = stream(game.seed, 'final-day', game.season, home);
      const used = new Set<number>();
      const scorers = r.scorers[offset + k] ?? [];
      ([[0, hg], [1, ag]] as const).forEach(([side, n]) => {
        const mine = scorers.filter((g) => g[2] === side);
        for (let g = 0; g < n; g++) {
          let minute: number;
          do minute = rng() < 0.08 ? 91 + Math.floor(rng() * 5) : 1 + Math.floor(rng() * 90);
          while (used.has(minute));
          used.add(minute);
          out.push({ minute, match: k, side, scorer: mine[g]?.[0] ?? -1 });
        }
      });
    });
    return out.sort((a, b) => a.minute - b.minute);
  }, [r, round, last, game.seed, game.season]);

  // What the feed tells: goals in the games that matter, and every change at the top.
  const feed = useMemo(() => {
    const matters = (k: number) => round[k][0] === user || round[k][1] === user || contenders.has(round[k][0]) || contenders.has(round[k][1]);
    const out: { minute: number; kind: 'goal' | 'ours' | 'lead'; text: string }[] = [];
    let leader = before[0].club;
    for (const g of goals) {
      const [home, away] = round[g.match];
      const hg = goals.filter((x) => x.match === g.match && x.side === 0 && x.minute <= g.minute).length;
      const ag = goals.filter((x) => x.match === g.match && x.side === 1 && x.minute <= g.minute).length;
      if (matters(g.match)) {
        const scorer = g.scorer >= 0 ? `${data.names[g.scorer][0]} · ` : '';
        out.push({ minute: g.minute, kind: home === user || away === user ? 'ours' : 'goal', text: `GOAL! ${scorer}${short(data, home)} ${hg}–${ag} ${short(data, away)}` });
      }
      const top = standingsAt(before, round, goals, g.minute)[0].club;
      if (top !== leader) {
        leader = top;
        out.push({ minute: g.minute, kind: 'lead', text: top === user ? `${short(data, user)} go top! Champions as it stands.` : `${short(data, top)} go top as it stands.` });
      }
    }
    return out;
  }, [goals, round, before, user, contenders, data]);

  const [minute, setMinute] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  const over = minute >= END;
  useEffect(() => {
    if (paused) return;
    if (over) {
      const t = setTimeout(() => done.current(), fast ? 1400 : 2600);
      return () => clearTimeout(t);
    }
    // A breath at half-time.
    const wait = minute === 45 ? (fast ? 500 : 1300) : fast ? 70 : 170;
    const t = setTimeout(() => setMinute((x) => x + 1), wait);
    return () => clearTimeout(t);
  }, [minute, over, paused, fast]);

  const table = standingsAt(before, round, goals, minute);
  const pos = table.findIndex((x) => x.club === user) + 1;
  const gap = table[0].pts - table[pos - 1].pts;
  const mineK = round.findIndex(([h, a]) => h === user || a === user);
  const shown = [mineK, ...round.map((_, k) => k).filter((k) => k !== mineK && (contenders.has(round[k][0]) || contenders.has(round[k][1])))].filter((k) => k >= 0);
  const score = (k: number) => [0, 1].map((side) => goals.filter((g) => g.match === k && g.side === side && g.minute <= minute).length);
  const status = over
    ? pos === 1 ? 'Champions!' : `Finished ${ordinal(pos)}`
    : pos === 1 ? 'Champions as it stands' : `${ordinal(pos)} as it stands${gap > 0 ? ` · ${gap} behind` : ', level on points'}`;
  const recent = feed.filter((e) => e.minute <= minute).reverse();

  return (
    <>
      <div className="left fd">
        <div className="clock">
          <span className="lbl"><small>Final day · the title</small><b>{status}</b></span>
          <span className="min">{over ? 'FT' : minute === 45 ? 'HT' : clock(minute)}</span>
        </div>
        <div className="bar"><i style={{ width: `${(Math.min(minute, 90) / 90) * 100}%` }} /></div>
        <div className="games">
          {mineK < 0 && (
            <div className="game ours"><span className="h">{name(user)}</span><span className="sc">–</span><span>No match today</span><span className="tag">BYE</span></div>
          )}
          {shown.map((k) => {
            const [home, away] = round[k];
            const [x, y] = score(k);
            const club = k === mineK ? user : contenders.has(home) ? home : away;
            const at = table.findIndex((t) => t.club === club) + 1;
            return (
              <div key={k} className={`game ${k === mineK ? 'ours' : 'them'}`}>
                <span className="h">{name(home)}</span>
                <span key={`${x}-${y}`} className={`sc ${x + y > 0 ? 'scored' : ''}`}>{x}–{y}</span>
                <span>{name(away)}</span>
                <span className="tag">{ordinal(at)}</span>
              </div>
            );
          })}
        </div>
        <div className="feed">
          {recent.map((e, k) => (
            <div key={`${e.minute}-${e.text}-${k}`} className={`ev ${e.kind}`}><span className="m">{clock(e.minute)}</span><span>{e.text}</span></div>
          ))}
          {recent.length === 0 && (
            <div className="ev"><span className="m">0'</span><span>{pos === 1 ? `Kick-off. ${name(user)} start the day top, ${before[0].pts - before[1].pts} clear.` : `Kick-off. ${name(user)} start the day ${gap} behind ${name(table[0].club)}.`}</span></div>
          )}
        </div>
      </div>
      <div className="live dpanel">
        <div className="ph gbar">As It Stands<small>P · Pts</small></div>
        <div className="rows">
          {table.map((t, k) => (
            <div key={t.club} className={`row ${k < 4 ? 'cl' : k >= table.length - 3 ? 'rel' : ''} ${t.club === user ? 'me' : ''} ${contenders.has(t.club) ? 'them' : ''}`}>
              <span>{k + 1}</span><span>{name(t.club)}</span><span className="r">{t.p}</span><span className="r">{t.pts}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
