import { type ReactNode, useMemo } from 'react';
import { type Career, type CareerPlayer, type Signing, type Trophy, career as computeCareer } from '../game/career';
import { seasonLabel } from '../game/game';
import { formatMoney } from '../game/valuation';
import { Card, playerName } from '../ui/components';
import { useGame } from '../ui/context';
import { ordinal } from './TransferWindow';

export const TROPHY_META: Record<Trophy, { label: string; color: string }> = {
  league: { label: 'League title', color: 'text-amber-300' },
  fa: { label: 'FA Cup', color: 'text-slate-200' },
  cl: { label: 'Champions League', color: 'text-sky-300' },
};

export function TrophyIcons({ list }: { list: Trophy[] }) {
  return (
    <span className="inline-flex gap-0.5">
      {list.map((t) => (
        <span key={t} title={TROPHY_META[t].label} className={TROPHY_META[t].color}>🏆</span>
      ))}
    </span>
  );
}

export function useCareer(): Career {
  const { game } = useGame();
  return useMemo(() => computeCareer(game), [game]);
}

export function HallOfFameContent() {
  const { data } = useGame();
  const c = useCareer();
  if (c.seasons.length === 0) {
    return (
      <Card title="Trophy cabinet">
        <p className="text-sm text-slate-400">The cabinet is empty. Play your first season to start building a legacy.</p>
      </Card>
    );
  }
  const name = (id: number) => playerName(data, id);
  return (
    <>
      <Card title="Trophy cabinet">
        {c.trebles > 0 && (
          <div className="mb-3 rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 p-3 text-center font-black text-amber-950">
            🏆🏆🏆 {c.trebles > 1 ? `${c.trebles}× ` : ''}TREBLE WINNERS
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          {(['league', 'fa', 'cl'] as Trophy[]).map((t) => (
            <div key={t} className={`rounded-lg py-2 ${c.trophies[t] ? 'bg-slate-800' : 'bg-slate-800/40'}`}>
              <div className={`text-2xl ${c.trophies[t] ? TROPHY_META[t].color : 'opacity-25 grayscale'}`}>🏆</div>
              <div className="text-xl font-black tabular-nums">{c.trophies[t]}</div>
              <div className="text-[11px] text-slate-400">{TROPHY_META[t].label}</div>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {c.seasons.map((s) => (
            <li key={s.season} className="flex items-center gap-2">
              <span className="w-16 text-slate-400">{seasonLabel(s.season)}</span>
              <span className={`w-12 font-bold ${s.finish === 1 ? 'text-amber-300' : s.finish <= 4 ? 'text-emerald-400' : s.finish >= 18 ? 'text-rose-400' : ''}`}>
                {ordinal(s.finish)}
              </span>
              <TrophyIcons list={s.trophies} />
              {s.trophies.length === 3 && <span className="text-xs font-bold text-amber-300">TREBLE</span>}
            </li>
          ))}
        </ul>
      </Card>

      {c.playerOfCareer && (
        <Card title="Player of the career">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-2xl">⭐</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold">{name(c.playerOfCareer.id)}</div>
              <div className="text-sm text-slate-400">
                {c.playerOfCareer.apps} apps · {c.playerOfCareer.goals} goals · {c.playerOfCareer.assists} assists · avg{' '}
                {c.playerOfCareer.avg.toFixed(2)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Rated on appearances, average match rating, goals and assists across all competitions.</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerList title="Best average rating" players={c.bestRated} value={(p) => p.avg.toFixed(2)} name={name} note="min. 15 apps" />
        <PlayerList title="Top scorers" players={c.topScorers.filter((p) => p.goals > 0)} value={(p) => String(p.goals)} name={name} />
      </div>

      {(c.bestSigning || c.worstSigning) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {c.bestSigning && <SigningCard title="Best signing" s={c.bestSigning} name={name} good />}
          {c.worstSigning && <SigningCard title="Worst signing" s={c.worstSigning} name={name} />}
        </div>
      )}

      <Card title="Transfer balance">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="Spent" value={formatMoney(c.spent)} tone="text-rose-300" />
          <Stat label="Earned" value={formatMoney(c.earned)} tone="text-emerald-300" />
          <Stat
            label="Net"
            value={`${c.earned - c.spent >= 0 ? '+' : ''}${formatMoney(c.earned - c.spent)}`}
            tone={c.earned >= c.spent ? 'text-emerald-300' : 'text-rose-300'}
          />
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-slate-800 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function PlayerList({ title, players, value, name, note }: { title: string; players: CareerPlayer[]; value: (p: CareerPlayer) => string; name: (id: number) => string; note?: ReactNode }) {
  return (
    <Card title={title} right={note && <span className="text-xs text-slate-500">{note}</span>}>
      {players.length === 0 && <p className="text-sm text-slate-500">Nobody yet.</p>}
      <ol className="space-y-1 text-sm">
        {players.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="w-4 text-slate-500">{i + 1}</span>
            <span className="flex-1 truncate">{name(p.id)}</span>
            <span className="text-xs text-slate-500">{p.apps} apps</span>
            <span className="w-10 text-right font-bold tabular-nums">{value(p)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SigningCard({ title, s, name, good }: { title: string; s: Signing; name: (id: number) => string; good?: boolean }) {
  return (
    <Card title={title}>
      <div className="font-bold">{name(s.t.player)}</div>
      <div className="text-sm text-slate-400">
        Signed {seasonLabel(s.t.season)} for {formatMoney(s.t.fee)} (rated {s.t.ovr})
      </div>
      <div className={`mt-1 text-sm ${good ? 'text-emerald-300' : 'text-rose-300'}`}>
        {s.apps} apps, {s.goals} goals, avg {s.apps ? s.avg.toFixed(2) : '–'} · {s.sold ? `sold for ${formatMoney(s.exitValue)}` : `now worth ${formatMoney(s.exitValue)}`}
      </div>
    </Card>
  );
}

