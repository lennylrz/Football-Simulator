// Careers are not saved: leaving one ends it. What is kept is the players
// offered in recent careers, so the next draft brings new faces, and how
// each Daily Challenge went (one attempt a day).

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

const DAILY_KEY = 'five-seasons-daily-v1';

export interface DailyRecord {
  day: number;
  /** finished; otherwise started and left, which uses up the attempt */
  done: boolean;
  club?: string;
  score?: number;
  text?: string;
}

function dailies(): DailyRecord[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    return raw ? (JSON.parse(raw) as DailyRecord[]) : [];
  } catch {
    return [];
  }
}

/** How today's attempt went, if there was one. */
export function dailyRecord(day: number): DailyRecord | undefined {
  return dailies().find((r) => r.day === day);
}

export function saveDailyRecord(record: DailyRecord): void {
  try {
    const list = dailies().filter((r) => r.day !== record.day);
    list.push(record);
    localStorage.setItem(DAILY_KEY, JSON.stringify(list.slice(-60)));
  } catch {
    // Storage blocked: the attempt is not remembered.
  }
}
