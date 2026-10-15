import { useMemo, useState } from 'react';
import { NUM_SEASONS } from '../game/data';
import { endSeason, seasonLabel } from '../game/game';
import { Button, Card, ClubBadge, clubInfo, PosChip, playerName, Tabs } from '../ui/components';
import { useGame } from '../ui/context';
import { BottomBar, ordinal } from './TransferWindow';

type Tab = 'table' | 'fixtures' | 'leaders' | 'squad';

export function Results() {
  const { data, game, act } = useGame();
  const [tab, setTab] = useState<Tab>('table');
  const h = game.history[game.history.length - 1];
  const finish = h.table.findIndex((r) => r.club === game.user) + 1;
  const last = game.season >= NUM_SEASONS - 1;

  return (
    <>
      <Card>
        <div className="flex items-center gap-3">
          <ClubBadge data={data} club={h.table[0].club} size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-400">{seasonLabel(game.season)} champions</div>
            <div className="truncate text-lg font-bold">{clubInfo(data, h.table[0].club).name}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-slate-400">You</div>
            <div className={`text-2xl font-black ${finish === 1 ? 'text-amber-300' : finish <= 4 ? 'text-emerald-400' : finish >= 18 ? 'text-rose-400' : ''}`}>
              {ordinal(finish)}
            </div>
          </div>
        </div>
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'table', label: 'Table' },
          { id: 'fixtures', label: 'Results' },
          { id: 'leaders', label: 'Leaders' },
          { id: 'squad', label: 'Your squad' },
        ]}
      />
      {tab === 'table' && <LeagueTable />}
      {tab === 'fixtures' && <Fixtures />}
      {tab === 'leaders' && <Leaders />}
      {tab === 'squad' && <SquadStats />}

      <BottomBar>
        <Button onClick={() => act((s, d) => endSeason(s, d))} className="w-full py-3">
          {last ? 'See your five seasons' : `On to ${seasonLabel(game.season + 1)}`}
        </Button>
      </BottomBar>
    </>
  );
}

function LeagueTable() {
  const { data, game } = useGame();
  const h = game.history[game.history.length - 1];
  return (
    <Card>
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-slate-400">
          <tr>
            <th className="w-6 text-left">#</th>
            <th className="text-left">Club</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th className="hidden sm:table-cell">GF</th>
            <th className="hidden sm:table-cell">GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {h.table.map((r, i) => (
            <tr
              key={r.club}
              className={`border-t border-slate-800 text-center ${r.club === game.user ? 'bg-emerald-500/15 font-semibold' : ''} ${i === 4 || i === 17 ? 'border-t-slate-600' : ''}`}
            >
              <td className="py-1.5 text-left text-slate-400">{i + 1}</td>
              <td className="py-1.5 text-left">
                <span className="flex items-center gap-1.5">
                  <ClubBadge data={data} club={r.club} size={20} />
                  <span className="truncate">{clubInfo(data, r.club).short}</span>
                </span>
              </td>
              <td>{r.p}</td>
              <td>{r.w}</td>
              <td>{r.d}</td>
              <td>{r.l}</td>
              <td className="hidden sm:table-cell">{r.gf}</td>
              <td className="hidden sm:table-cell">{r.ga}</td>
              <td>{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
              <td className="font-bold">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Fixtures() {
  const { data, game } = useGame();
  const result = game.result!;
  const [round, setRound] = useState(0);
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  const matches = useMemo(() => {
    const all = result.rounds.flatMap((r, ri) => r.map((m, mi) => ({ m, round: ri, index: ri * r.length + mi })));
    return mine ? all.filter(({ m }) => m[0] === game.user || m[1] === game.user) : all.filter((x) => x.round === round);
  }, [result, mine, round, game.user]);

  return (
    <Card
      title={mine ? 'Your matches' : `Matchday ${round + 1}`}
      right={
        <button onClick={() => setMine(!mine)} className="text-xs text-emerald-400">
          {mine ? 'All matches' : 'Only yours'}
        </button>
      }
    >
      {!mine && (
        <div className="mb-2 flex items-center gap-2">
          <Button variant="secondary" onClick={() => setRound(Math.max(0, round - 1))} disabled={round === 0} className="!px-3 !py-1">‹</Button>
          <input
            type="range"
            min={0}
            max={result.rounds.length - 1}
            value={round}
            onChange={(e) => setRound(+e.target.value)}
            className="flex-1 accent-emerald-500"
            aria-label="Matchday"
          />
          <Button variant="secondary" onClick={() => setRound(Math.min(result.rounds.length - 1, round + 1))} disabled={round === result.rounds.length - 1} className="!px-3 !py-1">›</Button>
        </div>
      )}
      <ul className="divide-y divide-slate-800">
        {matches.map(({ m: [h, a, hg, ag], round: r, index }) => {
          const userSide = h === game.user ? hg - ag : a === game.user ? ag - hg : null;
          return (
            <li key={index}>
              <button onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center gap-2 py-2 text-sm">
                {mine && <span className="w-7 text-xs text-slate-500">{r + 1}</span>}
                <span className="flex flex-1 items-center justify-end gap-1.5 truncate">
                  <span className="truncate">{clubInfo(data, h).short}</span>
                  <ClubBadge data={data} club={h} size={20} />
                </span>
                <span
                  className={`w-14 rounded-md py-0.5 text-center font-bold tabular-nums ${userSide === null ? 'bg-slate-800' : userSide > 0 ? 'bg-emerald-500/30' : userSide < 0 ? 'bg-rose-500/30' : 'bg-slate-700'}`}
                >
                  {hg}–{ag}
                </span>
                <span className="flex flex-1 items-center gap-1.5 truncate">
                  <ClubBadge data={data} club={a} size={20} />
                  <span className="truncate">{clubInfo(data, a).short}</span>
                </span>
              </button>
              {open === index && (
                <div className="grid grid-cols-2 gap-2 pb-2 text-xs text-slate-300">
                  {[0, 1].map((side) => (
                    <ul key={side} className={side === 0 ? 'text-right' : ''}>
                      {result.scorers[index]
                        .filter((g) => g[2] === side)
                        .map(([s, as], gi) => (
                          <li key={gi}>
                            ⚽ {playerName(data, s)}
                            {as >= 0 && <span className="text-slate-500"> ({playerName(data, as)})</span>}
                          </li>
                        ))}
                    </ul>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Leaders() {
  const { data, game } = useGame();
  const h = game.history[game.history.length - 1];
  const list = (rows: [number, number, number][], label: string) => (
    <Card title={label}>
      <ol className="space-y-1 text-sm">
        {rows.slice(0, 10).map(([id, club, n], i) => (
          <li key={id} className={`flex items-center gap-2 ${club === game.user ? 'font-semibold text-emerald-300' : ''}`}>
            <span className="w-5 text-slate-500">{i + 1}</span>
            <ClubBadge data={data} club={club} size={20} />
            <span className="flex-1 truncate">{playerName(data, id)}</span>
            <span className="font-bold tabular-nums">{n}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list(h.topScorers, 'Top scorers')}
      {list(h.topAssists, 'Top assists')}
    </div>
  );
}

type SortKey = 'apps' | 'goals' | 'assists' | 'avg';

function SquadStats() {
  const { data, game } = useGame();
  const h = game.history[game.history.length - 1];
  const [sort, setSort] = useState<SortKey>('avg');
  const rows = h.userStats
    .map((s) => ({ ...s, avg: s.ratingSum / s.apps, pos: game.players[s.id]?.pos ?? '' }))
    .sort((a, b) => b[sort] - a[sort]);
  const head = (k: SortKey, label: string) => (
    <th className="px-1">
      <button onClick={() => setSort(k)} className={sort === k ? 'text-emerald-400' : ''}>{label}</button>
    </th>
  );
  return (
    <Card>
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-slate-400">
          <tr>
            <th className="text-left">Player</th>
            {head('apps', 'Apps')}
            {head('goals', 'G')}
            {head('assists', 'A')}
            {head('avg', 'Avg')}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-800 text-center">
              <td className="py-1.5 text-left">
                <span className="flex items-center">
                  <PosChip pos={r.pos} />
                  <span className="truncate">{playerName(data, r.id)}</span>
                </span>
              </td>
              <td>
                {r.starts}
                {r.apps > r.starts && <span className="text-slate-500"> ({r.apps - r.starts})</span>}
              </td>
              <td>{r.goals}</td>
              <td>{r.assists}</td>
              <td className={`font-semibold ${r.avg >= 7.2 ? 'text-emerald-400' : r.avg < 6.4 ? 'text-rose-300' : ''}`}>{r.avg.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">Apps: starts (sub appearances).</p>
    </Card>
  );
}
