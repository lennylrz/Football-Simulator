import { createContext, useContext } from 'react';
import type { GameData } from '../game/data';
import type { GameState } from '../game/game';

export interface GameContextValue {
  data: GameData;
  game: GameState;
  /** Applies a change to a copy of the state, then saves it. */
  act: (fn: (s: GameState, data: GameData) => void) => void;
  quit: () => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame outside GameContext');
  return ctx;
}
