import { useMemo, useState } from 'react';
import { career } from '../../game/career';
import { emptySlots, playDraftSeason, redraftsPerSummer, startRedraft } from '../../game/draft';
import { paperTable, seasonLabel, trophiesOf } from '../../game/game';
import { FORMATIONS } from '../../game/positions';
import { useGame } from '../../ui/context';
import { AroundTheLeague, closeCommand, HallOfFame, LeaveCareer, leaveCommands } from '../overlays';
import { Pitch, type PlateInfo } from '../Pitch';
import { browse, clubOf, type Command, Frame, ordinal, Overlay, useListNav } from '../ui';

const TROPHY = { league: 'League', fa: 'FA Cup', cl: 'Champions League' } as const;

export function Summer() {
  const { data, game, act, quit } = useGame();
  const club = game.clubs[game.user];
  const d = game.draft!;
  const slots = FORMATIONS[club.formation];
  const nav = useListNav(11);
  const [overlay, setOverlay] = useState<'confirm' | 'around' | 'hall' | 'leave' | null>(null);
  const info = clubOf(data, game.user);
  const reveal = new Map(d.reveal.map((r) => [r.player, r]));
  const empty = emptySlots(game);
  const last = game.history[game.history.length - 1];
  const score = useMemo(() => career(game).score, [game]);
  const paper = useMemo(() => paperTable(game), [game]);
  const rank = paper.findIndex((r) => r.club === game.user) + 1;
  const sel = club.xi[nav.index];
  const selName = sel >= 0 ? data.names[sel][0] : null;
  const done = (i: number) => game.season > 0 && !!d.redrafted?.includes(i);
  const can = (i: number) => !done(i) && (club.xi[i] < 0 || d.redraftsLeft > 0);

  const plates: PlateInfo[] = club.xi.map((id, i) => {
    const p = game.players[id];
    if (!p || id < 0) return { label: slots[i], state: i === nav.index ? 'now' : 'empty' };
    const r = reveal.get(id);
    return {
      rating: p.ovr, name: data.names[id][0], label: slots[i], state: i === nav.index ? 'sel' : done(i) ? 'done' : undefined,
      delta: r && game.season > 0 ? r.to - r.from : undefined, delay: 300 + i * 140,
    };
  });

  const redraft = (i: number) => act((s, dd) => void startRedraft(s, dd, i));
  /** Re-drafts a position: straight away when it is empty, after a confirmation otherwise. */
  const ask = (i: number) => {
    if (!can(i)) return;
    nav.setIndex(i);
    if (club.xi[i] < 0) redraft(i);
    else setOverlay('confirm');
  };
  const commands: Command[] =
    overlay === 'confirm'
      ? [
          { keys: ['Enter'], label: 'Gamble', primary: true, onPress: () => { setOverlay(null); redraft(nav.index); } },
          { keys: ['Escape'], label: 'Keep Him', onPress: () => setOverlay(null) },
        ]
      : overlay === 'leave'
        ? leaveCommands(quit, () => setOverlay(null))
        : overlay
          ? closeCommand(() => setOverlay(null))
          : [
              { keys: ['Space'], label: 'Play the Season', primary: true, disabled: empty.length > 0, onPress: () => act((s, dd) => void playDraftSeason(s, dd)) },
              { keys: ['Enter'], label: sel < 0 ? 'Draft' : 'Re-draft', disabled: !can(nav.index), onPress: () => ask(nav.index) },
              browse('Browse', nav.up, nav.down),
              { keys: ['T'], label: 'Transfers', onPress: () => setOverlay('around') },
              { keys: ['H'], label: 'Hall of Fame', onPress: () => setOverlay('hall') },
              { keys: ['Escape'], label: 'Leave Career', onPress: () => setOverlay('leave') },
            ];

  const finish = last ? last.table.findIndex((r) => r.club === game.user) + 1 : 0;
  const won = last ? trophiesOf(last, game.user) : [];
  const redrafts = redraftsPerSummer(game);
  const rowLabel = (i: number) => (done(i) ? 'Re-drafted' : club.xi[i] < 0 ? 'Draft' : d.redraftsLeft > 0 ? 'Re-draft' : 'None left');

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
        <Pitch formation={club.formation} plates={plates} onPick={(i) => (i === nav.index ? ask(i) : nav.setIndex(i))} />
        <div className="win">
          <div className="win-title">{game.season === 0 ? 'Your XI Is Ready' : 'Summer Reveal'}</div>
          <div className="office three" style={{ height: 128 }}>
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
            </div>
            <div className="sep" />
            <div className="col">
              <span className="cap">Re-drafts this summer</span>
              <span className="big">{game.season === 0 ? 'Next summer' : redrafts ? `${d.redraftsLeft} of ${redrafts} left` : 'None (settings)'}</span>
              <span className="kv"><span>{empty.length ? `${empty.length} empty position${empty.length > 1 ? 's' : ''}: draft a free replacement` : 'Each position once'}</span></span>
            </div>
          </div>
          <div className="panes" style={{ gridTemplateColumns: '1fr' }}>
            <div className="pane dpanel">
              <div className="ph gbar">{game.season === 0 ? 'Your XI' : 'Who grew, who faded'}<small>{selName ? `Selected: ${selName}` : 'Empty position selected'}</small></div>
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
                    {club.xi.map((id, i) => {
                      const p = game.players[id];
                      const r = reveal.get(id);
                      const delta = r && game.season > 0 ? r.to - r.from : null;
                      return (
                        <tr key={i} className={`${i === nav.index ? 'sel' : ''} ${!p ? 'gap' : ''}`} onClick={() => nav.setIndex(i)} onDoubleClick={() => ask(i)}>
                          <td className="pos">{slots[i]}</td>
                          <td className="ellip">{p ? data.names[id][0] : 'Retired – draft a replacement'}</td>
                          <td className="n">{p?.age ?? ''}</td>
                          {game.season > 0 && (
                            <td className={`n ${r?.boost === undefined ? '' : r.boost >= 0.5 ? 'up' : r.boost <= -0.5 ? 'down' : ''}`}>{r?.avg?.toFixed(2) ?? (p ? '–' : '')}</td>
                          )}
                          <td className="n">{r && game.season > 0 ? r.from : ''}</td>
                          <td className="n"><b>{p?.ovr ?? ''}</b></td>
                          <td className={`n ${delta === null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                            {delta === null ? '' : delta >= 3 ? `+${delta} GLOW UP` : delta <= -3 ? `${delta} BUST` : delta > 0 ? `+${delta}` : delta}
                          </td>
                          <td className="c">
                            {game.season > 0 || !p ? (
                              <button className="rowbtn" disabled={!can(i)} onClick={(e) => { e.stopPropagation(); ask(i); }} tabIndex={-1}>{rowLabel(i)}</button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="note">
                {empty.length
                  ? <b>Fill every position before the season.</b>
                  : game.season > 0
                    ? 'Ratings follow real history plus how each player performed for you: Form is his average match rating last season, judged against his team-mates. Re-drafting is a gamble, and the player you release is gone.'
                    : 'On paper is where your XI ranks against the rest of the league. The strongest XI usually wins, but not always.'}
              </div>
            </div>
          </div>
        </div>
      </div>
      {overlay === 'confirm' && selName && (
        <Overlay title="Re-draft This Position?">
          <div className="empty" style={{ color: '#fff' }}>
            <b>{selName}</b> leaves the club, and you pick from new {slots[nav.index]} candidates. You can't change your mind, and you can only re-draft this position once this summer.
          </div>
        </Overlay>
      )}
      {overlay === 'around' && <AroundTheLeague game={game} data={data} />}
      {overlay === 'hall' && <HallOfFame game={game} data={data} />}
      {overlay === 'leave' && <LeaveCareer />}
    </Frame>
  );
}
