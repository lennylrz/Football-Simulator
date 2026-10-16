import { useMemo } from 'react';
import { career, careerScore } from '../game/career';
import { EXTERNAL, type GameState, seasonLabel, topTransfers } from '../game/game';
import type { GameData } from '../game/data';
import { clubOf, type Command, money, ordinal, Overlay } from './ui';

export function AroundTheLeague({ game, data }: { game: GameState; data: GameData }) {
  const top = topTransfers(game, game.season);
  const side = (club: number, other?: string) => (club === EXTERNAL ? other ?? '' : clubOf(data, club).short);
  return (
    <Overlay title={`Around the League · Biggest Deals ${seasonLabel(game.season)}`}>
      {top.length === 0 ? (
        <div className="empty">No deals yet this summer.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr><th className="n">#</th><th>Player</th><th>From</th><th>To</th><th className="n sort">Fee ▼</th></tr>
          </thead>
          <tbody>
            {top.map((t, i) => (
              <tr key={i} className={t.to === game.user || t.from === game.user ? 'sel' : ''}>
                <td className="n">{i + 1}</td>
                <td>{data.names[t.player][0]}</td>
                <td>{side(t.from, t.other)}</td>
                <td>{side(t.to, t.other)}</td>
                <td className="n">{money(t.fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Overlay>
  );
}

const TROPHY = { league: 'League', fa: 'FA Cup', cl: 'Europe' } as const;

export function HallOfFame({ game, data }: { game: GameState; data: GameData }) {
  const c = useMemo(() => career(game), [game]);
  const legends = c.players.filter((p) => p.apps >= 10).sort((a, b) => careerScore(b) - careerScore(a)).slice(0, 10);
  const name = (id: number) => data.names[id][0];
  return (
    <Overlay title="Hall of Fame">
      <div className="office" style={{ height: 120 }}>
        <div className="col">
          <span className="cap">Trophy Cabinet</span>
          <span className="big">
            {c.trebles > 0 ? `Treble Winners${c.trebles > 1 ? ` ×${c.trebles}` : ''}` : `${c.trophies.league + c.trophies.fa + c.trophies.cl} Trophies`}
          </span>
          <span className="kv">
            <span>League {c.trophies.league}</span><span>FA Cup {c.trophies.fa}</span><span>Europe {c.trophies.cl}</span>
          </span>
        </div>
        <div className="sep" />
        <div className="col">
          <span className="cap">Player of the Career</span>
          <span className="big">{c.playerOfCareer ? name(c.playerOfCareer.id) : '—'}</span>
          {c.playerOfCareer && (
            <span className="kv">
              <span>{c.playerOfCareer.apps} apps · {c.playerOfCareer.goals} goals</span><b>Avg {c.playerOfCareer.avg.toFixed(2)}</b>
            </span>
          )}
        </div>
      </div>
      <div className="panes" style={{ height: 340 }}>
        <div className="pane dpanel">
          <div className="ph gbar">Season by Season</div>
          <div className="kvlist">
            {c.seasons.length === 0 && <div><span>Play a season to start your legacy.</span></div>}
            {c.seasons.map((s) => (
              <div key={s.season}>
                <span>{seasonLabel(s.season)} · {ordinal(s.finish)}</span>
                <b>{s.trophies.length === 3 ? 'TREBLE' : s.trophies.map((t) => TROPHY[t]).join(', ') || '—'}</b>
              </div>
            ))}
            {c.bestPick && <div className="head">Best pick</div>}
            {c.bestPick && <div><span>{name(c.bestPick.player)}</span><b className="up">{c.bestPick.from} → {c.bestPick.to}</b></div>}
            {c.worstPick && <div className="head">Worst pick</div>}
            {c.worstPick && <div><span>{name(c.worstPick.player)}</span><b className="down">{c.worstPick.from} → {c.worstPick.to}</b></div>}
            <div className="head">Legacy score</div>
            <div><span>So far</span><b>{c.score.toLocaleString('en-GB')}</b></div>
          </div>
        </div>
        <div className="pane dpanel">
          <div className="ph gbar">Club Legends<small>All competitions</small></div>
          <div className="tblwrap scroll">
            {legends.length === 0 ? (
              <div className="empty">No legends yet.</div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Player</th><th className="n">Apps</th><th className="n">Goals</th><th className="n sort">Avg</th></tr></thead>
                <tbody>
                  {legends.map((p) => (
                    <tr key={p.id}><td className="ellip">{name(p.id)}</td><td className="n">{p.apps}</td><td className="n">{p.goals}</td><td className="n">{p.avg.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

export function closeCommand(close: () => void): Command[] {
  return [{ keys: ['Escape', 'Enter'], label: 'Close', primary: true, onPress: close }];
}
