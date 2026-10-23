import { type ReactNode, useEffect, useState } from 'react';
import { FORMATIONS, type Formation, type Position } from '../game/positions';
import { reducedMotion } from './ui';
import './draft.css';

const ROW_Y: Record<Position, number> = {
  GK: 90, CB: 74, LB: 69, RB: 69, LWB: 57, RWB: 57, CDM: 59, CM: 46, LM: 42, RM: 42, CAM: 32, LW: 20, RW: 20, CF: 17, ST: 11,
};

export function slotCoords(f: Formation): { x: number; y: number }[] {
  const slots = FORMATIONS[f];
  const rows = new Map<number, number[]>();
  slots.forEach((s, i) => rows.set(ROW_Y[s], [...(rows.get(ROW_Y[s]) ?? []), i]));
  const out: { x: number; y: number }[] = [];
  for (const [y, idx] of rows) idx.forEach((slot, k) => (out[slot] = { x: ((k + 1) / (idx.length + 1)) * 100, y }));
  slots.forEach((s, i) => {
    if (['LB', 'LWB', 'LM', 'LW'].includes(s)) out[i].x = Math.min(out[i].x, 14);
    if (['RB', 'RWB', 'RM', 'RW'].includes(s)) out[i].x = Math.max(out[i].x, 86);
  });
  return out;
}

/** Milliseconds per point when a rating ticks to its new value. */
export const TICK_MS = 85;

/** A rating counting from last season's to this one, a point at a time, after a delay. */
export function Tick({ from, to, delay = 0 }: { from?: number; to: number; delay?: number }) {
  const [v, setV] = useState(() => (from === undefined || reducedMotion() ? to : from));
  useEffect(() => {
    if (v === to) return;
    const t = setTimeout(() => setV((x) => x + Math.sign(to - x)), v === from ? delay : TICK_MS);
    return () => clearTimeout(t);
  }, [v, to, from, delay]);
  return <>{v}</>;
}

/** When a ticking rating lands on its new value. */
export const landsAt = (from: number | undefined, to: number, delay: number) => (from === undefined ? delay : delay + Math.abs(to - from) * TICK_MS);

export interface PlateInfo {
  rating?: number;
  /** last season's rating: the plate ticks from it to the new one */
  from?: number;
  name?: string;
  label: string;
  state?: 'empty' | 'open' | 'now' | 'sel' | 'done' | 'star';
  delta?: number;
  delay?: number;
}

/** A player on the pitch or the bench: rating, name, position, and how his rating moved. */
function Plate({ p, className, style, onClick }: { p: PlateInfo; className: string; style?: React.CSSProperties; onClick: () => void }) {
  const land = p.rating !== undefined ? landsAt(p.from, p.rating, p.delay ?? 0) : 0;
  // A big glow-up lights the plate up when its rating lands.
  const glow = p.from !== undefined && p.delta !== undefined && p.delta >= 3;
  return (
    <div className={`dplate ${p.state ?? ''} ${glow ? 'glow' : ''} ${className}`} style={{ ...style, '--land': `${land}ms` } as React.CSSProperties} onClick={onClick}>
      <b>{p.rating === undefined ? '?' : <Tick key={p.name} from={p.from} to={p.rating} delay={p.delay} />}</b>
      <span>{p.name ?? 'Empty'}</span>
      <em>{p.label}</em>
      {p.delta !== undefined && (
        <i className={`delta ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : 'same'}`} style={{ '--d': `${land}ms` } as React.CSSProperties}>
          {p.delta > 0 ? `+${p.delta}` : p.delta === 0 ? '=' : p.delta}
        </i>
      )}
    </div>
  );
}

export function Pitch({ formation, plates, onPick, children }: { formation: Formation; plates: PlateInfo[]; onPick?: (slot: number) => void; children?: ReactNode }) {
  const at = slotCoords(formation);
  return (
    <div className="dpitch">
      <svg className="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".5" vectorEffect="non-scaling-stroke">
          <rect x="2" y="2" width="96" height="96" />
          <line x1="2" y1="50" x2="98" y2="50" />
          <ellipse cx="50" cy="50" rx="12" ry="8" />
          <rect x="26" y="2" width="48" height="14" />
          <rect x="26" y="84" width="48" height="14" />
        </g>
      </svg>
      {plates.map((p, i) => (
        <Plate key={i} p={p} className={onPick ? 'click' : ''} style={{ left: `${at[i].x}%`, top: `${at[i].y}%` }} onClick={() => onPick?.(i)} />
      ))}
      {children}
    </div>
  );
}

/** The substitutes, in a row under the pitch. */
export function BenchStrip({ plates, onPick }: { plates: PlateInfo[]; onPick?: (j: number) => void }) {
  if (!plates.length) return null;
  return (
    <div className="bench-strip">
      <span className="cap">Bench</span>
      {plates.map((p, j) => (
        <Plate key={j} p={p} className={onPick ? 'click' : ''} onClick={() => onPick?.(j)} />
      ))}
    </div>
  );
}
