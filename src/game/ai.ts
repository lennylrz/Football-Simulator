// Transfer behaviour of the clubs the user does not manage.
import type { GameData } from './data';
import { EXTERNAL, type GameState, MIN_SQUAD, marketPool, transfer } from './game';

export function aiWindow(state: GameState, data: GameData, phase: 'open' | 'deadline'): void {
  void state;
  void data;
  void phase;
}

/** Tops a squad up to the minimum with the cheapest available players. */
export function ensureMinimumSquad(state: GameState, data: GameData, club: number): void {
  const c = state.clubs[club];
  if (c.squad.length >= MIN_SQUAD) return;
  const needGk = !c.squad.some((id) => state.players[id].pos.startsWith('GK'));
  const pool = marketPool(state, data).sort((a, b) => a.value - b.value);
  while (c.squad.length < MIN_SQUAD) {
    const hasGk = c.squad.some((id) => state.players[id].pos.startsWith('GK'));
    const p = pool.find((q) => q.club === EXTERNAL && (hasGk || !needGk || q.pos.startsWith('GK')));
    if (!p) break;
    transfer(state, data, p.id, club, 0);
  }
}
