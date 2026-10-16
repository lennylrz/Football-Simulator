const KEY = 'five-seasons-settings-v1';

export interface Settings {
  /** turns off animations and cross-fades */
  reduceMotion: boolean;
}

const DEFAULTS: Settings = { reduceMotion: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the setting lasts for this visit only.
  }
}

/** Applies the settings to the page. */
export function applySettings(s: Settings): void {
  document.documentElement.classList.toggle('calm', s.reduceMotion);
}
