import { useEffect, useMemo, useState } from 'react';
import type { CupMatch, Entrant } from '../game/cups';
import type { GameData } from '../game/data';
import { type GameState, type HeadToHead, seasonLabel } from '../game/game';
import { FinalDay, titleRace } from './FinalDay';
import { Burst } from './moments';
import { LiveMatch } from './room';
import { clubOf, type Command, Frame, OnStage } from './ui';
import './viewer.css';

type Score = { home: Entrant; away: Entrant; hg: number; ag: number; pens?: 0 | 1; leg?: 1 | 2 };

/** One screen of the season: a league matchday, or a cup day of its own. */
type Step =
  | { kind: 'league'; matchday: number; time: number; matches: Score[] }
  | { kind: 'cup'; comp: 'FA Cup' | 'Champions League'; round: string; leg?: 1 | 2; time: number; matches: Score[]; table: number };

/**
 * League matchdays, with cup days in between on their dates: every day the
 * user plays, and the semi-finals and finals.
 */
function buildSteps(game: GameState): Step[] {
  const r = game.result!;
  const n = r.rounds.length;
  const steps: Step[] = r.rounds.map((round, k) => ({
    kind: 'league', matchday: k + 1, time: ((k + 1) * 38) / n, matches: round.map(([home, away, hg, ag]) => ({ home, away, hg, ag })),
  }));
  const me = (m: CupMatch) => m.home === game.user || m.away === game.user;
  const ours = (e: Entrant) => typeof e === 'number';
  const cup = (comp: 'FA Cup' | 'Champions League', list: CupMatch[]) => {
    const days = new Map<number, CupMatch[]>();
    for (const m of list) days.set(m.slot, [...(days.get(m.slot) ?? []), m]);
    for (const [slot, day] of days) {
      const mine = day.find(me);
      const round = day[0].round;
      if (!mine && !/Semi|Final/.test(round)) continue;
      let shown = day;
      if (round === 'Group stage') {
        // Just the user's group.
        const group = r.cl.groups?.find((g) => g.some((x) => x.team === game.user));
        const teams = new Set(group?.map((x) => x.team));
        shown = day.filter((m) => teams.has(m.home));
      } else if (comp === 'FA Cup' && day.length > 8) {
        shown = day.filter((m) => me(m) || (ours(m.home) && ours(m.away)));
      }
      shown = [...shown].sort((a, b) => Number(me(b)) - Number(me(a)));
      steps.push({ kind: 'cup', comp, round, leg: day[0].leg, time: slot, matches: shown, table: 0 });
    }
  };
  cup('Champions League', r.cl.matches);
  cup('FA Cup', r.fa.matches);
  steps.sort((a, b) => a.time - b.time || (a.kind === 'league' ? -1 : 1));
  // The league table to show beside a cup day is the one after the last league matchday.
  let last = 0;
  for (const s of steps) {
    if (s.kind === 'league') last = s.matchday - 1;
    else s.table = last;
  }
  return steps;
}

function tables(game: GameState): { club: number; p: number; pts: number; gd: number; gf: number }[][] {
  const r = game.result!;
  const t = new Map(game.clubs.map((c) => [c.id, { club: c.id, p: 0, pts: 0, gd: 0, gf: 0 }]));
  return r.rounds.map((round) => {
    for (const [h, a, hg, ag] of round) {
      const th = t.get(h)!;
      const ta = t.get(a)!;
      th.p++; ta.p++;
      th.gd += hg - ag; ta.gd += ag - hg; th.gf += hg; ta.gf += ag;
      if (hg > ag) th.pts += 3; else if (hg < ag) ta.pts += 3; else { th.pts++; ta.pts++; }
    }
    return [...t.values()].map((x) => ({ ...x })).sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
  });
}

export function SeasonViewer({ game, data, onDone, fastStart, rival }: { game: GameState; data: GameData; onDone: () => void; fastStart?: boolean; rival?: number }) {
  const steps = useMemo(() => buildSteps(game), [game]);
  const standings = useMemo(() => tables(game), [game]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(!!fastStart);
  const info = clubOf(data, game.user);
  const step = steps[i];
  const name = (e: Entrant) => (typeof e === 'number' ? clubOf(data, e).short : e);
  const leagueDays = steps.filter((s) => s.kind === 'league').length;
  // Two-player room: a match against the rival is played out live first.
  const h2h = game.history[game.history.length - 1]?.h2h ?? [];
  const meeting = (s: Step): HeadToHead | undefined =>
    rival === undefined ? undefined : h2h.find((m) => (s.kind === 'league' ? m.comp.startsWith('League') && m.slot === s.matchday : m.slot === s.time && m.comp.startsWith(s.comp)));
  const [watched, setWatched] = useState<Set<number>>(() => new Set());
  const live = !watched.has(i) ? meeting(step) : undefined;

  const outcome = (m: Score) => {
    const mine = m.home === game.user ? m.hg - m.ag : m.ag - m.hg;
    if (mine !== 0) return mine > 0 ? 'w' : 'l';
    if (m.pens === undefined) return 'd';
    return (m.pens === 0) === (m.home === game.user) ? 'w' : 'l';
  };

  // The matchday the title is won: the first after which nobody can catch the user.
  const clinched = useMemo(() => {
    if (standings[leagueDays - 1][0].club !== game.user) return -1;
    return standings.findIndex((t, k) => t[0].club === game.user && (k === leagueDays - 1 || t[0].pts - t[1].pts > 3 * (leagueDays - 1 - k))) + 1;
  }, [standings, leagueDays, game.user]);
  // Still open going into the last matchday: that one is played out live.
  const lastLeague = steps.findIndex((s) => s.kind === 'league' && s.matchday === leagueDays);
  const decider = leagueDays > 1 && (clinched === -1 || clinched === leagueDays) && titleRace(standings[leagueDays - 2], game.user);
  const [decided, setDecided] = useState(false);
  const deciding = decider && i === lastLeague && !decided;
  /** The screen lights up: the title won on this matchday, or a final won on this cup day. */
  const burst = (() => {
    if (deciding) return null;
    if (step.kind === 'league') return step.matchday === clinched ? { title: 'Champions', sub: `League · Matchday ${step.matchday}` } : null;
    const final = step.round === 'Final' && step.leg !== 2 ? step.matches.find((m) => m.home === game.user || m.away === game.user) : undefined;
    return final && outcome(final) === 'w' ? { title: step.comp === 'FA Cup' ? 'Cup Winners' : 'Kings of Europe', sub: `${step.comp} · Final` } : null;
  })();
  const bursting = !!burst;

  useEffect(() => {
    if (paused || live || deciding) return;
    if (i >= steps.length - 1) {
      const t = setTimeout(onDone, bursting ? 3400 : fast ? 900 : 2200);
      return () => clearTimeout(t);
    }
    const mine = step.matches.some((m) => m.home === game.user || m.away === game.user);
    const wait = bursting ? (fast ? 2000 : 3400) : step.kind === 'cup' ? (fast ? 650 : 1700) : fast ? 380 : mine ? 1250 : 900;
    const t = setTimeout(() => setI((x) => x + 1), wait);
    return () => clearTimeout(t);
  }, [i, paused, fast, steps.length, step, game.user, onDone, live, deciding, bursting]);
  const WORD = { w: 'WIN', d: 'DRAW', l: 'LOSS' } as const;

  const commands: Command[] = live ? [
    { keys: ['Enter'], label: 'Skip to Full Time', primary: true, onPress: () => setWatched((w) => new Set(w).add(i)) },
    { keys: ['F'], label: fast ? 'Normal Speed' : 'Fast', onPress: () => setFast(!fast) },
  ] : deciding ? [
    { keys: ['Enter'], label: 'Skip to Full Time', primary: true, onPress: () => setDecided(true) },
    { keys: ['Space'], label: paused ? 'Resume' : 'Pause', onPress: () => setPaused(!paused) },
    { keys: ['F'], label: fast ? 'Normal Speed' : 'Fast', onPress: () => setFast(!fast) },
  ] : [
    { keys: ['Enter'], label: 'Skip to Results', primary: true, onPress: onDone },
    { keys: ['Space'], label: paused ? 'Resume' : 'Pause', onPress: () => setPaused(!paused) },
    { keys: ['Left', 'Right'], label: 'Step', onPress: (k) => { setPaused(true); setI((x) => Math.max(0, Math.min(steps.length - 1, x + (k === 'Left' ? -1 : 1)))); } },
    { keys: ['F'], label: fast ? 'Normal Speed' : 'Fast', onPress: () => setFast(!fast) },
  ];
  const tableAt = step.kind === 'league' ? step.matchday - 1 : step.table;
  const table = standings[tableAt];
  const title = step.kind === 'league'
    ? `Matchday ${step.matchday}`
    : `${step.round}${step.leg ? ` · ${step.leg === 1 ? 'first' : 'second'} leg` : ''}`;
  const mine = step.matches.find((m) => m.home === game.user || m.away === game.user);

  // The matchday: the user's match on top, the rest below, the table beside.
  const board = (
    <>
      <div className="left">
        <div className="prog"><i style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        <div className={`dpanel md ${step.kind === 'cup' ? (step.comp === 'FA Cup' ? 'fa' : 'cl') : ''}`} key={i}>
          <div className="ph gbar">{title}<small>{step.kind === 'league' ? 'League' : step.comp}</small></div>
          {mine && (
            <div className={`mine ${outcome(mine)}`}>
              <span className="h">{name(mine.home)}</span>
              <span className="sc">{mine.hg}–{mine.ag}{mine.pens !== undefined ? ' p' : ''}</span>
              <span>{name(mine.away)}</span>
              <span className="word">{WORD[outcome(mine)]}</span>
            </div>
          )}
          {!mine && step.kind === 'league' && <div className="mine bye"><span className="h">{info.short}</span><span className="sc">–</span><span>No match this week</span><span className="word">BYE</span></div>}
          <div className="others">
            {step.matches.filter((m) => m !== mine).map((m, k) => (
              <div key={k} className={`res ${rival !== undefined && (m.home === rival || m.away === rival) ? 'rivalrow' : ''}`}>
                <span className="h">{name(m.home)}</span>
                <span className="sc">{m.hg}–{m.ag}{m.pens !== undefined ? ' p' : ''}</span>
                <span>{name(m.away)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="live dpanel">
        <div className="ph gbar">League Table<small>P · Pts</small></div>
        <div className="rows">
          {table.map((r, k) => (
            <div key={r.club} className={`row ${k < 4 ? 'cl' : k >= table.length - 3 ? 'rel' : ''} ${r.club === game.user ? 'me' : ''}`}>
              <span>{k + 1}</span><span>{clubOf(data, r.club).short}</span><span className="r">{r.p}</span><span className="r">{r.pts}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <Frame club={info} title={info.name} sub={step.kind === 'league' ? `Live · Matchday ${step.matchday} of ${leagueDays}` : `Live · ${step.comp}`}
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>} commands={commands}
      info={deciding ? <><span>The title</span><b>Final day</b></> : <><span>League position</span><b>{table.findIndex((r) => r.club === game.user) + 1}</b></>}>
      <div className="viewer">
        {deciding ? (
          <FinalDay game={game} data={data} before={standings[leagueDays - 2]} fast={fast} paused={paused || !!live} onDone={() => setDecided(true)} />
        ) : board}
        {paused && <div className="paused gbar">PAUSED</div>}
      </div>
      {burst && <OnStage><Burst key={i} title={burst.title} sub={burst.sub} club={info} /></OnStage>}
      {live && <LiveMatch game={game} data={data} match={live} season={game.season} fast={fast} onDone={() => setWatched((w) => new Set(w).add(i))} />}
    </Frame>
  );
}
