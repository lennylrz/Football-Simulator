import { useMemo, useState } from 'react';
import { career } from '../../game/career';
import { emptySlots, playDraftSeason, startRedraft } from '../../game/draft';
import { seasonLabel, trophiesOf } from '../../game/game';
import { FORMATIONS } from '../../game/positions';
import { useGame } from '../../ui/context';
import { AroundTheLeague, closeCommand, HallOfFame } from '../overlays';
import { Pitch, type PlateInfo } from '../Pitch';
import { browse, clubOf, type Command, Frame, ordinal, Overlay, useListNav } from '../ui';

const TROPHY = { league: 'League', fa: 'FA Cup', cl: 'Champions League' } as const;

export function Summer({ onMenu }: { onMenu: () => void }) {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const d = game.draft!;
  const slots = FORMATIONS[club.formation];
  const nav = useListNav(11);
  const [overlay, setOverlay] = useState<'confirm' | 'around' | 'hall' | null>(null);
  const info = clubOf(data, game.user);
  const reveal = new Map(d.reveal.map((r) => [r.player, r]));
  const empty = emptySlots(game);
  const last = game.history[game.history.length - 1];
  const score = useMemo(() => career(game).score, [game]);
  const sel = club.xi[nav.index];
  const selName = sel >= 0 ? data.names[sel][0] : null;
  const canRedraft = sel < 0 || d.redraftsLeft > 0;

  const plates: PlateInfo[] = club.xi.map((id, i) => {
    const p = game.players[id];
    if (!p || id < 0) return { label: slots[i], state: i === nav.index ? 'now' : 'empty' };
    const r = reveal.get(id);
    return {
      rating: p.ovr, name: data.names[id][0], label: slots[i], state: i === nav.index ? 'sel' : undefined,
      delta: r && game.season > 0 ? r.to - r.from : undefined, delay: 300 + i * 140,
    };
  });

  const redraft = () => act((s, dd) => void startRedraft(s, dd, nav.index));
  const commands: Command[] =
    overlay === 'confirm'
      ? [
          { keys: ['Enter'], label: 'Gamble', primary: true, onPress: () => { setOverlay(null); redraft(); } },
          { keys: ['Escape'], label: 'Keep Him', onPress: () => setOverlay(null) },
        ]
      : overlay
        ? closeCommand(() => setOverlay(null))
        : [
            { keys: ['Space'], label: 'Play the Season', primary: true, disabled: empty.length > 0, onPress: () => act((s, dd) => void playDraftSeason(s, dd)) },
            { keys: ['Enter'], label: sel < 0 ? 'Draft' : 'Re-draft', disabled: !canRedraft, onPress: () => (sel < 0 ? redraft() : setOverlay('confirm')) },
            browse('Browse', nav.up, nav.down),
            { keys: ['T'], label: 'Transfers', onPress: () => setOverlay('around') },
            { keys: ['H'], label: 'Hall of Fame', onPress: () => setOverlay('hall') },
            { keys: ['Escape'], label: 'Menu', onPress: onMenu },
          ];

  const finish = last ? last.table.findIndex((r) => r.club === game.user) + 1 : 0;
  const won = last ? trophiesOf(last, game.user) : [];

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
        <Pitch formation={club.formation} plates={plates} onPick={(i) => nav.setIndex(i)} />
        <div className="win">
          <div className="win-title">{game.season === 0 ? 'Your XI Is Ready' : 'Summer Reveal'}</div>
          <div className="office" style={{ height: 128 }}>
            <div className="col">
              <span className="cap">{last ? `Last season · ${seasonLabel(last.season)}` : 'Season one'}</span>
              <span className="big">{last ? `${ordinal(finish)} · ${last.table[finish - 1].pts} pts` : 'Ready to play'}</span>
              <span className="kv"><span>{last ? (won.length === 3 ? 'THE TREBLE' : won.map((t) => TROPHY[t]).join(' · ') || 'No trophies') : 'The Treble awaits'}</span></span>
            </div>
            <div className="sep" />
            <div className="col">
              <span className="cap">Re-drafts this summer</span>
              <span className="big">{game.season === 0 ? 'From next summer' : `${d.redraftsLeft} of 3 left`}</span>
              <span className="kv"><span>{empty.length ? `${empty.length} empty position${empty.length > 1 ? 's' : ''}: draft a free replacement` : 'Release a player and pick from 5 new ones'}</span></span>
            </div>
          </div>
          <div className="panes" style={{ gridTemplateColumns: '1fr' }}>
            <div className="pane dpanel">
              <div className="ph gbar">{game.season === 0 ? 'Your XI' : 'Who grew, who faded'}<small>{selName ? `Selected: ${selName}` : 'Empty position selected'}</small></div>
              <div className="tblwrap scroll">
                <table className="tbl">
                  <thead><tr><th>Slot</th><th>Player</th><th className="n">Age</th><th className="n">Last Year</th><th className="n sort">Now</th><th className="n">Change</th></tr></thead>
                  <tbody>
                    {club.xi.map((id, i) => {
                      const p = game.players[id];
                      const r = reveal.get(id);
                      const delta = r && game.season > 0 ? r.to - r.from : null;
                      return (
                        <tr key={i} className={`${i === nav.index ? 'sel' : ''} ${!p ? 'gap' : ''}`} onClick={() => nav.setIndex(i)} onDoubleClick={() => canRedraft && (id < 0 ? redraft() : setOverlay('confirm'))}>
                          <td className="pos">{slots[i]}</td>
                          <td className="ellip">{p ? data.names[id][0] : 'Retired – draft a replacement'}</td>
                          <td className="n">{p?.age ?? ''}</td>
                          <td className="n">{r && game.season > 0 ? r.from : ''}</td>
                          <td className="n"><b>{p?.ovr ?? ''}</b></td>
                          <td className={`n ${delta === null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                            {delta === null ? '' : delta >= 3 ? `+${delta} GLOW UP` : delta <= -3 ? `${delta} BUST` : delta > 0 ? `+${delta}` : delta}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="note">{empty.length ? <b>Fill every position before the season.</b> : 'Re-drafting is a gamble: the five new candidates are random, and the player you release is gone.'}</div>
            </div>
          </div>
        </div>
      </div>
      {overlay === 'confirm' && selName && (
        <Overlay title="Re-draft This Position?">
          <div className="empty" style={{ color: '#fff' }}>
            <b>{selName}</b> leaves the club, and you pick from five new {slots[nav.index]} candidates. You can't change your mind.
          </div>
        </Overlay>
      )}
      {overlay === 'around' && <AroundTheLeague game={game} data={data} />}
      {overlay === 'hall' && <HallOfFame game={game} data={data} />}
    </Frame>
  );
}
