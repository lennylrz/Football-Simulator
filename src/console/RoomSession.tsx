import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Action, rivalOf, type RoomManager, viewFor } from '../game/actions';
import type { GameData } from '../game/data';
import type { GameState } from '../game/game';
import { applyEntry, clubOfPid, type RoomReplay } from '../net/replay';
import { playerId, type Room, sendEntry, watchRoom } from '../net/room';
import type { Settings } from '../settings';
import { GameContext, type RoomContext } from '../ui/context';
import { Draft } from './screens/Draft';
import { RoomWaiting } from './screens/Lobby';
import { Results } from './screens/Results';
import { Summary } from './screens/Summary';
import { Summer } from './screens/Summer';
import { Stage } from './ui';

/**
 * A two-player room: follows the room's log, replays it into the game and
 * shows this manager's view of it. Moves go into the log, not straight into
 * the game, so both browsers apply them in the same order.
 */
export function RoomSession({ room, data, settings, joinAs, onLeave }: {
  room: Room; data: GameData; settings: Settings;
  /** the club to join with, when this browser is the guest and hasn't joined yet */
  joinAs?: RoomManager;
  onLeave: () => void;
}) {
  const me = playerId();
  const replay = useRef<RoomReplay>({ state: null, guest: null });
  const [game, setGame] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  /** a move of ours is on its way: further ones wait, so a double press can't undo it */
  const pending = useRef(false);

  useEffect(() => {
    replay.current = { state: null, guest: null };
    const stop = watchRoom(room.code, (entries) => {
      for (const e of entries) {
        applyEntry(replay.current, room, data, e);
        if (e.pid === me) pending.current = false;
      }
      setLoaded(true);
      if (entries.length || !replay.current.state) setGame(replay.current.state ? structuredClone(replay.current.state) : null);
    }, setError);
    return stop;
  }, [room, data, me]);

  // The guest joins once the log has loaded and shows nobody else has.
  useEffect(() => {
    if (!loaded || joined || !joinAs || me === room.host.pid || replay.current.guest) return;
    setJoined(true);
    sendEntry(room.code, { t: 'join', ...joinAs }).catch((e) => setError(String(e)));
  }, [loaded, joined, joinAs, me, room]);

  const send = useCallback((a: Action) => {
    if (pending.current) return;
    pending.current = true;
    setTimeout(() => (pending.current = false), 4000);
    sendEntry(room.code, a).catch((e) => {
      pending.current = false;
      setError(String(e));
    });
  }, [room.code]);

  const club = game ? clubOfPid(room, replay.current, me) : null;
  const ctx = useMemo(() => {
    if (!game || club === null) return null;
    const roomCtx: RoomContext = { code: room.code, isHost: club === game.mp!.humans[0], rival: rivalOf(game, club)!, full: game };
    return { data, game: viewFor(game, club), send, quit: onLeave, settings, room: roomCtx };
  }, [game, club, data, send, onLeave, settings, room.code]);

  if (error) {
    return <Stage><div className="empty" style={{ padding: 60 }}>Room {room.code}: {error} <button className="rowbtn" onClick={onLeave}>Back to menu</button></div></Stage>;
  }
  if (game && club === null) {
    return <Stage><div className="empty" style={{ padding: 60 }}>Room {room.code} already has two managers. <button className="rowbtn" onClick={onLeave}>Back to menu</button></div></Stage>;
  }
  if (!ctx) return <Stage><RoomWaiting code={room.code} onLeave={onLeave} joining={!!joinAs && me !== room.host.pid} /></Stage>;

  const v = ctx.game;
  let screen;
  if (v.stage === 'results') screen = <Results />;
  else if (v.stage === 'summary') screen = <Summary onNewCareer={onLeave} />;
  else if (v.draft?.slot !== null && v.draft?.slot !== undefined) screen = <Draft />;
  else screen = <Summer />;
  return (
    <GameContext.Provider value={ctx}>
      <Stage>{screen}</Stage>
    </GameContext.Provider>
  );
}
