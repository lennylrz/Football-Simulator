import type { ReactNode } from 'react';
import { FORMATIONS, type Formation, type Position } from '../game/positions';
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

export interface PlateInfo {
  rating?: number;
  name?: string;
  label: string;
  state?: 'empty' | 'open' | 'now' | 'sel' | 'done';
  delta?: number;
  delay?: number;
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
        <div key={i} className={`dplate ${p.state ?? ''} ${onPick ? 'click' : ''}`} style={{ left: `${at[i].x}%`, top: `${at[i].y}%` }} onClick={() => onPick?.(i)}>
          <b>{p.rating ?? '?'}</b>
          <span>{p.name ?? 'Empty'}</span>
          <em>{p.label}</em>
          {p.delta !== undefined && (
            <i className={`delta ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : 'same'}`} style={{ '--d': `${p.delay ?? 0}ms` } as React.CSSProperties}>
              {p.delta > 0 ? `+${p.delta}` : p.delta === 0 ? '=' : p.delta}
            </i>
          )}
        </div>
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
        <div key={j} className={`dplate ${p.state ?? ''} ${onPick ? 'click' : ''}`} onClick={() => onPick?.(j)}>
          <b>{p.rating ?? '?'}</b>
          <span>{p.name ?? 'Empty'}</span>
          <em>{p.label}</em>
          {p.delta !== undefined && (
            <i className={`delta ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : 'same'}`} style={{ '--d': `${p.delay ?? 0}ms` } as React.CSSProperties}>
              {p.delta > 0 ? `+${p.delta}` : p.delta === 0 ? '=' : p.delta}
            </i>
          )}
        </div>
      ))}
    </div>
  );
}
