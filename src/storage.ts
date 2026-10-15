import type { GameState } from './game/game';

const KEY = 'five-seasons-run-v1';

export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s && s.v === 1 ? s : null;
  } catch {
    return null;
  }
}

export function saveRun(state: GameState | null): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage full or blocked: the run still works, it just won't survive a reload.
  }
}
