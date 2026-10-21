import { createContext, useContext } from 'react';
import type { Action } from '../game/actions';
import type { GameData } from '../game/data';
import type { GameState } from '../game/game';
import type { Settings } from '../settings';

/** A two-player room, as the screens need it. */
export interface RoomContext {
  code: string;
  isHost: boolean;
  /** the other manager's club */
  rival: number;
  /** the whole game, not just this manager's view of it */
  full: GameState;
}

export interface GameContextValue {
  data: GameData;
  /** the game as this manager sees it */
  game: GameState;
  /** Makes a move: applied at once in single player, through the room's log in a room. */
  send: (action: Action) => void;
  quit: () => void;
  settings: Settings;
  room?: RoomContext;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame outside GameContext');
  return ctx;
}
