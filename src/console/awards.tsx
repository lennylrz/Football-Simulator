// Season story and awards, and a player's card with his rating over the
// career: all quick to glance at, with the detail there for whoever wants it.
import { useEffect, useState } from 'react';
import { mergeStats } from '../game/career';
import type { GameData } from '../game/data';
import { type GameState, type SeasonHistory, seasonLabel } from '../game/game';
import { parsePositions } from '../game/positions';
import type { PlayerSeasonStats } from '../game/season';
import './awards.css';
import { clubOf } from './ui';

const PLACE = ['1st', '2nd', '3rd'];

function clubName(data: GameData, c: number | string): string {
  return typeof c === 'number' ? clubOf(data, c).name : c;
}

function line(s: PlayerSeasonStats | undefined): string {
  if (!s) return 'Did not play';
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
  return `${n(s.apps, 'app')} · ${n(s.goals, 'goal')} · ${n(s.assists, 'assist')} · avg ${(s.ratingSum / s.apps).toFixed(2)}`;
}

/** The season in a few lines, the player of the season and the world's awards. */
export function SeasonStory({ h, data, user, game }: { h: SeasonHistory; data: GameData; user: number; game: GameState }) {
  const [card, setCard] = useState<number | null>(null);
  const mine = mergeStats(h.userStats, h.userCupStats);
  const pots = h.pots !== undefined ? mine.find((s) => s.id === h.pots) : undefined;
  const boot = h.topScorers[0];
  return (
    <>
      <div className="pane dpanel story">
        <div className="ph gbar">Your Season<small>{seasonLabel(h.season)}</small></div>
        <div className="story-lines">
          {(h.story ?? []).map((t, i) => <p key={i}>{t}</p>)}
        </div>
        {pots && (
          <button className="award pots" onClick={() => setCard(pots.id)} tabIndex={-1}>
            <span className="cap">Player of the Season</span>
            <b>{data.names[pots.id][0]}</b>
            <span>{line(pots)}</span>
            <small>Click for his card</small>
          </button>
        )}
      </div>
      <div className="pane dpanel awards" style={{ flex: 'none', width: 430 }}>
        <div className="ph gbar">Ballon d'Or<small>The world's best</small></div>
        <div className="podium">
          {(h.ballon ?? []).map((b, i) => (
            <div key={b.player} className={`place p${i + 1} ${b.club === user ? 'mine' : ''}`}>
              <span className="medal">{PLACE[i]}</span>
              <span className="who">
                <b>{data.names[b.player][0]}</b>
                <small>{clubName(data, b.club)}{b.goals !== undefined ? ` · ${b.goals} league goals` : ''}</small>
              </span>
            </div>
          ))}
        </div>
        {boot && (
          <>
            <div className="ph gbar">Golden Boot<small>League</small></div>
            <div className={`place ${boot[1] === user ? 'mine' : ''}`}>
              <span className="medal boot">{boot[2]}</span>
              <span className="who"><b>{data.names[boot[0]][0]}</b><small>{clubOf(data, boot[1]).name}</small></span>
            </div>
          </>
        )}
      </div>
      {card !== null && <PlayerCard game={game} data={data} id={card} onClose={() => setCard(null)} />}
    </>
  );
}

interface Point { label: string; ovr: number }

/** The player's rating at each step of the career, as a small line chart. */
function RatingChart({ points }: { points: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520;
  const H = 170;
  const pad = { l: 34, r: 16, t: 18, b: 26 };
  const lo = Math.floor((Math.min(...points.map((p) => p.ovr)) - 2) / 5) * 5;
  const hi = Math.ceil((Math.max(...points.map((p) => p.ovr)) + 2) / 5) * 5;
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
  const ticks = [];
  for (let v = lo; v <= hi; v += 5) ticks.push(v);
  return (
    <svg className="rchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rating: ${points.map((p) => `${p.label} ${p.ovr}`).join(', ')}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 8} y={y(v) + 4} className="axis" textAnchor="end">{v}</text>
        </g>
      ))}
      <polyline className="line" points={points.map((p, i) => `${x(i)},${y(p.ovr)}`).join(' ')} />
      {points.map((p, i) => (
        <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <circle cx={x(i)} cy={y(p.ovr)} r={14} className="hit" />
          <circle cx={x(i)} cy={y(p.ovr)} r={hover === i ? 6 : 4.5} className="dot" />
          <text x={x(i)} y={H - 8} className="axis" textAnchor="middle">{p.label}</text>
          {(i === 0 || i === points.length - 1 || hover === i) && (
            <text x={x(i)} y={y(p.ovr) - 10} className="val" textAnchor="middle">{p.ovr}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** A player's card: who he is, his rating over the career and his seasons. */
export function PlayerCard({ game, data, id, onClose }: { game: GameState; data: GameData; id: number; onClose: () => void }) {
  // Esc closes the card before the screen behind it sees the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const p = game.players[id];
  const [name, nation] = data.names[id];
  // His rating when drafted, in each season he played for the club, and now.
  const pick = game.draft?.picks.find((x) => x.player === id);
  const points: Point[] = [];
  if (pick) points.push({ label: 'Drafted', ovr: pick.ovr });
  const seasons = game.history.map((h) => {
    const r = h.ratings?.find(([pid]) => pid === id);
    const st = mergeStats(h.userStats, h.userCupStats).find((s) => s.id === id);
    return { h, ovr: r?.[1], st };
  }).filter((s) => s.ovr !== undefined || s.st);
  for (const s of seasons) if (s.ovr !== undefined) points.push({ label: seasonLabel(s.h.season), ovr: s.ovr });
  if (!p.retired) points.push({ label: 'Now', ovr: p.ovr });
  // Drop a repeat of the drafted rating in the first season.
  const shown = points.filter((pt, i) => !(i === 1 && pt.ovr === points[0].ovr && points[0].label === 'Drafted'));
  const awards = game.history.flatMap((h) => [
    ...(h.pots === id ? [`Player of the Season ${seasonLabel(h.season)}`] : []),
    ...(h.ballon ?? []).flatMap((b, i) => (b.player === id ? [`Ballon d'Or ${PLACE[i]} ${seasonLabel(h.season)}`] : [])),
  ]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="win pcard" onClick={(e) => e.stopPropagation()}>
        <div className="win-title">{name}</div>
        <div className="body">
          <div className="pc-head">
            <span className="pc-ovr">{p.ovr}</span>
            <span className="pc-meta">
              <b>{parsePositions(p.pos).join(' · ')}</b>
              <span>{nation ? `${nation} · ` : ''}{p.retired ? 'Retired' : `${p.age} years old`}{p.club >= 0 ? ` · ${clubOf(data, p.club).name}` : ''}</span>
            </span>
            {awards.length > 0 && <span className="pc-awards">{awards.map((a) => <span key={a}>{a}</span>)}</span>}
          </div>
          <div className="ph gbar">Rating<small>{shown.length > 1 ? `${shown[0].ovr} → ${shown[shown.length - 1].ovr}` : ''}</small></div>
          <RatingChart points={shown} />
          <div className="ph gbar">Season by Season<small>All competitions</small></div>
          <table className="tbl">
            <thead><tr><th>Season</th><th className="n">Rating</th><th className="n">Apps</th><th className="n">Goals</th><th className="n">Assists</th><th className="n">Avg</th></tr></thead>
            <tbody>
              {seasons.map(({ h, ovr, st }) => (
                <tr key={h.season}>
                  <td>{seasonLabel(h.season)}</td><td className="n">{ovr ?? '–'}</td><td className="n">{st?.apps ?? 0}</td>
                  <td className="n">{st?.goals ?? 0}</td><td className="n">{st?.assists ?? 0}</td><td className="n">{st ? (st.ratingSum / st.apps).toFixed(2) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="note">Esc or click outside to close.</div>
        </div>
      </div>
    </div>
  );
}
