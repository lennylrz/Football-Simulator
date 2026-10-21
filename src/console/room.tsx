// Two-player room pieces shared by the screens: the rival's status, his
// lineup and the managers' head-to-heads, and a minute-by-minute live match.
import { useEffect, useMemo, useState } from 'react';
import { isBench, XI } from '../game/draft';
import { type GameState, type HeadToHead, seasonLabel } from '../game/game';
import type { GameData } from '../game/data';
import { FORMATIONS, parsePositions } from '../game/positions';
import { stream } from '../game/rng';
import type { RoomContext } from '../ui/context';
import { BenchStrip, Pitch, type PlateInfo } from './Pitch';
import { clubOf, type Command, Overlay } from './ui';
import './room.css';

/** What the other manager is doing, in a few words. */
export function rivalStatus(room: RoomContext): string {
  const v = room.full.mp?.views[room.rival];
  if (!v) return '';
  if (v.stage === 'draft') return `drafting, pick ${(v.draft?.picks.filter((p) => p.season === room.full.season).length ?? 0) + 1}`;
  if (v.stage === 'summer') return v.draft?.slot !== null ? 're-drafting' : v.ready ? 'ready' : 'setting their XI';
  if (v.stage === 'results') return v.done ? 'waiting for you' : 'watching the season';
  return 'career over';
}

/** The "Rival" command for a screen's command bar. */
export function rivalCommand(room: RoomContext | undefined, open: () => void): Command[] {
  if (!room) return [];
  return [{ keys: ['V'], label: `Rival · ${rivalStatus(room)}`, onPress: open }];
}

function plates(game: GameState, data: GameData, club: number): { xi: PlateInfo[]; bench: PlateInfo[] } {
  const c = game.clubs[club];
  const slots = FORMATIONS[c.formation];
  const plate = (id: number, spot: number): PlateInfo => {
    const p = game.players[id];
    const label = isBench(spot) ? (p ? parsePositions(p.pos)[0] ?? 'SUB' : 'SUB') : slots[spot];
    return p && id >= 0 ? { rating: p.ovr, name: data.names[id][0], label } : { label, state: 'empty' };
  };
  return { xi: c.xi.map((id, i) => plate(id, i)), bench: c.bench.map((id, j) => plate(id, XI + j)) };
}

/** Every head-to-head so far, oldest first. */
export function headToHeads(game: GameState): (HeadToHead & { season: number })[] {
  return game.history.flatMap((h) => (h.h2h ?? []).map((m) => ({ ...m, season: h.season })));
}

export function RivalOverlay({ room, data, me }: { room: RoomContext; data: GameData; me: number }) {
  const game = room.full;
  const rival = clubOf(data, room.rival);
  const { xi, bench } = plates(game, data, room.rival);
  const list = headToHeads(game);
  const record = list.reduce((r, m) => {
    const mine = m.home === me ? m.hg - m.ag : m.ag - m.hg;
    const won = mine > 0 || (mine === 0 && m.pens !== undefined && (m.pens === 0) === (m.home === me));
    const lost = mine < 0 || (mine === 0 && m.pens !== undefined && !won);
    return { w: r.w + (won ? 1 : 0), d: r.d + (!won && !lost ? 1 : 0), l: r.l + (lost ? 1 : 0) };
  }, { w: 0, d: 0, l: 0 });
  const name = (club: number) => clubOf(data, club).short;
  return (
    <Overlay title={`${rival.name} · ${rivalStatus(room)}`}>
      <div className="rival">
        <div className="rival-pitch">
          <Pitch formation={game.clubs[room.rival].formation} plates={xi} />
          <BenchStrip plates={bench} />
        </div>
        <div className="rival-h2h">
          <div className="ph gbar">Head to Head<small>You {record.w}W {record.d}D {record.l}L</small></div>
          {list.length === 0 ? (
            <div className="empty">No meetings yet. You play each other twice in the league, and maybe in the cups.</div>
          ) : (
            <div className="tblwrap scroll">
              <table className="tbl">
                <tbody>
                  {list.map((m, k) => (
                    <tr key={k}>
                      <td className="comp">{seasonLabel(m.season)} · {m.comp}</td>
                      <td className="n">{name(m.home)}</td>
                      <td className="score">{m.hg}–{m.ag}{m.pens !== undefined ? ' p' : ''}</td>
                      <td>{name(m.away)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="note">Room {room.code} · {game.clubs[room.rival].formation}</div>
        </div>
      </div>
    </Overlay>
  );
}

interface LiveEvent {
  minute: number;
  side: 0 | 1;
  kind: 'goal' | 'chance' | 'save' | 'card' | 'corner';
  text: string;
}

const CHANCE = ['fires just wide', 'hits the bar', 'heads over', 'drags his shot past the post', 'is denied by a last-ditch block'];

/**
 * The events of a match, minute by minute: its real goals with their real
 * scorers, and chances, saves and cards around them. Seeded, so both
 * managers see the same match.
 */
function matchEvents(game: GameState, data: GameData, m: HeadToHead, season: number): LiveEvent[] {
  const rng = stream(game.seed, 'live', season, m.slot, m.home);
  const nameOf = (id: number) => (id >= 0 ? data.names[id]?.[0] ?? '' : '');
  const used = new Set<number>();
  const minute = () => {
    for (;;) {
      const x = 1 + Math.floor(rng() * 90);
      if (!used.has(x)) {
        used.add(x);
        return x;
      }
    }
  };
  const out: LiveEvent[] = m.goals.map(([scorer, assist, side]) => ({
    minute: minute(), side, kind: 'goal',
    text: `GOAL! ${nameOf(scorer)}${assist >= 0 ? `, assisted by ${nameOf(assist)}` : ''}`,
  }));
  const xi = (side: 0 | 1) => game.clubs[side === 0 ? m.home : m.away].xi.filter((id) => id >= 0);
  const someone = (side: 0 | 1, outfield = true) => {
    const list = xi(side).filter((id) => !outfield || !game.players[id]?.pos.startsWith('GK'));
    return nameOf(list[Math.floor(rng() * list.length)] ?? -1);
  };
  const extras = 5 + Math.floor(rng() * 4);
  for (let k = 0; k < extras; k++) {
    const side: 0 | 1 = rng() < 0.5 ? 0 : 1;
    const r = rng();
    const kind: LiveEvent['kind'] = r < 0.4 ? 'chance' : r < 0.7 ? 'save' : r < 0.85 ? 'corner' : 'card';
    const text = kind === 'chance' ? `${someone(side)} ${CHANCE[Math.floor(rng() * CHANCE.length)]}`
      : kind === 'save' ? `Great save! ${someone(side === 0 ? 1 : 0, false)} keeps out ${someone(side)}`
      : kind === 'corner' ? `Corner to ${clubOf(data, side === 0 ? m.home : m.away).short}`
      : `Yellow card for ${someone(side)}`;
    out.push({ minute: minute(), side, kind, text });
  }
  return out.sort((a, b) => a.minute - b.minute);
}

/** A head-to-head played out minute by minute, like a quick sim. */
export function LiveMatch({ game, data, match, season, fast, onDone }: {
  game: GameState; data: GameData; match: HeadToHead; season: number; fast?: boolean; onDone: () => void;
}) {
  const events = useMemo(() => matchEvents(game, data, match, season), [game, data, match, season]);
  const [minute, setMinute] = useState(0);
  const over = minute >= 90;
  useEffect(() => {
    if (over) {
      const t = setTimeout(onDone, 3000);
      return () => clearTimeout(t);
    }
    // A short pause at half-time.
    const wait = minute === 45 ? 1200 : fast ? 70 : 170;
    const t = setTimeout(() => setMinute((x) => x + 1), wait);
    return () => clearTimeout(t);
  }, [minute, over, fast, onDone]);
  const shown = events.filter((e) => e.minute <= minute);
  const goals = (side: 0 | 1) => shown.filter((e) => e.kind === 'goal' && e.side === side).length;
  const home = clubOf(data, match.home);
  const away = clubOf(data, match.away);
  return (
    <Overlay title={`Live · ${match.comp}`}>
      <div className="live-match">
        <div className="lm-score">
          <span className="lm-team" style={{ borderColor: home.primary }}>{home.name}</span>
          <span className="lm-goals">{goals(0)} – {goals(1)}</span>
          <span className="lm-team" style={{ borderColor: away.primary }}>{away.name}</span>
        </div>
        <div className="lm-clock">
          {over ? `Full time${match.pens !== undefined ? ` · ${clubOf(data, match.pens === 0 ? match.home : match.away).short} win on penalties` : ''}` : minute === 45 ? 'Half time' : `${minute}'`}
          <i style={{ width: `${(Math.min(minute, 90) / 90) * 100}%` }} />
        </div>
        <div className="lm-feed">
          {shown.slice().reverse().map((e, k) => (
            <div key={`${e.minute}-${k}`} className={`lm-ev ${e.kind} ${e.side ? 'away' : 'home'}`}>
              <span className="m">{e.minute}'</span><span>{e.text}</span>
            </div>
          ))}
          {shown.length === 0 && <div className="lm-ev"><span className="m">0'</span><span>Kick-off</span></div>}
        </div>
      </div>
    </Overlay>
  );
}
