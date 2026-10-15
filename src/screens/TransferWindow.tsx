import { useMemo, useState } from 'react';
import { EXTERNAL, MAX_SQUAD, MIN_SQUAD, type NewsItem, closeWindow, goToDeadline, seasonLabel } from '../game/game';
import { acceptBid, type Bid, bidsFor, buyOffer, canSell } from '../game/market';
import { formatMoney } from '../game/valuation';
import { Button, Card, ClubBadge, clubInfo, PlayerLine, playerName, Rating, Sheet } from '../ui/components';
import { useGame } from '../ui/context';

const POS_ORDER = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];

export function TransferWindow() {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const [selling, setSelling] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const squad = useMemo(
    () =>
      club.squad
        .map((id) => game.players[id])
        .sort((a, b) => POS_ORDER.indexOf(a.pos.split(',')[0]) - POS_ORDER.indexOf(b.pos.split(',')[0]) || b.ovr - a.ovr),
    [club.squad, game.players],
  );

  const buy = (i: number) =>
    act((s, d) => {
      const err = buyOffer(s, d, i);
      setMessage(err);
    });

  const last = game.history[game.history.length - 1];
  const otherNews = game.news.filter(
    (n) => !(n.kind === 'transfer' && (n.t.to === game.user || n.t.from === game.user)),
  );

  return (
    <>
      {last && <SummerReport />}

      <Card
        title={game.windowPhase === 'open' ? `Transfer window ${seasonLabel(game.season)}` : 'Deadline day'}
        right={<span className="text-xs text-slate-400">Squad {club.squad.length}/{MAX_SQUAD}</span>}
      >
        <p className="mb-2 text-sm text-slate-400">
          {game.windowPhase === 'open'
            ? 'Five players are available to you. Rival clubs are shopping too: anyone you leave may be gone by deadline day.'
            : 'Last chance. Deals done by rival clubs are final.'}
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
                      Buy {formatMoney(o.fee)}
                    </Button>
                  )}
                  {o.status === 'bought' && <span className="shrink-0 font-semibold text-emerald-400">Signed</span>}
                  {o.status === 'gone' && (
                    <span className="flex shrink-0 items-center gap-1 text-rose-300">
                      Joined <ClubBadge data={data} club={o.goneTo!} size={18} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Your squad" right={<span className="text-xs text-slate-400">Tap a player to sell</span>}>
        <ul className="divide-y divide-slate-800">
          {squad.map((p) => (
            <li key={p.id}>
              <PlayerLine
                data={data}
                p={p}
                onClick={() => setSelling(p.id)}
                right={<span className="text-xs tabular-nums text-slate-400">{formatMoney(p.value)}</span>}
              />
            </li>
          ))}
        </ul>
      </Card>

      {otherNews.length > 0 && (
        <Card title="Around the league">
          <ul className="space-y-1.5 text-sm">
            {otherNews.slice().reverse().map((n, i) => (
              <NewsLine key={i} n={n} />
            ))}
          </ul>
        </Card>
      )}

      {selling !== null && (
        <SellSheet
          player={selling}
          onClose={() => setSelling(null)}
          onSold={() => {
            setSelling(null);
            setMessage(null);
          }}
        />
      )}

      <BottomBar>
        {game.windowPhase === 'open' ? (
          <Button onClick={() => act((s, d) => goToDeadline(s, d))} className="w-full py-3">
            Go to deadline day
          </Button>
        ) : (
          <Button onClick={() => act((s, d) => closeWindow(s, d))} className="w-full py-3">
            Close window and pick your team
          </Button>
        )}
      </BottomBar>
    </>
  );
}

export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-2">{children}</div>
    </div>
  );
}

function SellSheet({ player, onClose, onSold }: { player: number; onClose: () => void; onSold: () => void }) {
  const { data, game, act } = useGame();
  const p = game.players[player];
  const bids = useMemo(() => bidsFor(game, data, player), [game, data, player]);
  const [err, setErr] = useState<string | null>(null);
  const allowed = canSell(game);

  const accept = (bid: Bid) => {
    let error: string | null = null;
    act((s, d) => {
      error = acceptBid(s, d, player, bid);
    });
    if (error) setErr(error);
    else onSold();
  };

  return (
    <Sheet title={`Sell ${playerName(data, player)}`} onClose={onClose}>
      <PlayerLine data={data} p={p} />
      <p className="mb-3 text-sm text-slate-400">Market value {formatMoney(p.value)}</p>
      {!allowed && <p className="mb-2 text-sm text-rose-300">You need at least {MIN_SQUAD} players. Buy someone first.</p>}
      {err && <p className="mb-2 text-sm text-rose-300">{err}</p>}
      {bids.length === 0 && <p className="text-sm text-slate-400">No club has made a bid.</p>}
      <ul className="space-y-2">
        {bids.map((b, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-800 p-2">
            {b.club !== EXTERNAL ? <ClubBadge data={data} club={b.club} /> : <span className="w-7 text-center">✈</span>}
            <span className="min-w-0 flex-1 truncate text-sm">{b.club !== EXTERNAL ? clubInfo(data, b.club).name : b.name}</span>
            <Button onClick={() => accept(b)} disabled={!allowed} variant="secondary" className="!px-3 !py-1.5">
              Accept {formatMoney(b.fee)}
            </Button>
          </li>
        ))}
      </ul>
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
            {t.to === EXTERNAL ? ` to ${t.other}` : ''}
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
        Income this summer: <b>{formatMoney(game.income)}</b>.
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

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
