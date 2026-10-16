import { useEffect, useMemo, useState } from 'react';
import type { CupMatch, Entrant } from '../game/cups';
import type { GameData } from '../game/data';
import { type GameState, seasonLabel } from '../game/game';
import { clubOf, type Command, Frame } from './ui';
import './viewer.css';

interface Step {
  round: number;
  league: [number, number, number, number][];
  cups: (CupMatch & { comp: string })[];
}

/** Matchday by matchday, with the user's cup ties and the finals on their dates. */
function buildSteps(game: GameState): Step[] {
  const r = game.result!;
  const n = r.rounds.length;
  const steps: Step[] = r.rounds.map((league, round) => ({ round, league, cups: [] }));
  const place = (comp: string, list: CupMatch[]) =>
    list.forEach((m) => {
      if (m.home !== game.user && m.away !== game.user && m.round !== 'Final') return;
      const at = Math.min(n - 1, Math.max(0, Math.floor((m.slot * n) / 38) - 1));
      steps[at].cups.push({ ...m, comp });
    });
  place('FA Cup', r.fa.matches);
  place('Champions League', r.cl.matches);
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

export function SeasonViewer({ game, data, onDone, fastStart }: { game: GameState; data: GameData; onDone: () => void; fastStart?: boolean }) {
  const steps = useMemo(() => buildSteps(game), [game]);
  const standings = useMemo(() => tables(game), [game]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(!!fastStart);
  const info = clubOf(data, game.user);
  const step = steps[i];
  const name = (e: Entrant) => (typeof e === 'number' ? clubOf(data, e).short : e);

  useEffect(() => {
    if (paused) return;
    if (i >= steps.length - 1) {
      const t = setTimeout(onDone, fast ? 900 : 2200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), fast ? 380 : 1250 + step.cups.length * 350);
    return () => clearTimeout(t);
  }, [i, paused, fast, steps.length, step.cups.length, onDone]);

  const outcome = (h: Entrant, _a: Entrant, hg: number, ag: number, pens?: 0 | 1) => {
    const mine = h === game.user ? hg - ag : ag - hg;
    if (mine !== 0) return mine > 0 ? 'w' : 'l';
    if (pens === undefined) return 'd';
    return (pens === 0) === (h === game.user) ? 'w' : 'l';
  };

  const commands: Command[] = [
    { keys: ['Enter'], label: 'Skip to Results', primary: true, onPress: onDone },
    { keys: ['Space'], label: paused ? 'Resume' : 'Pause', onPress: () => setPaused(!paused) },
    { keys: ['F'], label: fast ? 'Normal Speed' : 'Fast', onPress: () => setFast(!fast) },
  ];
  const table = standings[i];

  return (
    <Frame club={info} title={info.name} sub={`Live · Matchday ${i + 1} of ${steps.length}`} right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>} commands={commands}
      info={<><span>Position</span><b>{table.findIndex((r) => r.club === game.user) + 1}</b></>}>
      <div className="viewer">
        <div className="left">
          <div className="prog"><i style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
          <div className="dpanel md" key={`l${i}`}>
            <div className="ph gbar">Matchday {i + 1}<small>League</small></div>
            {step.league.map(([h, a, hg, ag], k) => {
              const me = h === game.user || a === game.user;
              return (
                <div key={k} className={`res ${me ? 'me' : ''}`} style={{ '--d': `${k * (fast ? 20 : 70)}ms` } as React.CSSProperties}>
                  <span className="h">{name(h)}</span>
                  <span className={`sc ${me ? outcome(h, a, hg, ag) : ''}`}>{hg}–{ag}</span>
                  <span>{name(a)}</span>
                </div>
              );
            })}
            {!step.league.some(([h, a]) => h === game.user || a === game.user) && (
              <div className="res" style={{ '--d': `${10 * 70}ms` } as React.CSSProperties}><span className="h">{info.short}</span><span className="sc">bye</span><span /></div>
            )}
          </div>
          {step.cups.length > 0 && (
            <div className="dpanel cupbox" key={`c${i}`}>
              {step.cups.map((m, k) => {
                const me = m.home === game.user || m.away === game.user;
                return (
                  <div key={k}>
                    <div className="res comp" style={{ '--d': `${700 + k * 300}ms` } as React.CSSProperties}>{m.comp} · {m.round}{m.leg ? ` (leg ${m.leg})` : ''}</div>
                    <div className={`res cup ${me ? 'me' : ''}`} style={{ '--d': `${750 + k * 300}ms` } as React.CSSProperties}>
                      <span className="h">{name(m.home)}</span>
                      <span className={`sc ${me ? outcome(m.home, m.away, m.hg, m.ag, m.pens) : ''}`}>{m.hg}–{m.ag}{m.pens !== undefined ? ' p' : ''}</span>
                      <span>{name(m.away)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
      </div>
      {paused && <div className="paused gbar">PAUSED</div>}
    </Frame>
  );
}
