// Winning feels like winning: confetti, the flash when a title is clinched,
// and the season's moments (trophies, the Ballon d'Or, the player of the
// season) between the last matchday and the review. Each era in its own look;
// with reduced motion everything is still there, only nothing moves.
import { useEffect, useMemo, useRef, useState } from 'react';
import { mergeStats } from '../game/career';
import type { CupMatch, Entrant } from '../game/cups';
import type { GameData } from '../game/data';
import { type GameState, seasonLabel, trophiesOf } from '../game/game';
import { clubBar, clubOf, type Command, CommandBar, reducedMotion, useTheme } from './ui';
import './moments.css';


interface Bit { x: number; y: number; vx: number; vy: number; a: number; va: number; flip: number; vf: number; w: number; h: number; c: string }

/**
 * Ticker tape (the console years) or slow gold flakes (the career-hub years)
 * over the whole window for a few seconds. Nothing with reduced motion.
 */
export function Confetti({ colors, kind, count = 180, seconds = 4.5 }: { colors: string[]; kind: 'tape' | 'flakes'; count?: number; seconds?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palette = colors.join(' ');
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || reducedMotion()) return;
    // Its size on screen: the stage's scale applied to its layout size (the stage may be turned sideways).
    const box = canvas.getBoundingClientRect();
    const scale = Math.sqrt((box.width * box.height) / (canvas.offsetWidth * canvas.offsetHeight)) || 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.offsetWidth * scale;
    const H = canvas.offsetHeight * scale;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // One unit scales with the window, so the confetti looks the same at any size.
    const u = W / 1400;
    const cols = palette.split(' ');
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const bits: Bit[] = [];
    const add = (x: number, y: number, vx: number, vy: number) => bits.push({
      x, y, vx, vy, a: rnd(0, 6.3), va: rnd(-0.12, 0.12), flip: rnd(0, 6.3), vf: rnd(0.06, 0.2),
      w: (kind === 'tape' ? rnd(5, 8) : rnd(4, 7)) * u, h: (kind === 'tape' ? rnd(14, 24) : rnd(4, 7)) * u, c: cols[Math.floor(Math.random() * cols.length)],
    });
    if (kind === 'tape') {
      // Two cannons from the bottom corners, and tape already drifting down from the roof.
      for (let i = 0; i < count * 0.35; i++) {
        add(0, H, rnd(5, 12) * u, rnd(-24, -12) * u);
        add(W, H, -rnd(5, 12) * u, rnd(-24, -12) * u);
      }
      for (let i = 0; i < count * 0.3; i++) add(rnd(0, W), rnd(-H * 0.7, 0), rnd(-1, 1) * u, rnd(1, 2.5) * u);
    } else {
      for (let i = 0; i < count; i++) add(rnd(0, W), rnd(-H, -10), rnd(-0.3, 0.3) * u, rnd(0.7, 1.8) * u);
    }
    const gravity = (kind === 'tape' ? 0.34 : 0.02) * u;
    const fall = (kind === 'tape' ? 2.6 : 2.2) * u;
    const end = performance.now() + seconds * 1000;
    let raf = 0;
    const frame = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const b of bits) {
        b.vx *= 0.985;
        // Paper flutters: it falls fast out of the cannons, then slowly.
        b.vy = Math.min(b.vy * 0.985 + gravity, fall);
        b.x += b.vx + Math.sin(b.flip) * 0.5 * u;
        b.y += b.vy;
        b.a += b.va;
        b.flip += b.vf;
        if (b.y > H + 30) continue;
        alive++;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.a);
        ctx.scale(1, Math.cos(b.flip));
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      if (now > end) canvas.style.opacity = String(Math.max(0, 1 - (now - end) / 900));
      if (alive && now < end + 900) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [palette, kind, count, seconds]);
  return <canvas ref={ref} className="confetti" aria-hidden />;
}

/** The era's confetti: the club's colours and gold on the console, gold and cream in the hub. */
export function EraConfetti({ club, count, seconds }: { club: { primary: string; secondary: string }; count?: number; seconds?: number }) {
  const theme = useTheme();
  return theme === 'sl'
    ? <Confetti kind="flakes" colors={['#e8c45c', '#e8a04c', '#ece6d8', '#f4e2b0']} count={count ?? 140} seconds={seconds} />
    : <Confetti kind="tape" colors={[club.primary, club.secondary, '#f5c623', '#ffffff', '#f5c623']} count={count} seconds={seconds} />;
}

/** The screen lights up: a title clinched or a final won, in the middle of the season. */
export function Burst({ title, sub, club }: { title: string; sub: string; club: { primary: string; secondary: string } }) {
  return (
    <div className="burst" aria-live="polite">
      <div className="flash" />
      <EraConfetti club={club} count={150} seconds={3} />
      <div className="stamp">
        <small>{sub}</small>
        <b>{title}</b>
      </div>
    </div>
  );
}

type Trophy = 'league' | 'fa' | 'cl';

type Moment =
  | { kind: 'trophy'; trophy: Trophy }
  | { kind: 'haul' }
  | { kind: 'ballon'; place: number; player: number }
  | { kind: 'pots'; player: number };

/** What a season with these trophies is called. */
export const HONOURS: Record<string, string> = {
  league: 'League Champions', fa: 'FA Cup Winners', cl: 'Champions League Winners',
  'league fa': 'The Double', 'league cl': 'League and Europe', 'fa cl': 'The Cup Double', 'league fa cl': 'The Treble',
};

const PLATE: Record<Trophy, string> = { league: 'League', fa: 'FA Cup', cl: 'Champions League' };

/** The season's moments, in the order they happened. */
function momentsOf(game: GameState): Moment[] {
  const h = game.history[game.history.length - 1];
  const won = trophiesOf(h, game.user);
  const out: Moment[] = won.map((trophy) => ({ kind: 'trophy', trophy }));
  if (won.length > 1) out.push({ kind: 'haul' });
  const place = (h.ballon ?? []).findIndex((b) => b.club === game.user);
  if (place >= 0) out.push({ kind: 'ballon', place, player: h.ballon![place].player });
  if (h.pots !== undefined) out.push({ kind: 'pots', player: h.pots });
  return out;
}

/** Seconds each moment stays before the next. */
const HOLD = { trophy: 4.2, haul: 5.5, ballon: 4.5, pots: 4 };

/** Big type that still fits the screen: smaller for long names. */
const fit = (text: string, max: number) => Math.min(max, Math.round(1900 / Math.max(8, text.length)));

/**
 * Between the last matchday and the season review: each trophy, the haul, a
 * Ballon d'Or podium place and the player of the season, one at a time.
 * They move on by themselves; Enter for the next one, Esc to the review.
 */
export function SeasonMoments({ game, data, onDone }: { game: GameState; data: GameData; onDone: () => void }) {
  const moments = useMemo(() => momentsOf(game), [game]);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const h = game.history[game.history.length - 1];
  const result = game.result!;
  const info = clubOf(data, game.user);
  const won = trophiesOf(h, game.user);
  const m = moments[at];
  // The game can be replaced while this shows (a room's log catching up): the timer only follows the moment shown.
  const done = useRef(onDone);
  done.current = onDone;
  const count = moments.length;
  const hold = m ? HOLD[m.kind] : 0;
  const next = () => (at + 1 < count ? setAt(at + 1) : onDone());

  useEffect(() => {
    if (!count) done.current();
  }, [count]);
  useEffect(() => {
    if (paused || !hold) return;
    const t = setTimeout(() => (at + 1 < count ? setAt(at + 1) : done.current()), hold * 1000);
    return () => clearTimeout(t);
  }, [at, hold, paused, count]);

  const commands: Command[] = [
    { keys: ['Enter'], label: at + 1 < moments.length ? 'Next' : 'Season Review', primary: true, onPress: next },
    { keys: ['Space'], label: paused ? 'Resume' : 'Pause', onPress: () => setPaused(!paused) },
    { keys: ['Escape'], label: 'Skip to the Review', onPress: onDone },
  ];
  if (!m) return null;

  const name = (id: number) => data.names[id][0];
  const ent = (e: Entrant) => (typeof e === 'number' ? clubOf(data, e).short : e);
  const finalOf = (list: CupMatch[]) => {
    const f = list.filter((x) => x.round === 'Final').pop();
    if (!f) return '';
    const pens = f.pens !== undefined ? `, ${ent(f.pens === 0 ? f.home : f.away)} on penalties` : '';
    return `Final: ${ent(f.home)} ${f.hg}–${f.ag} ${ent(f.away)}${pens}`;
  };
  const row = h.table.find((r) => r.club === game.user)!;
  const second = h.table[1];

  let kick = '';
  let title = '';
  let line = '';
  let big = true;
  if (m.kind === 'trophy') {
    if (m.trophy === 'league') {
      kick = `League · ${seasonLabel(h.season)}`;
      title = 'Champions';
      const gap = row.pts - second.pts;
      line = `${row.pts} points · ${gap > 0 ? `${gap} clear of ${clubOf(data, second.club).short}` : `ahead of ${clubOf(data, second.club).short} on goal difference`}`;
    } else if (m.trophy === 'fa') {
      kick = `FA Cup · ${seasonLabel(h.season)}`;
      title = 'Cup Winners';
      line = finalOf(result.fa.matches);
    } else {
      kick = `Champions League · ${seasonLabel(h.season)}`;
      title = 'Kings of Europe';
      line = finalOf(result.cl.matches);
    }
  } else if (m.kind === 'haul') {
    kick = seasonLabel(h.season);
    title = HONOURS[won.join(' ')];
    line = won.length === 3 ? 'League, FA Cup and Champions League. The rarest season there is.' : won.map((t) => PLATE[t]).join(' and ');
  } else if (m.kind === 'ballon') {
    kick = m.place === 0 ? `Ballon d'Or · ${seasonLabel(h.season)}` : `Ballon d'Or · ${['', '2nd place', '3rd place'][m.place]}`;
    title = name(m.player);
    line = m.place === 0 ? 'The best player in the world plays for you.' : `${m.place === 1 ? 'Runner-up' : 'Third'} in the world, behind ${h.ballon!.slice(0, m.place).map((b) => name(b.player)).join(' and ')}.`;
    big = m.place === 0;
  } else {
    const s = mergeStats(h.userStats, h.userCupStats).find((x) => x.id === m.player);
    kick = `Player of the Season · ${seasonLabel(h.season)}`;
    title = name(m.player);
    line = s ? `${s.apps} apps · ${s.goals} goals · ${s.assists} assists · avg ${(s.ratingSum / s.apps).toFixed(2)}` : '';
    big = false;
  }
  const lit = m.kind === 'trophy' ? won.slice(0, won.indexOf(m.trophy) + 1) : won;
  const celebrate = m.kind === 'trophy' || m.kind === 'haul' || (m.kind === 'ballon' && m.place === 0);

  return (
    <>
      <div className={`moments m-${m.kind} ${big ? 'big' : ''} ${m.kind === 'haul' && won.length === 3 ? 'treble' : ''}`} onClick={next}>
        <div className="rays" />
        <div className="sweep" key={`s${at}`} />
        {celebrate && <EraConfetti key={`c${at}`} club={info} count={m.kind === 'haul' ? 260 : 170} seconds={m.kind === 'haul' ? 5 : 3.5} />}
        {celebrate && <div className="flash" key={`f${at}`} />}
        <div className="m-box" key={at}>
          <div className="kick" style={m.kind === 'pots' ? ({ '--club-bar': clubBar(info) } as React.CSSProperties) : undefined}>{kick}</div>
          <div className="title" style={{ fontSize: fit(title, big ? 120 : 92) }}>{title}</div>
          {line && <div className="line">{line}</div>}
          {won.length > 0 && (m.kind === 'trophy' || m.kind === 'haul') && (
            <div className="plates">
              {won.map((t) => <span key={t} className={`plate ${lit.includes(t) ? 'on' : ''}`}>{PLATE[t]}</span>)}
            </div>
          )}
        </div>
        <div className="m-dots">{moments.map((_, k) => <i key={k} className={k === at ? 'on' : k < at ? 'past' : ''} />)}</div>
        <div className="m-prog" key={`p${at}`}><i style={{ animationDuration: `${HOLD[m.kind]}s`, animationPlayState: paused ? 'paused' : 'running' }} /></div>
      </div>
      <CommandBar commands={commands} info={<><span>{info.short}</span><b>{seasonLabel(h.season)}</b></>} />
    </>
  );
}
