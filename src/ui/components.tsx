import { type ReactNode, useEffect } from 'react';
import { CLUBS } from '../game/clubs';
import type { GameData } from '../game/data';
import { EXTERNAL, type PlayerState } from '../game/game';

export function clubInfo(data: GameData, club: number) {
  return CLUBS.find((c) => c.name === data.meta.gameClubs[club])!;
}

export function playerName(data: GameData, id: number): string {
  return data.names[id]?.[0] ?? `#${id}`;
}

export function ClubBadge({ data, club, size = 28 }: { data: GameData; club: number; size?: number }) {
  if (club === EXTERNAL) return null;
  const c = clubInfo(data, club);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ring-black/20"
      style={{ width: size, height: size, background: c.primary, color: c.secondary, fontSize: size * 0.34 }}
      aria-hidden
    >
      {c.code}
    </span>
  );
}

export function ClubName({ data, club, short = true }: { data: GameData; club: number; short?: boolean }) {
  const c = clubInfo(data, club);
  return <span>{short ? c.short : c.name}</span>;
}

export function ratingClass(ovr: number): string {
  if (ovr >= 85) return 'bg-amber-400 text-amber-950';
  if (ovr >= 80) return 'bg-emerald-400 text-emerald-950';
  if (ovr >= 75) return 'bg-sky-400 text-sky-950';
  if (ovr >= 70) return 'bg-slate-300 text-slate-900';
  return 'bg-slate-600 text-slate-100';
}

export function Rating({ ovr, small }: { ovr: number; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums ${ratingClass(ovr)} ${small ? 'h-6 min-w-7 px-1 text-xs' : 'h-8 min-w-9 px-1.5 text-sm'}`}
    >
      {Math.round(ovr)}
    </span>
  );
}

export function PosChip({ pos }: { pos: string }) {
  const p = pos.split(',')[0];
  const color =
    p === 'GK' ? 'text-amber-300' : ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p) ? 'text-sky-300'
      : ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p) ? 'text-emerald-300' : 'text-rose-300';
  return <span className={`inline-block w-9 shrink-0 text-xs font-semibold ${color}`}>{p}</span>;
}

export function Button({
  children, onClick, disabled, variant = 'primary', className = '', type = 'button',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400',
    secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800',
    danger: 'bg-rose-500 text-rose-950 hover:bg-rose-400',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ title, children, right, className = '' }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800 ${className}`}>
      {title && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-900 p-1 ring-1 ring-slate-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${value === t.id ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl bg-slate-900 ring-1 ring-slate-700 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800" aria-label="Close">✕</button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  );
}

export function PlayerLine({ data, p, right, onClick }: { data: GameData; p: PlayerState; right?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`flex w-full items-center gap-2 py-2 text-left ${onClick ? 'hover:bg-slate-800/60' : ''}`}>
      <PosChip pos={p.pos} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{playerName(data, p.id)}</span>
        <span className="block truncate text-xs text-slate-400">
          {p.age} · {p.pos.replaceAll(',', ', ')} · pot {p.pot}
        </span>
      </span>
      {right}
      <Rating ovr={p.ovr} />
    </Tag>
  );
}
