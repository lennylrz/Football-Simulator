import { useMemo, useState } from 'react';
import { type CupMatch, type Entrant, WINNER } from '../game/cups';
import { NUM_SEASONS } from '../game/data';
import { endSeason, seasonLabel, trophiesOf } from '../game/game';
import type { PlayerSeasonStats } from '../game/season';
import { Button, Card, ClubBadge, clubInfo, EntrantBadge, entrantShort, PosChip, playerName, Tabs } from '../ui/components';
import { useGame } from '../ui/context';
import { SeasonReveal } from './SeasonReveal';
import { BottomBar, ordinal } from './TransferWindow';

type Tab = 'table' | 'fixtures' | 'cups' | 'leaders' | 'squad';

export const TROPHY_NAMES = { league: 'League title', fa: 'FA Cup', cl: 'Champions League' } as const;

export function Results() {
  const { data, game, act } = useGame();
  const [tab, setTab] = useState<Tab>('table');
  const [revealing, setRevealing] = useState(true);
  const h = game.history[game.history.length - 1];
  const finish = h.table.findIndex((r) => r.club === game.user) + 1;
  const last = game.season >= NUM_SEASONS - 1;
  const won = trophiesOf(h, game.user);

  return (
    <>
      {revealing && game.result && <SeasonReveal result={game.result} user={game.user} onDone={() => setRevealing(false)} />}
      {won.length === 3 && (
        <div className="rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 p-4 text-center text-amber-950 shadow-lg">
          <div className="text-3xl">🏆🏆🏆</div>
          <div className="text-2xl font-black">THE TREBLE</div>
          <div className="text-sm font-semibold">League, FA Cup and Champions League in {seasonLabel(game.season)}</div>
        </div>
      )}
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
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <CupProgress label="FA Cup" reached={h.faReached[game.user]} winner={h.faWinner} />
          <CupProgress label="Champions League" reached={h.clReached[game.user]} winner={h.clWinner} />
        </div>
        {won.length > 0 && won.length < 3 && (
          <p className="mt-2 text-center text-sm font-semibold text-amber-300">
            🏆 {won.map((t) => TROPHY_NAMES[t]).join(' + ')}
            {won.length === 2 && ' — the double!'}
          </p>
        )}
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'table', label: 'Table' },
          { id: 'fixtures', label: 'Matches' },
          { id: 'cups', label: 'Cups' },
          { id: 'leaders', label: 'Leaders' },
          { id: 'squad', label: 'Squad' },
        ]}
      />
      {tab === 'table' && (
        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-4">
          <LeagueTable />
          <div className="hidden lg:block">
            <Leaders stacked />
          </div>
        </div>
      )}
      {tab === 'fixtures' && <Fixtures />}
      {tab === 'cups' && <Cups />}
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

function CupProgress({ label, reached, winner }: { label: string; reached: string | undefined; winner: Entrant }) {
  const { data } = useGame();
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`font-semibold ${reached === WINNER ? 'text-amber-300' : ''}`}>
        {reached === WINNER ? '🏆 Winners' : reached ? (reached === 'Final' ? 'Runners-up' : reached) : 'Did not qualify'}
      </div>
      {reached !== WINNER && (
        <div className="flex items-center gap-1 truncate text-xs text-slate-500">
          Won by <EntrantBadge data={data} e={winner} size={14} /> <span className="truncate">{entrantShort(data, winner)}</span>
        </div>
      )}
    </div>
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
            <th className="hidden px-1 sm:table-cell">P</th>
            <th className="px-1">W</th>
            <th className="px-1">D</th>
            <th className="px-1">L</th>
            <th className="hidden sm:table-cell">GF</th>
            <th className="hidden sm:table-cell">GA</th>
            <th className="px-1">GD</th>
            <th className="pl-1">Pts</th>
          </tr>
        </thead>
        <tbody>
          {h.table.map((r, i) => (
            <tr
              key={r.club}
              className={`border-t text-center ${i === 4 ? 'border-slate-500' : 'border-slate-800'} ${r.club === game.user ? 'bg-emerald-500/15 font-semibold' : ''}`}
            >
              <td className="py-1.5 text-left text-slate-400">{i + 1}</td>
              <td className="py-1.5 text-left">
                <span className="flex items-center gap-1.5">
                  <ClubBadge data={data} club={r.club} size={20} />
                  <span className="truncate">{clubInfo(data, r.club).short}</span>
                </span>
              </td>
              <td className="hidden sm:table-cell">{r.p}</td>
              <td className="px-1">{r.w}</td>
              <td className="px-1">{r.d}</td>
              <td className="px-1">{r.l}</td>
              <td className="hidden sm:table-cell">{r.gf}</td>
              <td className="hidden sm:table-cell">{r.ga}</td>
              <td className="px-1">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
              <td className="pl-1 font-bold">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">Top four qualify for next season's Champions League.</p>
    </Card>
  );
}

interface Listed {
  key: string;
  slot: number;
  label: string;
  home: Entrant;
  away: Entrant;
  hg: number;
  ag: number;
  pens?: 0 | 1;
  scorers: [number, number, 0 | 1][];
}

function cupLabel(comp: 'FA' | 'CL', m: CupMatch): string {
  const round = m.round === 'Group stage' ? 'Group' : m.round;
  return `${comp} ${round}${m.leg ? ` (leg ${m.leg})` : ''}`;
}

function Fixtures() {
  const { game } = useGame();
  const result = game.result!;
  const [round, setRound] = useState(0);
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const matches = useMemo(() => {
    const out: Listed[] = [];
    result.rounds.forEach((r, ri) =>
      r.forEach(([h, a, hg, ag], mi) => {
        if (mine ? h === game.user || a === game.user : ri === round) {
          out.push({ key: `L${ri}-${mi}`, slot: ri + 1, label: `League ${ri + 1}`, home: h, away: a, hg, ag, scorers: result.scorers[ri * r.length + mi] });
        }
      }),
    );
    if (mine) {
      for (const [comp, cup] of [['FA', result.fa], ['CL', result.cl]] as const) {
        cup.matches.forEach((m, i) => {
          if (m.home === game.user || m.away === game.user) {
            out.push({ key: `${comp}${i}`, slot: m.slot, label: cupLabel(comp, m), home: m.home, away: m.away, hg: m.hg, ag: m.ag, pens: m.pens, scorers: m.scorers });
          }
        });
      }
    }
    return out.sort((a, b) => a.slot - b.slot);
  }, [result, mine, round, game.user]);

  return (
    <Card
      title={mine ? 'Your season' : `Matchday ${round + 1}`}
      right={
        <button onClick={() => setMine(!mine)} className="text-xs text-emerald-400">
          {mine ? 'All league matches' : 'Only yours'}
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
        {matches.map((m) => (
          <MatchRow key={m.key} m={m} showLabel={mine} open={open === m.key} onToggle={() => setOpen(open === m.key ? null : m.key)} />
        ))}
      </ul>
    </Card>
  );
}

function MatchRow({ m, showLabel, open, onToggle }: { m: Listed; showLabel: boolean; open: boolean; onToggle: () => void }) {
  const { data, game } = useGame();
  const diff = m.home === game.user ? m.hg - m.ag : m.away === game.user ? m.ag - m.hg : null;
  const pensWon = m.pens !== undefined && ((m.pens === 0) === (m.home === game.user));
  const tone = diff === null ? 'bg-slate-800' : diff > 0 || (diff === 0 && m.pens !== undefined && pensWon) ? 'bg-emerald-500/30' : diff < 0 || m.pens !== undefined ? 'bg-rose-500/30' : 'bg-slate-700';
  const cup = !m.label.startsWith('League');
  return (
    <li>
      {showLabel && cup && <div className={`pt-1.5 text-[11px] font-semibold ${m.label.startsWith('CL') ? 'text-sky-300' : 'text-rose-300'}`}>{m.label}</div>}
      <button onClick={onToggle} className="flex w-full items-center gap-2 py-2 text-sm">
        <span className="flex flex-1 items-center justify-end gap-1.5 truncate">
          <span className="truncate">{entrantShort(data, m.home)}</span>
          <EntrantBadge data={data} e={m.home} />
        </span>
        <span className={`w-14 rounded-md py-0.5 text-center font-bold tabular-nums ${tone}`}>
          {m.hg}–{m.ag}
        </span>
        <span className="flex flex-1 items-center gap-1.5 truncate">
          <EntrantBadge data={data} e={m.away} />
          <span className="truncate">{entrantShort(data, m.away)}</span>
        </span>
      </button>
      {m.pens !== undefined && (
        <div className="-mt-1 pb-1 text-center text-[11px] text-slate-400">
          {entrantShort(data, m.pens === 0 ? m.home : m.away)} win on penalties
        </div>
      )}
      {open && (
        <div className="grid grid-cols-2 gap-2 pb-2 text-xs text-slate-300">
          {[0, 1].map((side) => (
            <ul key={side} className={side === 0 ? 'text-right' : ''}>
              {m.scorers
                .filter((g) => g[2] === side)
                .map(([s, as], gi) => (
                  <li key={gi}>
                    ⚽ {playerName(data, s)}
                    {as >= 0 && <span className="text-slate-500"> ({playerName(data, as)})</span>}
                  </li>
                ))}
            </ul>
          ))}
          {m.scorers.length === 0 && m.hg + m.ag > 0 && <p className="col-span-2 text-center text-slate-500">Scorers not recorded for clubs abroad.</p>}
        </div>
      )}
    </li>
  );
}

function Cups() {
  const { data, game } = useGame();
  const result = game.result!;
  const group = result.cl.groups?.find((g) => g.some((r) => r.team === game.user));
  const toListed = (comp: 'FA' | 'CL', m: CupMatch, i: number): Listed => ({
    key: `${comp}${i}`, slot: m.slot, label: cupLabel(comp, m), home: m.home, away: m.away, hg: m.hg, ag: m.ag, pens: m.pens, scorers: m.scorers,
  });
  const [open, setOpen] = useState<string | null>(null);
  const ko = result.cl.matches.map((m, i) => toListed('CL', m, i)).filter((m) => !m.label.includes('Group'));
  const faLate = result.fa.matches
    .map((m, i) => toListed('FA', m, i))
    .filter((m) => /Quarter|Semi|Final/.test(m.label) || m.home === game.user || m.away === game.user);
  const rows = (list: Listed[]) => {
    let lastLabel = '';
    return list.map((m) => {
      const heading = m.label.replace(/ \(leg \d\)/, '');
      const show = heading !== lastLabel;
      lastLabel = heading;
      return (
        <div key={m.key}>
          {show && <div className="pt-2 text-xs font-semibold text-slate-400">{heading.replace(/^(FA|CL) /, '')}</div>}
          <MatchRow m={m} showLabel={false} open={open === m.key} onToggle={() => setOpen(open === m.key ? null : m.key)} />
        </div>
      );
    });
  };
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <Card title="Champions League" right={<EntrantChip e={result.cl.winner} />}>
        {group ? (
          <table className="mb-2 w-full text-sm tabular-nums">
            <thead className="text-xs text-slate-400">
              <tr><th className="text-left">Your group</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
            </thead>
            <tbody>
              {group.map((r, i) => (
                <tr key={String(r.team)} className={`border-t border-slate-800 text-center ${r.team === game.user ? 'bg-emerald-500/15 font-semibold' : ''} ${i === 2 ? 'border-slate-500' : ''}`}>
                  <td className="py-1.5 text-left">
                    <span className="flex items-center gap-1.5"><EntrantBadge data={data} e={r.team} /> <span className="truncate">{entrantShort(data, r.team)}</span></span>
                  </td>
                  <td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf - r.ga}</td><td className="font-bold">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mb-2 text-sm text-slate-400">You didn't qualify this season. Finish in the top four to get in.</p>
        )}
        <ul className="divide-y divide-slate-800">{rows(ko)}</ul>
      </Card>
      <Card title="FA Cup" right={<EntrantChip e={result.fa.winner} />}>
        <p className="text-xs text-slate-500">Your ties, then the quarter-finals onwards.</p>
        <ul className="divide-y divide-slate-800">{rows(faLate)}</ul>
      </Card>
    </div>
  );
}

function EntrantChip({ e }: { e: Entrant }) {
  const { data } = useGame();
  return (
    <span className="flex items-center gap-1 text-xs text-amber-300">
      🏆 <EntrantBadge data={data} e={e} size={16} /> {entrantShort(data, e)}
    </span>
  );
}

function Leaders({ stacked = false }: { stacked?: boolean }) {
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
    <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-2'}`}>
      {list(h.topScorers, 'League top scorers')}
      {list(h.topAssists, 'League top assists')}
    </div>
  );
}

type SortKey = 'apps' | 'goals' | 'assists' | 'avg';

export function mergeStats(a: PlayerSeasonStats[], b: PlayerSeasonStats[]): PlayerSeasonStats[] {
  const map = new Map<number, PlayerSeasonStats>();
  for (const s of [...a, ...b]) {
    const m = map.get(s.id);
    if (!m) map.set(s.id, { ...s });
    else {
      m.apps += s.apps;
      m.starts += s.starts;
      m.goals += s.goals;
      m.assists += s.assists;
      m.ratingSum += s.ratingSum;
    }
  }
  return [...map.values()];
}

function SquadStats() {
  const { data, game } = useGame();
  const h = game.history[game.history.length - 1];
  const [sort, setSort] = useState<SortKey>('avg');
  const [all, setAll] = useState(false);
  const stats = all ? mergeStats(h.userStats, h.userCupStats) : h.userStats;
  const rows = stats
    .map((s) => ({ ...s, avg: s.ratingSum / s.apps, pos: game.players[s.id]?.pos ?? '' }))
    .sort((a, b) => b[sort] - a[sort]);
  const head = (k: SortKey, label: string) => (
    <th className="px-1">
      <button onClick={() => setSort(k)} className={sort === k ? 'text-emerald-400' : ''}>{label}</button>
    </th>
  );
  return (
    <Card
      title={all ? 'All competitions' : 'League'}
      right={<button onClick={() => setAll(!all)} className="text-xs text-emerald-400">{all ? 'League only' : 'All competitions'}</button>}
    >
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
      <p className="mt-2 text-xs text-slate-500">Apps: starts (sub appearances). Avg: average match rating.</p>
    </Card>
  );
}
