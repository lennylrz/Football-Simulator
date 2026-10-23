import { useEffect, useMemo, useState } from 'react';
import { career } from '../../game/career';
import { emptySlots, inSpot, isBench, redraftsPerSummer, XI } from '../../game/draft';
import { paperTable, seasonLabel, starOf, trophiesOf } from '../../game/game';
import { FORMATIONS, parsePositions, positionFit } from '../../game/positions';
import { useGame } from '../../ui/context';
import { PlayerCard } from '../awards';
import { squadNotes } from '../../game/squadStories';
import { AroundTheLeague, closeCommand, HallOfFame, LeaveCareer, leaveCommands } from '../overlays';
import { rivalCommand, RivalOverlay, rivalStatus } from '../room';
import { STYLE_ORDER, STYLES } from '../../game/styles';
import { BenchStrip, landsAt, Pitch, type PlateInfo, Tick } from '../Pitch';
import { browse, clubOf, type Command, Frame, ordinal, Overlay, useListNav } from '../ui';

const TROPHY = { league: 'League', fa: 'FA Cup', cl: 'Champions League' } as const;

/** Summers whose new ratings have been revealed already (seed, club, season): they only tick up once. */
const revealed = new Set<string>();

export function Summer() {
  const { data, game, send, quit, room, settings } = useGame();
  const club = game.clubs[game.user];
  const style = club.style ?? 'tiki';
  const d = game.draft!;
  const slots = FORMATIONS[club.formation];
  // Spots 0-10 are the XI, 11 and up the bench, in one list.
  const spots = [...club.xi.map((_, i) => i), ...club.bench.map((_, j) => XI + j)];
  const nav = useListNav(spots.length);
  const [overlay, setOverlay] = useState<'confirm' | 'around' | 'hall' | 'leave' | 'rival' | null>(null);
  /** the spot picked first when swapping two players */
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  /** a player whose card is open */
  const [card, setCard] = useState<number | null>(null);
  // The dressing room this summer: worked out once, so swaps and re-drafts don't reshuffle it.
  const [notes] = useState(() => squadNotes(game, data, game.user).slice(0, 3));
  // One note at a time, so the squad keeps its room; they take turns, or click for the next.
  const [noteAt, setNoteAt] = useState(0);
  const [noteHeld, setNoteHeld] = useState(false);
  useEffect(() => {
    if (notes.length < 2 || noteHeld || settings.reduceMotion) return;
    const t = setInterval(() => setNoteAt((i) => (i + 1) % notes.length), 8000);
    return () => clearInterval(t);
  }, [notes.length, noteHeld, settings.reduceMotion]);
  const info = clubOf(data, game.user);
  const reveal = new Map(d.reveal.map((r) => [r.player, r]));
  // The first look at a summer: every rating ticks from last season's to the new one.
  const seen = `${game.seed}:${game.user}:${game.season}`;
  const [ticking] = useState(() => game.season > 0 && !revealed.has(seen));
  useEffect(() => {
    revealed.add(seen);
  }, [seen]);
  const tickDelay = (i: number) => 300 + i * 140;
  const empty = emptySlots(game);
  const last = game.history[game.history.length - 1];
  const score = useMemo(() => career(game).score, [game]);
  const paper = useMemo(() => paperTable(game), [game]);
  const rank = paper.findIndex((r) => r.club === game.user) + 1;
  const sel = inSpot(game, nav.index);
  const selName = sel >= 0 ? data.names[sel][0] : null;
  const done = (i: number) => game.season > 0 && !!d.redrafted?.includes(i);
  const can = (i: number) => !done(i) && (inSpot(game, i) < 0 || d.redraftsLeft > 0);
  const label = (i: number) => (isBench(i) ? 'SUB' : slots[i]);
  /** The position a player was drafted for, or his main one. */
  const homeOf = (id: number) => d.home?.[id] ?? parsePositions(game.players[id].pos)[0];
  const canSwap = (a: number, b: number) => a !== b && !(isBench(a) && isBench(b));
  // Through the Star: the manager picks the player it is all built around.
  const starStyle = style === 'star';
  const star = starStyle ? starOf(game, game.user) : undefined;
  const makeStar = (id: number) => starStyle && id >= 0 && club.xi.includes(id) && send({ t: 'star', player: id });

  const plate = (id: number, i: number): PlateInfo => {
    const p = game.players[id];
    const mark = swapFrom === i ? 'now' : i === nav.index ? 'sel' : undefined;
    if (!p || id < 0) return { label: label(i), state: i === nav.index ? 'now' : 'empty' };
    const r = reveal.get(id);
    return {
      rating: p.ovr, name: data.names[id][0], label: isBench(i) ? homeOf(id) : slots[i], state: mark ?? (id === star ? 'star' : done(i) ? 'done' : undefined),
      delta: r && game.season > 0 ? r.to - r.from : undefined, delay: ticking ? tickDelay(i) : 0, from: ticking && r ? r.from : undefined,
    };
  };
  const plates = club.xi.map((id, i) => plate(id, i));
  const subs = club.bench.map((id, j) => plate(id, XI + j));

  const redraft = (i: number) => send({ t: 'redraft', slot: i });
  /** Re-drafts a position: straight away when it is empty, after a confirmation otherwise. */
  const ask = (i: number) => {
    if (!can(i)) return;
    nav.setIndex(i);
    if (inSpot(game, i) < 0) redraft(i);
    else setOverlay('confirm');
  };
  const swapTo = (i: number) => {
    if (swapFrom === null || !canSwap(swapFrom, i)) return;
    const from = swapFrom;
    setSwapFrom(null);
    nav.setIndex(i);
    send({ t: 'swap', a: from, b: i });
  };
  // In a room both managers say they are ready, then the host plays the season.
  const ready = !!room?.full.mp?.views[game.user]?.ready;
  const rivalReady = !!room?.full.mp?.views[room.rival]?.ready;
  const seasonCommands: Command[] = !room
    ? [{ keys: ['Space'], label: 'Play the Season', primary: true, disabled: empty.length > 0, onPress: () => send({ t: 'play' }) }]
    : [
        { keys: ['Space'], label: ready ? 'Not Ready' : 'Ready', primary: !ready, disabled: empty.length > 0, onPress: () => send({ t: 'ready', on: !ready }) },
        ...(room.isHost
          ? [{ keys: ['P'], label: 'Play the Season', primary: true, hidden: !(ready && rivalReady), disabled: !(ready && rivalReady), onPress: () => send({ t: 'simulate' }) } as Command]
          : []),
      ];

  /** Clicking a spot: completes a swap, otherwise selects it (or acts on it when already selected). */
  const click = (i: number) => (swapFrom !== null ? swapTo(i) : i === nav.index ? ask(i) : nav.setIndex(i));
  const commands: Command[] =
    card !== null
      ? closeCommand(() => setCard(null))
      : swapFrom !== null
      ? [
          { keys: ['Enter'], label: 'Swap Here', primary: true, disabled: !canSwap(swapFrom, nav.index), onPress: () => swapTo(nav.index) },
          browse('Browse', nav.up, nav.down),
          { keys: ['Escape', 'S'], label: 'Cancel Swap', onPress: () => setSwapFrom(null) },
        ]
      : overlay === 'confirm'
      ? [
          { keys: ['Enter'], label: 'Gamble', primary: true, onPress: () => { setOverlay(null); redraft(nav.index); } },
          { keys: ['Escape'], label: 'Keep Him', onPress: () => setOverlay(null) },
        ]
      : overlay === 'leave'
        ? leaveCommands(quit, () => setOverlay(null))
        : overlay
          ? closeCommand(() => setOverlay(null))
          : [
              ...seasonCommands,
              // Before the first season there is nothing to re-draft, only gaps to fill.
              { keys: ['Enter'], label: sel < 0 ? 'Draft' : 'Re-draft', hidden: game.season === 0 && !can(nav.index), disabled: !can(nav.index), onPress: () => ask(nav.index) },
              { keys: ['F'], label: 'Make Star', hidden: !starStyle, disabled: !starStyle || sel < 0 || isBench(nav.index) || sel === star, onPress: () => makeStar(sel) },
              { keys: ['A'], label: 'Style', onPress: () => send({ t: 'style', style: STYLE_ORDER[(STYLE_ORDER.indexOf(style) + 1) % STYLE_ORDER.length] }) },
              { keys: ['S'], label: 'Swap', hidden: !club.bench.length, disabled: sel < 0 || empty.length > 0, onPress: () => setSwapFrom(nav.index) },
              { ...browse('Browse', nav.up, nav.down), hidden: true },
              { keys: ['T'], label: 'Transfers', onPress: () => setOverlay('around') },
              { keys: ['H'], label: 'Hall of Fame', onPress: () => setOverlay('hall') },
              ...rivalCommand(room, () => setOverlay('rival')),
              { keys: ['Escape'], label: room ? 'Leave Room' : 'Leave Career', onPress: () => setOverlay('leave') },
            ];

  const finish = last ? last.table.findIndex((r) => r.club === game.user) + 1 : 0;
  const won = last ? trophiesOf(last, game.user) : [];
  const redrafts = redraftsPerSummer(game);
  const rowLabel = (i: number) => (done(i) ? 'Re-drafted' : inSpot(game, i) < 0 ? 'Draft' : d.redraftsLeft > 0 ? 'Re-draft' : 'None left');

  return (
    <Frame
      club={info}
      title={info.name}
      sub={game.season === 0 ? 'Your XI' : `Summer ${seasonLabel(game.season).slice(0, 4)}`}
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
      info={<><span>Legacy</span><b>{score.toLocaleString('en-GB')}</b></>}
    >
      <div className="summer">
        <div className="pitchcol">
          <Pitch formation={club.formation} plates={plates} onPick={click} />
          <BenchStrip plates={subs} onPick={(j) => click(XI + j)} />
        </div>
        <div className="win">
          <div className="win-title">{game.season === 0 ? 'Your XI Is Ready' : 'Summer Reveal'}</div>
          <div className="office three">
            <div className="col">
              <span className="cap">{last ? `Last season · ${seasonLabel(last.season)}` : 'Season one'}</span>
              <span className="big">{last ? `${ordinal(finish)} · ${last.table[finish - 1].pts} pts` : 'Ready to play'}</span>
              <span className="kv"><span>{last ? (won.length === 3 ? 'THE TREBLE' : won.map((t) => TROPHY[t]).join(' · ') || 'No trophies') : 'The Treble awaits'}</span></span>
            </div>
            <div className="sep" />
            <div className="col">
              <span className="cap">On paper</span>
              <span className="big">{empty.length ? 'XI incomplete' : `${ordinal(rank)} of ${paper.length}`}</span>
              <span className="kv"><span>XI rating {paper[rank - 1]?.rating.toFixed(1)} · best {paper[0].rating.toFixed(1)}</span></span>
              <span className="kv" title={STYLES[style].desc}><span>Style</span><b>{STYLES[style].name}</b></span>
            </div>
            <div className="sep" />
            <div className="col">
              <span className="cap">Re-drafts this summer</span>
              <span className="big">{game.season === 0 ? 'Next summer' : redrafts ? `${d.redraftsLeft} of ${redrafts} left` : 'None (settings)'}</span>
              <span className="kv"><span>{empty.length ? `${empty.length} empty position${empty.length > 1 ? 's' : ''} to fill` : 'Each position once'}</span></span>
            </div>
          </div>
          <div className="panes" style={{ gridTemplateColumns: '1fr' }}>
            <div className="pane dpanel">
              <div className="ph gbar">
                {swapFrom !== null ? `Swap ${data.names[inSpot(game, swapFrom)][0]} with…` : game.season === 0 ? 'Your Squad' : 'Who grew, who faded'}
                <small>{swapFrom !== null ? 'Click a player, or Enter on the selected one' : selName ? `Selected: ${selName}` : 'Empty position selected'}</small>
              </div>
              <div className="tblwrap scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Slot</th><th>Player</th><th className="n">Age</th>
                      {game.season > 0 && <th className="n" title="Average match rating last season">Form</th>}
                      <th className="n">Last Year</th><th className="n sort">Now</th><th className="n">Change</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {spots.map((i) => {
                      const id = inSpot(game, i);
                      const p = game.players[id];
                      const r = reveal.get(id);
                      const delta = r && game.season > 0 ? r.to - r.from : null;
                      // Out of position: a player moved to a spot he wasn't drafted for.
                      const off = p && !isBench(i) && positionFit([homeOf(id)], slots[i]) < 1 ? homeOf(id) : null;
                      return (
                        <tr
                          key={i}
                          className={`${i === nav.index ? 'sel' : ''} ${!p ? 'gap' : ''} ${i === XI ? 'div' : ''} ${swapFrom === i ? 'from' : ''}`}
                          onClick={() => (swapFrom !== null ? swapTo(i) : nav.setIndex(i))}
                          onDoubleClick={() => swapFrom === null && ask(i)}
                        >
                          <td className="pos">{label(i)}{isBench(i) && p ? <small> {homeOf(id)}</small> : null}</td>
                          <td className="ellip">
                            {p ? <span className="plink" title="Open his card" onClick={(e) => { e.stopPropagation(); setCard(id); }}>{data.names[id][0]}</span> : 'Retired'}
                            {p && id === star && <span className="startag" title="The star">★</span>}
                            {off && <span className="offpos" title={`Drafted as ${off}: plays below his rating here`}> {off} out of position</span>}
                          </td>
                          <td className="n">{p?.age ?? ''}</td>
                          {game.season > 0 && (
                            <td className={`n ${r?.boost === undefined ? '' : r.boost >= 0.5 ? 'up' : r.boost <= -0.5 ? 'down' : ''}`}>{r?.avg?.toFixed(2) ?? (p ? '–' : '')}</td>
                          )}
                          <td className="n">{r && game.season > 0 ? r.from : ''}</td>
                          <td className="n"><b>{p ? <Tick key={id} from={ticking && r ? r.from : undefined} to={p.ovr} delay={tickDelay(i)} /> : ''}</b></td>
                          <td className={`n ${delta === null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                            {delta !== null && (
                              <span className={ticking ? 'lands' : ''} style={{ '--land': `${p ? landsAt(ticking && r ? r.from : undefined, p.ovr, tickDelay(i)) : 0}ms` } as React.CSSProperties}>
                                {delta >= 3 ? `+${delta} GLOW UP` : delta <= -3 ? `${delta} BUST` : delta > 0 ? `+${delta}` : delta}
                              </span>
                            )}
                          </td>
                          <td className="c acts">
                            {starStyle && p && !isBench(i) && id !== star && swapFrom === null && (
                              <button className="rowbtn" title="Build the team around him" onClick={(e) => { e.stopPropagation(); makeStar(id); }} tabIndex={-1}>★</button>
                            )}
                            {p && club.bench.length > 0 && swapFrom === null && (
                              <button className="rowbtn" disabled={empty.length > 0} onClick={(e) => { e.stopPropagation(); nav.setIndex(i); setSwapFrom(i); }} tabIndex={-1}>Swap</button>
                            )}
                            {(game.season > 0 || !p) && swapFrom === null ? (
                              <button className="rowbtn" disabled={!can(i)} onClick={(e) => { e.stopPropagation(); ask(i); }} tabIndex={-1}>{rowLabel(i)}</button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!room && !empty.length && notes.length > 0 && (
                <div
                  className={`sq-notes ${notes.length > 1 ? 'click' : ''}`}
                  onClick={() => setNoteAt((i) => (i + 1) % notes.length)}
                  onMouseEnter={() => setNoteHeld(true)}
                  onMouseLeave={() => setNoteHeld(false)}
                >
                  <span className="cap">Dressing room</span>
                  <p key={noteAt}>{notes[noteAt % notes.length].text}</p>
                  {notes.length > 1 && <span className="dots">{notes.map((n, k) => <i key={n.text} className={k === noteAt % notes.length ? 'on' : ''} />)}</span>}
                </div>
              )}
              {(room || empty.length > 0) && (
                <div className="note">
                  {room && !empty.length
                    ? <b>{ready ? (rivalReady ? (room.isHost ? 'Both ready: press P to play the season.' : 'Both ready: waiting for the host to play the season.') : `You're ready. Rival: ${rivalStatus(room)}.`) : 'Press Space when your XI is set. Changing anything takes back your ready.'}</b>
                    : <b>Fill every position before the season.</b>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {overlay === 'confirm' && selName && (
        <Overlay title="Re-draft This Position?">
          <div className="empty" style={{ color: '#fff' }}>
            <b>{selName}</b> leaves the club, and you pick from new {isBench(nav.index) ? 'substitute' : slots[nav.index]} candidates. You can't change your mind, and you can only re-draft this position once this summer.
          </div>
        </Overlay>
      )}
      {overlay === 'around' && <AroundTheLeague game={game} data={data} />}
      {overlay === 'hall' && <HallOfFame game={game} data={data} />}
      {overlay === 'leave' && <LeaveCareer />}
      {card !== null && <PlayerCard game={game} data={data} id={card} onClose={() => setCard(null)} />}
      {overlay === 'rival' && room && <RivalOverlay room={room} data={data} me={game.user} />}
    </Frame>
  );
}
