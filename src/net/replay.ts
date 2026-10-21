// Turns a room's log into the game, entry by entry. Pure: both browsers run
// exactly this on exactly the same entries.
import { applyAction, GUEST, HOST, newRoomGame } from '../game/actions';
import type { GameData } from '../game/data';
import type { GameState } from '../game/game';
import type { LoggedEntry, Room } from './room';

export interface RoomReplay {
  state: GameState | null;
  /** the guest's browser id, once he has joined */
  guest: string | null;
}

/** The club a browser manages in the room, or null for anyone else. */
export function clubOfPid(room: Room, replay: RoomReplay, pid: string): number | null {
  return pid === room.host.pid ? HOST : pid === replay.guest ? GUEST : null;
}

export function applyEntry(replay: RoomReplay, room: Room, data: GameData, e: LoggedEntry): void {
  const a = e.action;
  if (a.t === 'join') {
    // The first other browser to join is the guest; later ones are turned away.
    if (replay.state || e.pid === room.host.pid) return;
    replay.guest = e.pid;
    replay.state = newRoomGame(data, room.seed, room.rules, room.host, { club: a.club, formation: a.formation });
    return;
  }
  const club = clubOfPid(room, replay, e.pid);
  if (replay.state && club !== null) applyAction(replay.state, data, club, a);
}
