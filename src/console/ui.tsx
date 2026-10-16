import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CLUBS, type ClubInfo } from '../game/clubs';
import type { GameData } from '../game/data';

/** Scales the fixed 1280x720 stage to fit the window. */
export function Stage({ tone = 'dark', children }: { tone?: 'dark' | 'light' | 'home'; children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="stage-wrap">
      <div className={`stage ${tone}`} style={{ '--s': scale } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

export type KeyName = 'Enter' | 'Escape' | 'Space' | 'Up' | 'Down' | 'Left' | 'Right' | 'Q' | 'E' | 'T' | 'A' | 'H' | 'R' | 'S' | 'F';

export interface Command {
  keys: KeyName[];
  label: string;
  /** receives the key pressed, or nothing when the hint is clicked */
  onPress: (key?: KeyName) => void;
  primary?: boolean;
  disabled?: boolean;
  /** works from the keyboard but is not shown in the bar */
  hidden?: boolean;
}

const KEY_OF: Record<string, KeyName> = {
  Enter: 'Enter', Escape: 'Escape', ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  q: 'Q', e: 'E', t: 'T', a: 'A', h: 'H', r: 'R', s: 'S', f: 'F',
};

const ARROWS: Partial<Record<KeyName, string>> = { Up: 'M3 10l5-5 5 5', Down: 'M3 6l5 5 5-5', Left: 'M10 3l-5 5 5 5', Right: 'M6 3l5 5-5 5' };

export function KeyCap({ k, primary }: { k: KeyName; primary?: boolean }) {
  const path = ARROWS[k];
  return (
    <span className={`key ${primary ? 'primary' : ''}`}>
      {path ? (
        <svg viewBox="0 0 16 16" aria-hidden><path d={path} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : k === 'Escape' ? 'ESC' : k.toUpperCase()}
    </span>
  );
}

/** Listens for the commands' keys while mounted. */
export function useCommands(commands: Command[]) {
  const ref = useRef(commands);
  ref.current = commands;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = KEY_OF[e.key.length === 1 ? e.key.toLowerCase() : e.key] ?? KEY_OF[e.key];
      if (!k) return;
      const cmd = ref.current.find((c) => c.keys.includes(k) && !c.disabled);
      if (!cmd) return;
      e.preventDefault();
      cmd.onPress(k);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function CommandBar({ commands, info }: { commands: Command[]; info?: ReactNode }) {
  useCommands(commands);
  return (
    <div className="cmdbar">
      <div className="hints">
        {commands
          .filter((c) => !c.hidden)
          .map((c) => (
            <button key={c.label} className="hint" onClick={() => c.onPress()} disabled={c.disabled} tabIndex={-1}>
              <span className="keys">
                {c.keys.map((k) => (
                  <KeyCap key={k} k={k} primary={c.primary} />
                ))}
              </span>
              {c.label}
            </button>
          ))}
      </div>
      {info && <div className="info">{info}</div>}
    </div>
  );
}

export function clubInfoByName(name: string): ClubInfo {
  return CLUBS.find((c) => c.name === name)!;
}

export function clubOf(data: GameData, club: number): ClubInfo {
  return clubInfoByName(data.meta.gameClubs[club]);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Glossy header gradient in the club's colour (the darker one if the main colour is pale). */
export function clubBar(info: ClubInfo): string {
  let c = info.primary;
  if (luminance(c) > 0.62) c = info.secondary;
  if (luminance(c) > 0.62) c = '#1d4f91';
  return `linear-gradient(180deg, color-mix(in srgb, ${c} 72%, white) 0%, ${c} 48%, color-mix(in srgb, ${c} 72%, black) 52%, color-mix(in srgb, ${c} 88%, black) 100%)`;
}

/** Header strip, body and command bar of a screen. */
export function Frame({
  club, title, sub, right, commands, info, children, full,
}: {
  club?: ClubInfo; title?: ReactNode; sub?: ReactNode; right?: ReactNode; commands: Command[]; info?: ReactNode; children: ReactNode; full?: boolean;
}) {
  return (
    <>
      {!full && (
        <div className="f-head" style={{ '--club-bar': club ? clubBar(club) : 'linear-gradient(180deg, #4f74ad 0%, #284f8c 48%, #163b74 52%, #1f4682 100%)' } as React.CSSProperties}>
          {title}
          {sub && <span className="sub">{sub}</span>}
          {right && <span className="right">{right}</span>}
        </div>
      )}
      <div className={`f-body ${full ? 'full' : ''}`}>{children}</div>
      <CommandBar commands={commands} info={info} />
    </>
  );
}

/** A dark list whose selection follows the arrow keys; keeps the selected row in view. */
export function useListNav(length: number, initial = 0) {
  const [index, setIndex] = useState(initial);
  const safe = Math.max(0, Math.min(index, length - 1));
  const move = (d: number) => setIndex(Math.max(0, Math.min(length - 1, safe + d)));
  return { index: safe, setIndex, up: () => move(-1), down: () => move(1) };
}

export function useScrollIntoView(index: number) {
  const ref = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    const row = ref.current?.children[index] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  return ref;
}

export function Overlay({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="overlay">
      <div className="win">
        <div className="win-title">{title}</div>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

export function money(k: number): string {
  return `€${Math.round(k * 1000).toLocaleString('en-GB')}`;
}

export function moneyShort(k: number): string {
  if (Math.abs(k) >= 1000) return `€${(k / 1000).toFixed(k % 1000 === 0 ? 0 : 1)}m`;
  return `€${Math.round(k)}k`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function primaryPos(pos: string): string {
  return pos.split(',')[0];
}

/** One "browse" command for a pair of arrow keys. */
export function browse(label: string, prev: () => void, next: () => void, horizontal = false): Command {
  const [a, b]: [KeyName, KeyName] = horizontal ? ['Left', 'Right'] : ['Up', 'Down'];
  return { keys: [a, b], label, onPress: (k) => (k === a ? prev() : next()) };
}
