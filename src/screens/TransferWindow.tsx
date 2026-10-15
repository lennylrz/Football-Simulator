import { useMemo, useState } from 'react';
import { WINNER } from '../game/cups';
import { EXTERNAL, MAX_SQUAD, type NewsItem, nextWindowStep, seasonLabel, topTransfers } from '../game/game';
import { acceptIncomingBid, buyOffer, canSell, rejectIncomingBid, releasePlayer } from '../game/market';
import { formatMoney } from '../game/valuation';
import { Button, Card, ClubBadge, clubInfo, PlayerLine, playerName, Rating, Sheet } from '../ui/components';
import { useGame } from '../ui/context';

const POS_ORDER = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];

export function TransferWindow() {
  const { game } = useGame();
  return (
    <>
      {game.step === 'squad' && <SquadStep />}
      {game.step === 'offers' && <OffersStep />}
      {game.step === 'bids' && <BidsStep />}
    </>
  );
}

function useSortedSquad() {
  const { game } = useGame();
  const club = game.clubs[game.user];
  return useMemo(
    () =>
      club.squad
        .map((id) => game.players[id])
        .sort((a, b) => POS_ORDER.indexOf(a.pos.split(',')[0]) - POS_ORDER.indexOf(b.pos.split(',')[0]) || b.ovr - a.ovr),
    [club.squad, game.players],
  );
}

function SquadStep() {
  const { data, game, act } = useGame();
  const squad = useSortedSquad();
  const [releasing, setReleasing] = useState<number | null>(null);
  const last = game.history[game.history.length - 1];
  return (
    <>
      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-3 lg:space-y-4">
          {last ? (
            <SummerReport />
          ) : (
            <Card title={`Summer ${seasonLabel(game.season).slice(0, 4)}`}>
              <p className="text-sm text-slate-300">
                This is the squad you inherit. Next you'll see the players available to you, then any bids for your own players, and
                finally you pick your team.
              </p>
            </Card>
          )}
          <AroundTheLeagueButton />
        </div>
        <Card title="Your squad" right={<span className="text-xs text-slate-400">{squad.length}/{MAX_SQUAD} players</span>}>
          <ul className="divide-y divide-slate-800">
            {squad.map((p) => (
              <li key={p.id}>
                <PlayerLine
                  data={data}
                  p={p}
                  onClick={() => setReleasing(p.id)}
                  right={<span className="text-xs tabular-nums text-slate-400">{formatMoney(p.value)}</span>}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {releasing !== null && <ReleaseSheet player={releasing} onClose={() => setReleasing(null)} />}
      <BottomBar>
        <Button onClick={() => act((s, d) => nextWindowStep(s, d))} className="w-full py-3">
          See who's available
        </Button>
      </BottomBar>
    </>
  );
}

function OffersStep() {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const [message, setMessage] = useState<string | null>(null);
  const buy = (i: number) => {
    let err: string | null = null;
    act((s, d) => {
      err = buyOffer(s, d, i);
    });
    setMessage(err);
  };
  return (
    <>
      <div className="mx-auto max-w-3xl space-y-3">
        <Card
          title={`Transfer offers ${seasonLabel(game.season)}`}
          right={<span className="text-xs text-slate-400">Squad {club.squad.length}/{MAX_SQUAD}</span>}
        >
          <p className="mb-2 text-sm text-slate-400">
            These players are available to you. Rival clubs are watching them too: anyone you pass on may sign elsewhere on deadline day.
          </p>
          {message && <p className="mb-2 rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{message}</p>}
          <ul className="divide-y divide-slate-800">
            {game.offers.map((o, i) => {
              const p = game.players[o.player];
              const row = data.seasons[game.season][o.player];
              return (
                <li key={o.player} className={o.status !== 'open' ? 'opacity-60' : ''}>
                  <PlayerLine data={data} p={p} />
                  <div className="flex items-center justify-between gap-2 pb-2 pl-11 text-xs text-slate-400">
                    <span className="min-w-0 truncate">
                      {row ? data.meta.clubNames[row[6]] : 'Free agent'} · value {formatMoney(p.value)}
                    </span>
                    {o.status === 'open' && (
                      <Button
                        onClick={() => buy(i)}
                        disabled={club.cash < o.fee || club.squad.length >= MAX_SQUAD}
                        className="shrink-0 !px-3 !py-1.5"
                      >
                        Sign for {formatMoney(o.fee)}
                      </Button>
                    )}
                    {o.status === 'bought' && <span className="shrink-0 font-semibold text-emerald-400">Signed</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <AroundTheLeagueButton />
      </div>
      <BottomBar>
        <Button onClick={() => act((s, d) => nextWindowStep(s, d))} className="w-full py-3">
          Go to deadline day
        </Button>
      </BottomBar>
    </>
  );
}

function BidsStep() {
  const { data, game, act } = useGame();
  const [message, setMessage] = useState<string | null>(null);
  const gone = game.offers.filter((o) => o.status === 'gone');
  const accept = (i: number) => {
    let err: string | null = null;
    act((s, d) => {
      err = acceptIncomingBid(s, d, i);
    });
    setMessage(err);
  };
  return (
    <>
      <div className="mx-auto max-w-3xl space-y-3">
        {gone.length > 0 && (
          <Card title="Deadline day">
            <ul className="space-y-1.5 text-sm">
              {gone.map((o) => (
                <li key={o.player} className="flex items-center gap-2">
                  <ClubBadge data={data} club={o.goneTo!} size={20} />
                  <span>
                    <b>{playerName(data, o.player)}</b> <span className="text-slate-400">joined {clubInfo(data, o.goneTo!).name}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Bids for your players">
          <p className="mb-2 text-sm text-slate-400">
            {game.bids.length
              ? 'Clubs have come in for some of your players. Accept a bid to sell, or keep him.'
              : 'Nobody has bid for your players this summer.'}
          </p>
          {message && <p className="mb-2 rounded-md bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{message}</p>}
          <ul className="space-y-2">
            {game.bids.map((b, i) => {
              const p = game.players[b.player];
              const ratio = b.fee / Math.max(1, p.value);
              return (
                <li key={i} className={`rounded-lg bg-slate-800/60 px-3 ${b.status === 'open' ? '' : 'opacity-50'}`}>
                  <PlayerLine data={data} p={p} />
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      {b.club !== EXTERNAL && <ClubBadge data={data} club={b.club} size={20} />}
                      <span className="truncate">
                        {b.name} bid <b>{formatMoney(b.fee)}</b>
                        <span className={`ml-1 text-xs ${ratio >= 1.15 ? 'text-emerald-400' : ratio < 0.92 ? 'text-rose-300' : 'text-slate-400'}`}>
                          (value {formatMoney(p.value)})
                        </span>
                      </span>
                    </span>
                    {b.status === 'open' ? (
                      <span className="flex gap-2">
                        <Button variant="ghost" onClick={() => act((s) => rejectIncomingBid(s, i))} className="!px-3 !py-1.5">
                          Reject
                        </Button>
                        <Button variant="secondary" onClick={() => accept(i)} className="!px-3 !py-1.5">
                          Accept
                        </Button>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {{ accepted: 'Sold', rejected: 'Rejected', void: 'Off the table', open: '' }[b.status]}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <AroundTheLeagueButton />
      </div>
      <BottomBar>
        <Button onClick={() => act((s, d) => nextWindowStep(s, d))} className="w-full py-3">
          Close the window and pick your team
        </Button>
      </BottomBar>
    </>
  );
}

function AroundTheLeagueButton() {
  const { data, game } = useGame();
  const [open, setOpen] = useState(false);
  const top = topTransfers(game, game.season);
  if (top.length === 0) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-left text-sm ring-1 ring-slate-800 hover:bg-slate-800"
      >
        <span>
          <span className="font-semibold">Around the league</span>
          <span className="block text-xs text-slate-400">The biggest deals of the summer so far</span>
        </span>
        <span className="text-slate-400">›</span>
      </button>
      {open && (
        <Sheet title="Biggest deals this summer" onClose={() => setOpen(false)}>
          <ol className="space-y-2 text-sm">
            {top.map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-slate-500 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{playerName(data, t.player)}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {t.from === EXTERNAL ? t.other : clubInfo(data, t.from).short} → {t.to === EXTERNAL ? t.other : clubInfo(data, t.to).short}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(t.fee)}</span>
              </li>
            ))}
          </ol>
        </Sheet>
      )}
    </>
  );
}

export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-6xl gap-2 lg:justify-end lg:px-3 lg:*:w-auto lg:*:px-10">{children}</div>
    </div>
  );
}

function ReleaseSheet({ player, onClose }: { player: number; onClose: () => void }) {
  const { data, game, act } = useGame();
  const p = game.players[player];
  const [err, setErr] = useState<string | null>(null);
  const release = () => {
    let error: string | null = null;
    act((s, d) => {
      error = releasePlayer(s, d, player);
    });
    if (error) setErr(error);
    else onClose();
  };
  return (
    <Sheet title={playerName(data, player)} onClose={onClose}>
      <PlayerLine data={data} p={p} />
      <p className="mb-3 text-sm text-slate-400">
        Market value {formatMoney(p.value)}. You can only sell players that clubs bid for, but you can release anyone on a free transfer to
        make room.
      </p>
      {err && <p className="mb-2 text-sm text-rose-300">{err}</p>}
      <Button variant="danger" onClick={release} disabled={!canSell(game)} className="w-full">
        Release on a free transfer
      </Button>
    </Sheet>
  );
}

function NewsLine({ n }: { n: NewsItem }) {
  const { data } = useGame();
  if (n.kind === 'transfer') {
    const t = n.t;
    return (
      <li className="flex items-center gap-2">
        {t.to !== EXTERNAL ? <ClubBadge data={data} club={t.to} size={20} /> : <span className="w-5 text-center text-xs">✈</span>}
        <span className="min-w-0 flex-1 truncate">
          <b>{playerName(data, t.player)}</b>{' '}
          <span className="text-slate-400">
            {t.from === EXTERNAL ? `from ${t.other}` : `from ${clubInfo(data, t.from).short}`}
            {t.to === EXTERNAL ? (t.other === 'Released' ? ', released' : ` to ${t.other}`) : ''}
          </span>
        </span>
        <span className="text-xs tabular-nums text-slate-400">{t.fee ? formatMoney(t.fee) : 'free'}</span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2">
      <ClubBadge data={data} club={n.club} size={20} />
      <span className="flex-1 truncate">
        <b>{playerName(data, n.player)}</b>{' '}
        <span className="text-slate-400">{n.kind === 'retired' ? 'retired' : 'promoted from the academy'}</span>
      </span>
    </li>
  );
}

function SummerReport() {
  const { data, game } = useGame();
  const last = game.history[game.history.length - 1];
  const finish = last.table.findIndex((r) => r.club === game.user) + 1;
  const risers = game.devReport.filter((d) => game.players[d.player].club === game.user).sort((a, b) => b.to - b.from - (a.to - a.from));
  const mine = game.news.filter((n) => n.kind !== 'transfer' && n.club === game.user);
  return (
    <Card title="Summer report">
      <p className="text-sm">
        Last season you finished <b>{ordinal(finish)}</b>. Reputation {Math.round(last.repBefore)} → {Math.round(last.repAfter ?? last.repBefore)}.
        Income this summer, including prize money: <b>{formatMoney(game.income)}</b>.
      </p>
      <p className="mt-1 text-sm text-slate-300">
        FA Cup: {cupText(last.faReached[game.user])} · Champions League: {cupText(last.clReached[game.user])}
      </p>
      {risers.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs uppercase text-slate-500">Improved</div>
            {risers.slice(0, 3).filter((d) => d.to > d.from).map((d) => (
              <div key={d.player} className="flex items-center justify-between gap-1">
                <span className="truncate">{playerName(data, d.player)}</span>
                <span className="text-emerald-400 tabular-nums">+{d.to - d.from} <Rating ovr={d.to} small /></span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Declined</div>
            {risers.slice(-3).reverse().filter((d) => d.to < d.from).map((d) => (
              <div key={d.player} className="flex items-center justify-between gap-1">
                <span className="truncate">{playerName(data, d.player)}</span>
                <span className="text-rose-400 tabular-nums">{d.to - d.from} <Rating ovr={d.to} small /></span>
              </div>
            ))}
          </div>
        </div>
      )}
      {mine.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {mine.map((n, i) => <NewsLine key={i} n={n} />)}
        </ul>
      )}
    </Card>
  );
}

function cupText(reached: string | undefined): string {
  if (!reached) return 'did not qualify';
  if (reached === WINNER) return '🏆 winners';
  if (reached === 'Final') return 'runners-up';
  return reached.toLowerCase();
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
