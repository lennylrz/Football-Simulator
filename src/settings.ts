const KEY = 'five-seasons-settings-v1';

export type MatchSpeed = 'normal' | 'fast' | 'instant';

export interface Settings {
  /** draft cards hide ratings until the player is yours */
  hiddenRatings: boolean;
  /** seconds per draft pick, 0 for no timer */
  pickTimer: number;
  /** re-draft gambles each summer */
  redrafts: number;
  /** candidates offered per pick */
  choices: number;
  /** substitutes drafted alongside the XI */
  bench: number;
  /** how the season viewer starts */
  matchSpeed: MatchSpeed;
  /** turns off animations and cross-fades */
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  hiddenRatings: false,
  pickTimer: 0,
  redrafts: 2,
  choices: 5,
  bench: 3,
  matchSpeed: 'normal',
  reduceMotion: false,
};

interface Option<K extends keyof Settings> {
  key: K;
  group: string;
  label: string;
  desc: string;
  values: Settings[K][];
  show: (v: Settings[K]) => string;
}

type AnyOption = { [K in keyof Settings]: Option<K> }[keyof Settings];

/** Every setting, in the order the settings screen lists them. */
export const OPTIONS: AnyOption[] = [
  {
    key: 'hiddenRatings', group: 'Draft', label: 'Ratings in the Draft', values: [false, true],
    show: (v) => (v ? 'Hidden' : 'Shown'),
    desc: 'Hidden: draft cards show name, age, nationality and club only. You see a player\'s rating once he is yours. Pure ball knowledge.',
  },
  {
    key: 'pickTimer', group: 'Draft', label: 'Pick Timer', values: [0, 10, 20, 30, 60],
    show: (v) => (v ? `${v} seconds` : 'Off'),
    desc: 'Time for each pick. When it runs out, the highlighted player is picked for you.',
  },
  {
    key: 'choices', group: 'Draft', label: 'Choices per Pick', values: [3, 4, 5],
    show: (v) => `${v} players`,
    desc: 'How many candidates you choose from for each position. Fewer choices, harder draft.',
  },
  {
    key: 'bench', group: 'Draft', label: 'Bench Size', values: [3, 5],
    show: (v) => `${v} substitutes`,
    desc: 'How many substitutes you draft after your XI. They come on as subs, start now and then in their position, and can be moved into the XI each summer. Takes effect in a new career.',
  },
  {
    key: 'redrafts', group: 'Draft', label: 'Re-drafts per Summer', values: [0, 1, 2, 3, 4, 5],
    show: (v) => (v ? String(v) : 'None'),
    desc: 'How many players you may gamble on each summer: release him and pick from new candidates. Takes effect from the next summer.',
  },
  {
    key: 'matchSpeed', group: 'Season', label: 'Match Speed', values: ['normal', 'fast', 'instant'],
    show: (v) => ({ normal: 'Normal', fast: 'Fast', instant: 'Instant' })[v],
    desc: 'How the season plays out: matchday by matchday at normal or fast speed, or straight to the final table. You can still pause, speed up or skip.',
  },
  {
    key: 'reduceMotion', group: 'Display', label: 'Reduce Motion', values: [false, true],
    show: (v) => (v ? 'On' : 'Off'),
    desc: 'Turns off animations and cross-fades.',
  },
];

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the settings last for this visit only.
  }
}

/** Applies the settings to the page. */
export function applySettings(s: Settings): void {
  document.documentElement.classList.toggle('calm', s.reduceMotion);
}

/** The settings that are rules of the career itself. */
export function rulesOf(s: Settings): { redrafts: number; choices: number; bench: number } {
  return { redrafts: s.redrafts, choices: s.choices, bench: s.bench };
}

/** The next or previous value of an option. */
export function step<K extends keyof Settings>(s: Settings, key: K, dir: 1 | -1): Settings {
  const opt = OPTIONS.find((o) => o.key === key) as unknown as Option<K>;
  const i = opt.values.indexOf(s[key]);
  const next = opt.values[Math.max(0, Math.min(opt.values.length - 1, (i < 0 ? 0 : i) + dir))];
  return { ...s, [key]: next };
}
