import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLUBS, type ClubInfo } from '../game/clubs';
import type { GameData } from '../game/data';
import { TurnPhone, useTurnCard } from './TurnPhone';

/**
 * The era's look for every screen past the era picker: '' is the 2010s
 * console, 'sl' the 2015-2020 career-hub look (see slate.css).
 */
export const ThemeContext = createContext<'' | 'sl'>('');
export const useTheme = () => useContext(ThemeContext);

/** How the last press came: a finger, a pen or the mouse. */
let lastPointer = 'mouse';
window.addEventListener('pointerdown', (e) => (lastPointer = e.pointerType), true);

/**
 * Whether a click came from a finger. A touch screen has no hover, so where
 * hovering previews something, the first tap selects and the second acts.
 */
export const touchTap = () => lastPointer !== 'mouse';

/** Hover handler that only the mouse triggers (a tap fires mouse events too). */
export const onHover = (f: () => void) => (e: React.PointerEvent) => {
  if (e.pointerType === 'mouse') f();
};

/** Whether the player turned on Reduce Motion (settings put .calm on <html>). */
export const reducedMotion = () => document.documentElement.classList.contains('calm');

/** The stage's size in stage pixels: at least 1280x720, as much more as the window's shape adds. */
export const StageSize = createContext({ w: 1280, h: 720 });
/** The stage's content box, where overlays go so they cover the whole screen. */
const StageLayer = createContext<HTMLElement | null>(null);

/** Puts its children straight on the stage, above the screen's header and body. */
export function OnStage({ children }: { children: ReactNode }) {
  const layer = useContext(StageLayer);
  return layer ? createPortal(children, layer) : children;
}

/** A phone held upright: the stage is a landscape screen, so it is drawn sideways. */
export function phoneUpright(): boolean {
  return window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth && window.innerWidth < 600;
}

/** The notch and home bar's room (CSS safe-area insets), in CSS pixels. */
function safeArea(): { x: number; y: number } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => parseFloat(v) || 0;
  const out = { x: Math.max(px(cs.paddingLeft), px(cs.paddingRight)), y: Math.max(px(cs.paddingTop), px(cs.paddingBottom)) };
  probe.remove();
  return out;
}

/**
 * Scales the fixed 1280x720 stage to fit the window. The screen's background
 * fills the whole window; the 1280x720 content stays centred in it, clear of
 * a phone's notch. On a phone held upright the stage turns sideways.
 */
export function Stage({ tone = 'dark', children }: { tone?: 'dark' | 'light' | 'home'; children: ReactNode }) {
  const theme = useTheme();
  const [fit, setFit] = useState({ s: 1, w: 1280, h: 720, turned: false });
  useLayoutEffect(() => {
    const resize = () => {
      const turned = phoneUpright();
      const pad = safeArea();
      // Turned, the window's height is the stage's width.
      const [W, H] = turned ? [window.innerHeight, window.innerWidth] : [window.innerWidth, window.innerHeight];
      const [padW, padH] = turned ? [2 * pad.y, 2 * pad.x] : [2 * pad.x, 2 * pad.y];
      const s = Math.min((W - padW) / 1280, (H - padH) / 720);
      setFit({ s, w: Math.max(1280, Math.ceil(W / s)), h: Math.max(720, Math.ceil(H / s)), turned });
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, []);
  const size = useMemo(() => ({ w: fit.w, h: fit.h }), [fit.w, fit.h]);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [card, cardDone] = useTurnCard();
  return (
    <div className={`stage-wrap ${fit.turned ? 'turned' : ''}`}>
      {fit.turned && card && <TurnPhone onPlay={cardDone} />}
      <div
        className={`stage ${tone} ${tone === 'home' ? '' : theme}`}
        style={{ '--s': fit.s, width: fit.w, height: fit.h, '--bx': `${(fit.w - 1280) / 2}px`, '--by': `${(fit.h - 720) / 2}px` } as React.CSSProperties}
        // Clicking a button never focuses it, so Enter and Space afterwards only run the screen's command.
        onMouseDown={(e) => {
          if ((e.target as Element).closest('button')) e.preventDefault();
        }}
      >
        <div className="stage-in" ref={setLayer}>
          <StageSize.Provider value={size}>
            <StageLayer.Provider value={layer}>{children}</StageLayer.Provider>
          </StageSize.Provider>
        </div>
      </div>
    </div>
  );
}

export type KeyName = 'Enter' | 'Escape' | 'Space' | 'Up' | 'Down' | 'Left' | 'Right' | 'Q' | 'E' | 'T' | 'A' | 'H' | 'R' | 'S' | 'F' | 'V' | 'P' | 'C';

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
  q: 'Q', e: 'E', t: 'T', a: 'A', h: 'H', r: 'R', s: 'S', f: 'F', v: 'V', p: 'P', c: 'C',
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
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = KEY_OF[e.key.length === 1 ? e.key.toLowerCase() : e.key] ?? KEY_OF[e.key];
      if (!k) return;
      // While typing, only Enter and Esc reach the screen: letters, Space and arrows edit the text.
      if (e.target instanceof HTMLInputElement && k !== 'Enter' && k !== 'Escape') return;
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

export function Overlay({ title, children, wide }: { title: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <OnStage>
      <div className="overlay">
        <div className={`win ${wide ? 'wide' : ''}`}>
          <div className="win-title">{title}</div>
          <div className="body">{children}</div>
        </div>
      </div>
    </OnStage>
  );
}

/** A Daily Challenge result as it reads on screen: its first lines, a small gold cup for each trophy (no emoji). */
export function ResultLines({ text, lines = 3 }: { text: string; lines?: number }) {
  return (
    <pre className="result-lines">
      {text.split('\n').slice(0, lines).map((line, k) => (
        <span key={k}>
          {line.split('\u{1F3C6}').map((part, j) => (j ? <span key={j}><i className="cup" aria-label="trophy" />{part}</span> : part))}
          {'\n'}
        </span>
      ))}
    </pre>
  );
}

/** The address that opens today's Daily Challenge, for results and shares. */
export const dailyLink = () => `${window.location.origin}/daily`;

/** Phones and tablets share through the system sheet (WhatsApp, Messages...); computers copy. */
export const canShareText = () => typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;

/** Opens the share sheet with the text; 'copied' where there is none. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (canShareText()) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

/** Copies text to the clipboard; false if the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
