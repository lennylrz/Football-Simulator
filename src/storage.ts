// Careers are not saved: leaving one ends it. What is kept is the players
// offered in recent careers, so the next draft brings new faces.

const OLD_RUN_KEY = 'five-seasons-run-v1';
const RECENT_KEY = 'five-seasons-recent-v1';
/** How many recent careers' draws to remember. */
const CAREERS = 3;

interface RecentCareer {
  seed: number;
  ids: number[];
}

function read(): RecentCareer[] {
  try {
    localStorage.removeItem(OLD_RUN_KEY);
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentCareer[]) : [];
  } catch {
    return [];
  }
}

/** Players offered in recent careers other than this one. */
export function recentPlayers(except?: number): number[] {
  return [...new Set(read().filter((c) => c.seed !== except).flatMap((c) => c.ids))];
}

/** Remembers the players a career has been offered so far. */
export function rememberShown(seed: number, ids: number[]): void {
  try {
    const list = read().filter((c) => c.seed !== seed);
    list.push({ seed, ids: [...new Set(ids)] });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(-CAREERS)));
  } catch {
    // Storage blocked: the next career just draws from everyone.
  }
}
