import { repLabel } from '../game/clubs';
import { NUM_SEASONS } from '../game/data';
import { seasonLabel } from '../game/game';
import { formatMoney } from '../game/valuation';
import { clubInfo } from './components';
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
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${info.primary} 0 50%, ${info.secondary} 50% 100%)` }} />
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{info.name}</div>
          <div className="text-xs text-slate-400">
            {game.stage === 'summary' ? 'Run complete' : `Season ${game.season + 1} of ${NUM_SEASONS} · ${seasonLabel(game.season)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{formatMoney(club.cash)}</div>
          <div className="text-xs text-slate-400">{repLabel(club.rep)} · rep {Math.round(club.rep)}</div>
        </div>
        <button
          onClick={() => confirm('Abandon this run and start again?') && quit()}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-800"
          aria-label="Quit run"
        >
          Quit
        </button>
      </div>
      {game.stage !== 'summary' && (
        <ol className="flex border-t border-slate-800 text-xs">
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
  );
}
