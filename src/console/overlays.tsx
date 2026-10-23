import { useContext, useMemo, useState } from 'react';
import { PlayerCard } from './awards';
import { type CareerPlayer, career, careerScore, mergeStats } from '../game/career';
import { WINNER } from '../game/cups';
import { EXTERNAL, type GameState, seasonLabel, topTransfers, trophiesOf } from '../game/game';
import type { GameData } from '../game/data';
import { type Column, SortTable } from './SortTable';
import { clubOf, type Command, money, ordinal, Overlay, primaryPos } from './ui';
import { GameContext } from '../ui/context';

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
            <tr><th className="n">#</th><th>Player</th><th>From</th><th>To</th><th className="n sort">Fee</th></tr>
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
  const [card, setCard] = useState<number | null>(null);
  const legends = c.players.filter((p) => p.apps >= 10);
  const name = (id: number) => data.names[id][0];
  const awards = game.history.flatMap((h) => [
    ...(h.pots !== undefined ? [{ season: h.season, label: 'Player of the Season', id: h.pots }] : []),
    ...(h.ballon ?? []).flatMap((b, i) => (b.club === game.user ? [{ season: h.season, label: `Ballon d'Or ${['winner', '2nd', '3rd'][i]}`, id: b.player }] : [])),
  ]);
  return (
    <Overlay title="Hall of Fame" wide>
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
      <div className="panes" style={{ height: 340, gridTemplateColumns: '1fr 1.4fr' }}>
        <div className="pane dpanel">
          <div className="ph gbar">Season by Season</div>
          <div className="kvlist scroll">
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
            {awards.length > 0 && <div className="head">Awards</div>}
            {awards.map((a) => (
              <div key={`${a.season}-${a.label}`} className="click" onClick={() => setCard(a.id)}>
                <span>{seasonLabel(a.season)} · {a.label}</span><b>{name(a.id)}</b>
              </div>
            ))}
            <div className="head">Legacy score</div>
            <div><span>So far</span><b>{c.score.toLocaleString('en-GB')}</b></div>
          </div>
        </div>
        <div className="pane dpanel">
          <div className="ph gbar">Club Legends<small>Click a player for his card</small></div>
          <div className="tblwrap scroll">
            {legends.length === 0 ? (
              <div className="empty">No legends yet.</div>
            ) : (
              <SortTable rows={legends} columns={careerColumns(data)} initial="score" rowKey={(p) => p.id} onRow={(p) => setCard(p.id)} />
            )}
          </div>
        </div>
      </div>
      {card !== null && <PlayerCard game={game} data={data} id={card} onClose={() => setCard(null)} />}
    </Overlay>
  );
}

export function closeCommand(close: () => void): Command[] {
  return [{ keys: ['Escape', 'Enter'], label: 'Close', primary: true, onPress: close }];
}

/** Asks before leaving a career, which ends it. */
export function LeaveCareer() {
  const room = useContext(GameContext)?.room;
  return (
    <Overlay title={room ? 'Leave This Room?' : 'Leave This Career?'}>
      <div className="empty" style={{ color: '#fff' }}>
        {room
          ? `The room carries on without you. Come back any time: Play a Friend, then join with code ${room.code} on this device.`
          : 'Careers are not saved. If you leave now, this one is over and you start again from a new club.'}
      </div>
    </Overlay>
  );
}

export function leaveCommands(leave: () => void, stay: () => void): Command[] {
  return [
    { keys: ['Enter'], label: 'Leave', primary: true, onPress: leave },
    { keys: ['Escape'], label: 'Stay', onPress: stay },
  ];
}

/** Columns for a player's career totals. */
export function careerColumns(data: GameData): Column<CareerPlayer>[] {
  return [
    { key: 'name', label: 'Player', wide: true, value: (p) => data.names[p.id][0] },
    { key: 'apps', label: 'Apps', num: true, value: (p) => p.apps },
    { key: 'goals', label: 'Goals', num: true, value: (p) => p.goals },
    { key: 'assists', label: 'Assists', num: true, value: (p) => p.assists },
    { key: 'avg', label: 'Avg', num: true, title: 'Average match rating', value: (p) => p.avg, show: (p) => p.avg.toFixed(2) },
    { key: 'score', label: 'Impact', num: true, title: 'Sustained quality: appearances, rating, goals and assists', value: (p) => careerScore(p), show: (p) => Math.round(careerScore(p)) },
  ];
}

export interface SeasonPlayer {
  id: number;
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  avg: number;
}

/** Columns for a player's season, league and cups together. */
export function seasonColumns(game: GameState, data: GameData): Column<SeasonPlayer>[] {
  return [
    { key: 'name', label: 'Player', wide: true, value: (s) => data.names[s.id][0] },
    { key: 'pos', label: 'Pos', value: (s) => primaryPos(game.players[s.id]?.pos ?? '') },
    { key: 'starts', label: 'Starts', num: true, value: (s) => s.starts },
    { key: 'sub', label: 'Sub', num: true, title: 'Appearances off the bench', value: (s) => s.apps - s.starts },
    { key: 'goals', label: 'Goals', num: true, value: (s) => s.goals },
    { key: 'assists', label: 'Assists', num: true, value: (s) => s.assists },
    { key: 'avg', label: 'Avg Rating', num: true, value: (s) => s.avg, show: (s) => <b>{s.avg.toFixed(2)}</b> },
  ];
}

/** The user's players in a season, league and cups together. */
export function seasonPlayers(game: GameState, season: number): SeasonPlayer[] {
  const h = game.history.find((x) => x.season === season);
  if (!h) return [];
  return mergeStats(h.userStats, h.userCupStats).map((s) => ({ id: s.id, apps: s.apps, starts: s.starts, goals: s.goals, assists: s.assists, avg: s.ratingSum / s.apps }));
}

export function reachedText(r: string | undefined): string {
  if (!r) return 'Did not qualify';
  if (r === WINNER) return 'Winners';
  if (r === 'Final') return 'Runners-up';
  return r;
}

/** One finished season of the career: league, cups and every player's numbers. */
export function SeasonReport({ game, data, season }: { game: GameState; data: GameData; season: number }) {
  const h = game.history.find((x) => x.season === season)!;
  const at = h.table.findIndex((r) => r.club === game.user);
  const row = h.table[at];
  const won = trophiesOf(h, game.user);
  const scorer = h.topScorers[0];
  return (
    <Overlay title={`Season Report · ${seasonLabel(season)}`}>
      <div className="office three" style={{ height: 120 }}>
        <div className="col">
          <span className="cap">League</span>
          <span className="big">{ordinal(at + 1)} · {row.pts} pts</span>
          <span className="kv"><span>W{row.w} D{row.d} L{row.l}</span><span>Goals {row.gf}–{row.ga}</span></span>
        </div>
        <div className="sep" />
        <div className="col">
          <span className="cap">Cups</span>
          <span className="kv"><span>FA Cup</span><b>{reachedText(h.faReached[game.user])}</b></span>
          <span className="kv"><span>Europe</span><b>{reachedText(h.clReached[game.user])}</b></span>
        </div>
        <div className="sep" />
        <div className="col">
          <span className="cap">{won.length === 3 ? 'The Treble' : 'Trophies'}</span>
          <span className="big">{won.length ? won.map((t) => TROPHY[t]).join(' · ') : 'None'}</span>
          <span className="kv"><span>{h.predicted ? `Predicted ${ordinal(h.predicted)} on paper` : `Champions: ${clubOf(data, h.table[0].club).short}`}</span></span>
        </div>
      </div>
      <div className="panes" style={{ height: 330, gridTemplateColumns: '1fr' }}>
        <div className="pane dpanel">
          <div className="ph gbar">Your Players<small>{scorer ? `Golden Boot: ${data.names[scorer[0]][0]} (${clubOf(data, scorer[1]).short}) ${scorer[2]}` : 'All competitions'}</small></div>
          <div className="tblwrap scroll">
            <SortTable rows={seasonPlayers(game, season)} columns={seasonColumns(game, data)} initial="avg" rowKey={(s) => s.id} />
          </div>
        </div>
      </div>
    </Overlay>
  );
}
