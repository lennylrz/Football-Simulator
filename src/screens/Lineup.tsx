import { useMemo, useState } from 'react';
import { applyAutoLineup, lineupProblems, setFormation, simulate } from '../game/game';
import { BENCH_SIZE, teamStrength } from '../game/lineup';
import { FORMATION_NAMES, FORMATIONS, type Formation, type Position, parsePositions, positionFit } from '../game/positions';
import { Button, Card, PosChip, playerName, Rating, Sheet } from '../ui/components';
import { useGame } from '../ui/context';
import { BottomBar } from './TransferWindow';

const ROW_Y: Record<Position, number> = {
  GK: 91, CB: 75, LB: 70, RB: 70, LWB: 58, RWB: 58, CDM: 60, CM: 47, LM: 42, RM: 42, CAM: 33, LW: 21, RW: 21, CF: 18, ST: 11,
};

/** Pitch coordinates (percent) for each slot of a formation. */
function slotPositions(formation: Formation): { x: number; y: number }[] {
  const slots = FORMATIONS[formation];
  const rows = new Map<number, number[]>();
  slots.forEach((s, i) => {
    const y = ROW_Y[s];
    rows.set(y, [...(rows.get(y) ?? []), i]);
  });
  const out: { x: number; y: number }[] = [];
  for (const [y, idx] of rows) {
    idx.forEach((slot, k) => {
      out[slot] = { x: ((k + 1) / (idx.length + 1)) * 100, y };
    });
  }
  // Wide players hug the touchline.
  slots.forEach((s, i) => {
    if (['LB', 'LWB', 'LM', 'LW'].includes(s)) out[i].x = Math.min(out[i].x, 14);
    if (['RB', 'RWB', 'RM', 'RW'].includes(s)) out[i].x = Math.max(out[i].x, 86);
  });
  return out;
}

type Pick = { kind: 'xi'; slot: number } | { kind: 'bench'; index: number };

export function Lineup() {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const slots = FORMATIONS[club.formation];
  const [pick, setPick] = useState<Pick | null>(null);
  const coords = useMemo(() => slotPositions(club.formation), [club.formation]);
  const problems = lineupProblems(game, game.user);

  const eff = club.xi.map((id, i) => {
    const p = game.players[id];
    return p ? p.ovr * positionFit(parsePositions(p.pos), slots[i]) : 0;
  });
  const strength = teamStrength(slots, eff);

  const changeFormation = (f: Formation) => act((s) => setFormation(s, s.user, f));

  const choose = (id: number) => {
    if (!pick) return;
    act((s) => {
      const c = s.clubs[s.user];
      const xiIdx = c.xi.indexOf(id);
      const benchIdx = c.bench.indexOf(id);
      if (pick.kind === 'xi') {
        const prev = c.xi[pick.slot];
        if (xiIdx >= 0) c.xi[xiIdx] = prev;
        else if (benchIdx >= 0) c.bench[benchIdx] = prev;
        c.xi[pick.slot] = id;
      } else {
        const prev = c.bench[pick.index];
        if (xiIdx >= 0) c.xi[xiIdx] = prev ?? -1;
        else if (benchIdx >= 0) c.bench[benchIdx] = prev;
        c.bench[pick.index] = id;
        c.bench = c.bench.filter((x) => x !== undefined && x !== -1);
      }
    });
    setPick(null);
  };

  return (
    <>
      <Card title="Formation">
        <div className="flex flex-wrap gap-1.5">
          {FORMATION_NAMES.map((f) => (
            <button
              key={f}
              onClick={() => changeFormation(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${club.formation === f ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-300'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {(['gk', 'def', 'mid', 'att'] as const).map((k) => (
            <div key={k} className="rounded-md bg-slate-800 py-1.5">
              <div className="text-slate-400">{{ gk: 'GK', def: 'Defence', mid: 'Midfield', att: 'Attack' }[k]}</div>
              <div className="text-base font-bold tabular-nums">{strength[k].toFixed(1)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-xl bg-emerald-800 ring-1 ring-emerald-900">
        <PitchMarkings />
        {slots.map((slot, i) => {
          const p = game.players[club.xi[i]];
          const fit = p ? positionFit(parsePositions(p.pos), slot) : 0;
          return (
            <button
              key={i}
              onClick={() => setPick({ kind: 'xi', slot: i })}
              className="absolute flex w-[22%] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${coords[i].x}%`, top: `${coords[i].y}%` }}
            >
              {p ? (
                <Rating ovr={p.ovr * fit} small />
              ) : (
                <span className="flex h-6 min-w-7 items-center justify-center rounded-md bg-slate-900/70 text-xs">+</span>
              )}
              <span className="mt-0.5 max-w-full truncate rounded bg-slate-950/70 px-1 text-[11px] leading-tight">
                {p ? playerName(data, p.id) : slot}
              </span>
              <span className={`text-[10px] font-semibold ${fit >= 1 ? 'text-emerald-200' : fit >= 0.9 ? 'text-amber-200' : 'text-rose-300'}`}>
                {slot}
                {p && fit < 1 ? ` −${Math.round(p.ovr * (1 - fit))}` : ''}
              </span>
            </button>
          );
        })}
      </div>

      <Card title="Bench" right={<span className="text-xs text-slate-400">Subs and cover for knocks</span>}>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: BENCH_SIZE }, (_, i) => {
            const p = game.players[club.bench[i]];
            return (
              <button
                key={i}
                onClick={() => setPick({ kind: 'bench', index: Math.min(i, club.bench.length) })}
                className="flex flex-col items-center rounded-md bg-slate-800 px-1 py-2"
              >
                {p ? <Rating ovr={p.ovr} small /> : <span className="text-slate-500">+</span>}
                <span className="mt-1 w-full truncate text-center text-[11px]">{p ? playerName(data, p.id) : 'Empty'}</span>
                <span className="text-[10px] text-slate-400">{p?.pos.split(',')[0]}</span>
              </button>
            );
          })}
        </div>
        <Button variant="secondary" onClick={() => act((s) => applyAutoLineup(s, s.user))} className="mt-3 w-full">
          Auto-pick best team
        </Button>
      </Card>

      {problems.length > 0 && <p className="text-sm text-rose-300">{problems[0]}</p>}

      {pick && (
        <PickSheet
          slot={pick.kind === 'xi' ? slots[pick.slot] : null}
          current={pick.kind === 'xi' ? club.xi[pick.slot] : club.bench[pick.index]}
          onClose={() => setPick(null)}
          onChoose={choose}
        />
      )}

      <BottomBar>
        <Button onClick={() => act((s) => simulate(s))} disabled={problems.length > 0} className="w-full py-3">
          Play the season
        </Button>
      </BottomBar>
    </>
  );
}

function PickSheet({ slot, current, onClose, onChoose }: { slot: Position | null; current: number | undefined; onClose: () => void; onChoose: (id: number) => void }) {
  const { data, game } = useGame();
  const club = game.clubs[game.user];
  const players = club.squad
    .map((id) => game.players[id])
    .map((p) => ({ p, eff: slot ? p.ovr * positionFit(parsePositions(p.pos), slot) : p.ovr }))
    .sort((a, b) => b.eff - a.eff);
  const status = (id: number) => (club.xi.includes(id) ? 'XI' : club.bench.includes(id) ? 'Bench' : '');
  return (
    <Sheet title={slot ? `Pick ${slot}` : 'Pick a substitute'} onClose={onClose}>
      <ul className="divide-y divide-slate-800">
        {players.map(({ p, eff }) => (
          <li key={p.id}>
            <button
              onClick={() => onChoose(p.id)}
              disabled={p.id === current}
              className="flex w-full items-center gap-2 py-2 text-left disabled:opacity-40"
            >
              <PosChip pos={p.pos} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{playerName(data, p.id)}</span>
                <span className="block text-xs text-slate-400">
                  {p.pos.replaceAll(',', ', ')} · {p.age}
                  {status(p.id) && <span className="ml-1 text-emerald-400">· {status(p.id)}</span>}
                </span>
              </span>
              {slot && eff < p.ovr && <span className="text-xs text-rose-300">−{Math.round(p.ovr - eff)}</span>}
              <Rating ovr={eff} />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function PitchMarkings() {
  return (
    <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
      <g fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2">
        <rect x="8" y="8" width="284" height="384" />
        <line x1="8" y1="200" x2="292" y2="200" />
        <circle cx="150" cy="200" r="36" />
        <rect x="70" y="8" width="160" height="60" />
        <rect x="70" y="332" width="160" height="60" />
      </g>
    </svg>
  );
}

