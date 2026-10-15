import { type ReactNode, useMemo, useState } from 'react';
import { MAX_SQUAD, MIN_SQUAD, nextWindowStep, type PlayerState, seasonLabel } from '../../game/game';
import { acceptIncomingBid, buyOffer, canSell, rejectIncomingBid, releasePlayer } from '../../game/market';
import { useGame } from '../../ui/context';
import { hubDate, shortDate } from '../hub';
import { AroundTheLeague, closeCommand } from '../overlays';
import {
  browse, clubOf, type Command, Frame, money, moneyShort, ordinal, Overlay, primaryPos, useListNav, useScrollIntoView,
} from '../ui';

const POS_ORDER = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];

function deadline(season: number): string {
  return shortDate(new Date(hubDate(season).getTime() + 24 * 86_400_000));
}

function Shell({
  title, office, left, right, commands, overlay,
}: { title: string; office: ReactNode; left: ReactNode; right: ReactNode; commands: Command[]; overlay?: ReactNode }) {
  const { data, game } = useGame();
  const info = clubOf(data, game.user);
  return (
    <Frame
      club={info}
      title={info.name}
      sub={title}
      right={<><small>Transfer Window</small>{seasonLabel(game.season)}</>}
      commands={commands}
      info={<><span>Budget</span><b>{money(game.clubs[game.user].cash)}</b></>}
    >
      <div className="win">
        <div className="win-title">{title}</div>
        <div className="office">{office}</div>
        <div className="panes">
          <div className="pane dpanel">{left}</div>
          <div className="pane dpanel">{right}</div>
        </div>
      </div>
      {overlay}
    </Frame>
  );
}

function ManagerOffice() {
  const { data, game } = useGame();
  const club = game.clubs[game.user];
  return (
    <div className="col">
      <span className="cap">Manager's Office</span>
      <span className="big">{clubOf(data, game.user).name}</span>
      <span className="kv"><b>Transfer Budget</b><span>{money(club.cash)}</span></span>
      <span className="kv"><b>Squad Size</b><span>{club.squad.length} / {MAX_SQUAD}</span></span>
    </div>
  );
}

function PlayerOffice({ p, children }: { p?: PlayerState; children: ReactNode }) {
  const { data } = useGame();
  return (
    <div className="col">
      <span className="cap">Selected Player</span>
      <span className="big">{p ? data.names[p.id][0] : '—'}</span>
      {children}
    </div>
  );
}

/* ---------------- Step 1: your squad ---------------- */

export function SquadStep({ onHub }: { onHub: () => void }) {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const squad = useMemo(
    () =>
      club.squad
        .map((id) => game.players[id])
        .sort((a, b) => POS_ORDER.indexOf(primaryPos(a.pos)) - POS_ORDER.indexOf(primaryPos(b.pos)) || b.ovr - a.ovr),
    [club.squad, game.players],
  );
  const nav = useListNav(squad.length);
  const body = useScrollIntoView(nav.index);
  const p = squad[nav.index];
  const [overlay, setOverlay] = useState<'around' | 'release' | null>(null);
  const last = game.history[game.history.length - 1];
  const changes = game.devReport.filter((d) => game.players[d.player].club === game.user).sort((a, b) => b.to - b.from - (a.to - a.from));
  const mine = game.news.flatMap((n) => (n.kind !== 'transfer' && n.club === game.user ? [n] : []));

  const commands: Command[] =
    overlay === 'release'
      ? [
          { keys: ['Enter'], label: 'Release', primary: true, onPress: () => { act((s, d) => void releasePlayer(s, d, p.id)); setOverlay(null); } },
          { keys: ['Escape'], label: 'Keep Him', onPress: () => setOverlay(null) },
        ]
      : overlay
        ? closeCommand(() => setOverlay(null))
        : [
            { keys: ['Enter'], label: 'Continue', primary: true, onPress: () => act((s, d) => nextWindowStep(s, d)) },
            browse('Browse', nav.up, nav.down),
            { keys: ['R'], label: 'Release', disabled: !canSell(game), onPress: () => setOverlay('release') },
            { keys: ['T'], label: 'Around the League', onPress: () => setOverlay('around') },
            { keys: ['Escape'], label: 'Hub', onPress: onHub },
          ];

  return (
    <Shell
      title="Your Squad"
      commands={commands}
      office={
        <>
          <ManagerOffice />
          <div className="sep" />
          <PlayerOffice p={p}>
            <span className="kv"><span>Positions</span><span>{p?.pos.replaceAll(',', ', ')}</span></span>
            <span className="kv"><span>Age · Overall</span><span>{p?.age} · {p?.ovr}</span></span>
            <span className="kv"><span>Market Value</span><b>{p ? money(p.value) : ''}</b></span>
          </PlayerOffice>
        </>
      }
      left={
        <>
          <div className="ph gbar">{last ? `Summer Report ${seasonLabel(game.season)}` : `Summer ${seasonLabel(0).slice(0, 4)}`}</div>
          <div className="kvlist scroll" style={{ overflowY: 'auto' }}>
            {last ? (
              <>
                <div><span>Last Season</span><b>{ordinal(last.table.findIndex((r) => r.club === game.user) + 1)} place</b></div>
                <div><span>Reputation</span><b>{Math.round(last.repBefore)} → {Math.round(last.repAfter ?? last.repBefore)}</b></div>
                <div><span>Income incl. Prizes</span><b>{money(game.income)}</b></div>
                {changes.length > 0 && <div className="head">Over the summer</div>}
                {changes.slice(0, 3).filter((d) => d.to > d.from).map((d) => (
                  <div key={d.player}><span>{data.names[d.player][0]}</span><b className="up">+{d.to - d.from} → {d.to}</b></div>
                ))}
                {changes.slice(-3).reverse().filter((d) => d.to < d.from).map((d) => (
                  <div key={d.player}><span>{data.names[d.player][0]}</span><b className="down">{d.to - d.from} → {d.to}</b></div>
                ))}
                {mine.map((n, i) => (
                  <div key={i}><span>{data.names[n.player][0]}</span><b>{n.kind === 'youth' ? 'Academy graduate' : 'Retired'}</b></div>
                ))}
              </>
            ) : (
              <>
                <div><span>1 · Your Squad</span><b>Now</b></div>
                <div><span>2 · Transfer Offers</span><b>Sign players</b></div>
                <div><span>3 · Bids</span><b>Sell players</b></div>
                <div><span>4 · Pick Your Team</span><b>Then play</b></div>
                <div className="head">Squad rules</div>
                <div><span>Squad Size</span><b>{MIN_SQUAD} to {MAX_SQUAD}</b></div>
              </>
            )}
          </div>
        </>
      }
      right={
        <>
          <div className="ph gbar">Players: {squad.length}<small>By position</small></div>
          <div className="tblwrap scroll">
            <table className="tbl">
              <thead><tr><th>Pos</th><th>Player</th><th className="n">Age</th><th className="n sort">Overall</th><th className="n">Value</th></tr></thead>
              <tbody ref={body}>
                {squad.map((q, i) => (
                  <tr key={q.id} className={i === nav.index ? 'sel' : ''} onClick={() => nav.setIndex(i)}>
                    <td className="pos">{primaryPos(q.pos)}</td>
                    <td className="ellip">{data.names[q.id][0]}</td>
                    <td className="n">{q.age}</td>
                    <td className="n">{q.ovr}</td>
                    <td className="n">{moneyShort(q.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      }
      overlay={
        overlay === 'around' ? (
          <AroundTheLeague game={game} data={data} />
        ) : overlay === 'release' && p ? (
          <Overlay title="Release Player">
            <div className="empty" style={{ color: '#fff' }}>
              Release <b>{data.names[p.id][0]}</b> on a free transfer? You get nothing for him, but it frees a squad place.
            </div>
          </Overlay>
        ) : null
      }
    />
  );
}

/* ---------------- Step 2: offers ---------------- */

export function OffersStep({ onHub }: { onHub: () => void }) {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const offers = game.offers;
  const nav = useListNav(offers.length);
  const body = useScrollIntoView(nav.index);
  const o = offers[nav.index];
  const p = o ? game.players[o.player] : undefined;
  const [message, setMessage] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);
  const canBuy = !!o && o.status === 'open' && club.cash >= o.fee && club.squad.length < MAX_SQUAD;
  const row = o ? data.seasons[game.season][o.player] : undefined;

  const sign = () => {
    let err: string | null = null;
    act((s, d) => {
      err = buyOffer(s, d, nav.index);
    });
    setMessage(err);
  };
  const toDeadline = () => act((s, d) => nextWindowStep(s, d));

  const commands: Command[] = overlay
    ? closeCommand(() => setOverlay(false))
    : [
        { keys: ['Enter'], label: 'Sign', primary: true, disabled: !canBuy, onPress: sign },
        browse('Browse', nav.up, nav.down),
        { keys: ['Space'], label: 'Deadline Day', onPress: toDeadline },
        { keys: ['T'], label: 'Around the League', onPress: () => setOverlay(true) },
        { keys: ['Escape'], label: 'Hub', onPress: onHub },
      ];

  return (
    <Shell
      title="Transfer Offers"
      commands={commands}
      office={
        <>
          <ManagerOffice />
          <div className="sep" />
          <PlayerOffice p={p}>
            <span className="kv"><span>Current Club</span><span>{row ? data.meta.clubNames[row[6]] : 'Free agent'}</span></span>
            <span className="kv"><span>Estimated Worth</span><span>{p ? money(p.value) : ''}</span></span>
            <span className="kv"><span>Asking Price</span><b className={o && club.cash < o.fee ? 'bad' : ''}>{o ? money(o.fee) : ''}</b></span>
          </PlayerOffice>
        </>
      }
      left={
        <>
          <div className="ph gbar">Summer Window {seasonLabel(game.season).slice(0, 4)}</div>
          <div className="kvlist">
            <div><span>Deadline Day</span><b>{deadline(game.season)}</b></div>
            <div><span>Squad Spaces</span><b>{MAX_SQUAD - club.squad.length}</b></div>
            <div><span>Bids Received</span><b>{game.bids.length}</b></div>
            <button className={`act ${canBuy ? 'on focus' : ''}`} disabled={!canBuy} onClick={sign} tabIndex={-1}>Sign Selected Player</button>
            <button className="act" onClick={() => setOverlay(true)} tabIndex={-1}>Around the League</button>
            <button className="act" onClick={toDeadline} tabIndex={-1}>Go to Deadline Day</button>
          </div>
        </>
      }
      right={
        <>
          <div className="ph gbar">Players Available: {offers.filter((x) => x.status === 'open').length}</div>
          <div className="tblwrap scroll">
            <table className="tbl">
              <thead><tr><th>Pos</th><th>Player</th><th className="n">Age</th><th className="n sort">Overall</th><th className="n">Fee</th></tr></thead>
              <tbody ref={body}>
                {offers.map((x, i) => {
                  const q = game.players[x.player];
                  return (
                    <tr key={x.player} className={`${i === nav.index ? 'sel' : ''} ${x.status !== 'open' ? 'mute' : ''}`} onClick={() => nav.setIndex(i)} onDoubleClick={sign}>
                      <td className="pos">{primaryPos(q.pos)}</td>
                      <td className="ellip">{data.names[x.player][0]}</td>
                      <td className="n">{q.age}</td>
                      <td className="n">{q.ovr}</td>
                      <td className="n">{x.status === 'bought' ? <span className="tag g">SIGNED</span> : moneyShort(x.fee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="note">
            {message ?? (
              <>Rival clubs are watching these players. <b>Wait until deadline day and they may sign elsewhere.</b></>
            )}
          </div>
        </>
      }
      overlay={overlay ? <AroundTheLeague game={game} data={data} /> : null}
    />
  );
}

/* ---------------- Step 3: bids for your players ---------------- */

export function BidsStep({ onHub }: { onHub: () => void }) {
  const { data, game, act } = useGame();
  const bids = game.bids;
  const nav = useListNav(bids.length);
  const body = useScrollIntoView(nav.index);
  const b = bids[nav.index];
  const p = b ? game.players[b.player] : undefined;
  const [message, setMessage] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);
  const gone = game.offers.filter((o) => o.status === 'gone');
  const open = !!b && b.status === 'open';

  const accept = () => {
    let err: string | null = null;
    act((s, d) => {
      err = acceptIncomingBid(s, d, nav.index);
    });
    setMessage(err);
  };
  const reject = () => act((s) => rejectIncomingBid(s, nav.index));
  const close = () => act((s, d) => nextWindowStep(s, d));

  const commands: Command[] = overlay
    ? closeCommand(() => setOverlay(false))
    : [
        { keys: ['Enter'], label: 'Accept', primary: true, disabled: !open, onPress: accept },
        { keys: ['R'], label: 'Reject', disabled: !open, onPress: reject },
        browse('Browse', nav.up, nav.down),
        { keys: ['Space'], label: 'Close Window', onPress: close },
        { keys: ['T'], label: 'Around the League', onPress: () => setOverlay(true) },
        { keys: ['Escape'], label: 'Hub', onPress: onHub },
      ];

  const ratio = b && p ? b.fee / Math.max(1, p.value) : 1;
  const status = { open: '', accepted: 'SOLD', rejected: 'REJECTED', void: 'WITHDRAWN' } as const;

  return (
    <Shell
      title="Bids for Your Players"
      commands={commands}
      office={
        <>
          <ManagerOffice />
          <div className="sep" />
          <PlayerOffice p={p}>
            <span className="kv"><span>Bid From</span><span>{b?.name ?? ''}</span></span>
            <span className="kv"><span>Market Value</span><span>{p ? money(p.value) : ''}</span></span>
            <span className="kv">
              <span>Fee Offered</span>
              <b className={ratio >= 1.15 ? 'good' : ratio < 0.92 ? 'bad' : ''}>{b ? money(b.fee) : ''}</b>
            </span>
          </PlayerOffice>
        </>
      }
      left={
        <>
          <div className="ph gbar">Deadline Day · {deadline(game.season)}</div>
          <div className="kvlist">
            {gone.length === 0 ? (
              <div><span>None of your targets moved elsewhere.</span></div>
            ) : (
              gone.map((o) => (
                <div key={o.player}><span>{data.names[o.player][0]}</span><b>joined {clubOf(data, o.goneTo!).short}</b></div>
              ))
            )}
            <button className={`act ${open ? 'on focus' : ''}`} disabled={!open} onClick={accept} tabIndex={-1}>Accept Bid</button>
            <button className="act" disabled={!open} onClick={reject} tabIndex={-1}>Reject Bid</button>
            <button className="act" onClick={close} tabIndex={-1}>Close the Window</button>
          </div>
        </>
      }
      right={
        <>
          <div className="ph gbar">Bids Received: {bids.length}</div>
          <div className="tblwrap scroll">
            {bids.length === 0 ? (
              <div className="empty">Nobody has bid for your players this summer.</div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Player</th><th>Club</th><th className="n sort">Fee</th><th className="n">Value</th></tr></thead>
                <tbody ref={body}>
                  {bids.map((x, i) => {
                    const q = game.players[x.player];
                    return (
                      <tr key={i} className={`${i === nav.index ? 'sel' : ''} ${x.status !== 'open' ? 'mute' : ''}`} onClick={() => nav.setIndex(i)}>
                        <td className="ellip">{data.names[x.player][0]}</td>
                        <td>{x.name.length > 20 ? `${x.name.slice(0, 19)}…` : x.name}</td>
                        <td className="n">{x.status === 'open' ? moneyShort(x.fee) : <span className={`tag ${x.status === 'accepted' ? 'g' : 'k'}`}>{status[x.status]}</span>}</td>
                        <td className="n">{moneyShort(q.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="note">{message ?? 'Accept to sell. Bids you leave are turned down when the window closes.'}</div>
        </>
      }
      overlay={overlay ? <AroundTheLeague game={game} data={data} /> : null}
    />
  );
}
