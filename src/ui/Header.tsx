import { useState } from 'react';
import { repLabel } from '../game/clubs';
import { HallOfFameContent } from '../screens/HallOfFame';
import { NUM_SEASONS } from '../game/data';
import { seasonLabel } from '../game/game';
import { formatMoney } from '../game/valuation';
import { clubInfo, useScrollLock } from './components';
import { useGame } from './context';

const STEPS = [
  { stage: 'window', label: 'Transfers' },
  { stage: 'lineup', label: 'Team' },
  { stage: 'results', label: 'Season' },
] as const;

export function Header() {
  const { data, game, quit } = useGame();
  const club = game.clubs[game.user];
  const info = clubInfo(data, game.user);
  const step = STEPS.findIndex((s) => s.stage === game.stage);
  const [hall, setHall] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  return (
    <>
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${info.primary} 0 50%, ${info.secondary} 50% 100%)` }} />
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 lg:px-6 lg:py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">
            <span className="sm:hidden">{info.short}</span>
            <span className="hidden sm:inline">{info.name}</span>
          </div>
          <div className="text-xs text-slate-400">
            {game.stage === 'summary' ? 'Run complete' : `${seasonLabel(game.season)} · season ${game.season + 1}/${NUM_SEASONS}`}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{formatMoney(club.cash)}</div>
          <div className="text-xs text-slate-400">{repLabel(club.rep)} · rep {Math.round(club.rep)}</div>
        </div>
        {game.stage !== 'summary' && (
          <button
            onClick={() => setHall(true)}
            className="rounded-md px-2 py-1 text-lg hover:bg-slate-800"
            aria-label="Hall of Fame"
            title="Hall of Fame"
          >
            🏆
          </button>
        )}
        {confirmQuit ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="hidden text-slate-400 sm:inline">Abandon this run?</span>
            <button onClick={quit} className="rounded-md bg-rose-500 px-2 py-1 font-semibold text-rose-950 hover:bg-rose-400">
              Quit
            </button>
            <button onClick={() => setConfirmQuit(false)} className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800">
              Keep playing
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmQuit(true)}
            className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-800"
            aria-label="Quit run"
          >
            Quit
          </button>
        )}
      </div>
      {game.stage !== 'summary' && (
        <ol className="mx-auto flex max-w-6xl border-t border-slate-800 text-xs lg:text-sm">
          {STEPS.map((s, i) => (
            <li
              key={s.stage}
              className={`flex-1 py-1.5 text-center ${i === step ? 'font-semibold text-emerald-400' : i < step ? 'text-slate-400' : 'text-slate-600'}`}
            >
              {i + 1}. {s.label}
            </li>
          ))}
        </ol>
      )}
    </header>
    {hall && <HallOverlay onClose={() => setHall(false)} />}
    </>
  );
}

function HallOverlay({ onClose }: { onClose: () => void }) {
  useScrollLock();
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
      <div className="mx-auto max-w-6xl space-y-3 p-3 pb-10 lg:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Hall of Fame</h2>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-slate-300 hover:bg-slate-800" aria-label="Close">
            ✕
          </button>
        </div>
        <HallOfFameContent />
      </div>
    </div>
  );
}
