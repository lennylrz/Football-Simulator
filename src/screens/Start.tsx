import { useMemo, useState } from 'react';
import { CLUBS, repLabel } from '../game/clubs';
import type { GameData } from '../game/data';
import { formatMoney } from '../game/valuation';
import { Button } from '../ui/components';

export function Start({ data, onStart }: { data: GameData; onStart: (club: number, seed: number) => void }) {
  const [club, setClub] = useState<number | null>(null);
  const [seedText, setSeedText] = useState('');

  const clubs = useMemo(() => {
    return data.meta.gameClubs
      .map((name, i) => {
        const info = CLUBS.find((c) => c.name === name)!;
        const ratings = data.squads[name].map((id) => data.seasons[0][id][0]).sort((a, b) => b - a);
        const xi = ratings.slice(0, 11).reduce((s, x) => s + x, 0) / 11;
        const star = data.squads[name]
          .map((id) => ({ id, ovr: data.seasons[0][id][0] }))
          .sort((a, b) => b.ovr - a.ovr)[0];
        return { i, info, xi, star };
      })
      .sort((a, b) => b.info.rep - a.info.rep || b.xi - a.xi);
  }, [data]);

  const begin = () => {
    if (club === null) return;
    const parsed = Number.parseInt(seedText, 10);
    const seed = Number.isFinite(parsed) ? parsed >>> 0 : Math.floor(Math.random() * 2 ** 32);
    onStart(club, seed);
  };

  return (
    <div className="mx-auto max-w-3xl px-3 pb-32 pt-6">
      <h1 className="text-3xl font-black tracking-tight">Five Seasons</h1>
      <p className="mt-1 text-slate-400">
        Take over an English top-flight club in summer 2015 and manage it to 2020. Buy, sell, pick your team and play each season in
        one click. Players develop as they really did, give or take.
      </p>
      <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-400/30">
        🏆🏆🏆 The ultimate goal: <b>the treble</b>. League, FA Cup and Champions League in one season. Hard even with the best
        squad in the country.
      </p>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">Pick your club</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {clubs.map(({ i, info, xi, star }) => (
          <button
            key={i}
            onClick={() => setClub(i)}
            className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition ${club === i ? 'bg-slate-800 ring-emerald-400' : 'bg-slate-900 ring-slate-800 hover:bg-slate-800/70'}`}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ring-1 ring-black/30"
              style={{ background: info.primary, color: info.secondary }}
            >
              {info.code}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{info.name}</span>
              <span className="block truncate text-xs text-slate-400">
                {repLabel(info.rep)} · budget {formatMoney(info.budget * 1000)} · best XI {xi.toFixed(1)}
              </span>
              <span className="block truncate text-xs text-slate-500">
                Star: {data.names[star.id][0]} ({star.ovr})
              </span>
            </span>
          </button>
        ))}
      </div>

      <details className="mt-4 text-sm text-slate-400">
        <summary className="cursor-pointer">Replay a run</summary>
        <label className="mt-2 flex items-center gap-2">
          Seed
          <input
            inputMode="numeric"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value.replace(/\D/g, ''))}
            placeholder="random"
            className="w-40 rounded-md bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <p className="mt-1 text-xs">The same seed, club and decisions replay the same run.</p>
      </details>

      <p className="mt-6 text-xs text-slate-500">
        Unofficial fan game, not affiliated with any league or club. Player ratings from FIFA 16 to FIFA 20 via the "FIFA 23 complete
        player dataset" (Stefano Leone, Kaggle, CC0).
      </p>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button onClick={begin} disabled={club === null} className="w-full py-3 text-base">
            {club === null ? 'Choose a club' : `Manage ${CLUBS.find((c) => c.name === data.meta.gameClubs[club])!.name}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
