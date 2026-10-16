import { useEffect, useState } from 'react';
import { REDRAFTS_PER_SUMMER } from '../../game/draft';
import { pickCandidate } from '../../game/draft';
import { seasonLabel } from '../../game/game';
import { FORMATIONS } from '../../game/positions';
import { useGame } from '../../ui/context';
import { Pitch, type PlateInfo } from '../Pitch';
import { browse, clubOf, type Command, Frame, moneyShort } from '../ui';

const SLOT_NAMES: Record<string, string> = {
  GK: 'Goalkeeper', CB: 'Centre-back', LB: 'Left-back', RB: 'Right-back', LWB: 'Left wing-back', RWB: 'Right wing-back',
  CDM: 'Defensive midfielder', CM: 'Central midfielder', CAM: 'Attacking midfielder', LM: 'Left midfielder', RM: 'Right midfielder',
  LW: 'Left winger', RW: 'Right winger', CF: 'Centre-forward', ST: 'Striker',
};

export function Draft({ onMenu }: { onMenu: () => void }) {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const d = game.draft!;
  const slots = FORMATIONS[club.formation];
  const slotPos = slots[d.slot!];
  const [index, setIndex] = useState(0);
  const key = `${game.season}-${d.slot}-${d.picks.length}`;
  useEffect(() => setIndex(0), [key]);
  const info = clubOf(data, game.user);
  const opening = game.stage === 'draft';
  const pickNo = d.picks.filter((p) => p.season === game.season).length + 1;

  const plates: PlateInfo[] = club.xi.map((id, i) => {
    const p = game.players[id];
    if (i === d.slot) return { label: slots[i], state: 'now' };
    if (!p || id < 0) return { label: slots[i], state: 'empty' };
    return { rating: p.ovr, name: data.names[id][0], label: slots[i] };
  });

  const pick = (i: number) => act((s, dd) => void pickCandidate(s, dd, s.draft!.candidates[i]));
  const commands: Command[] = [
    { keys: ['Enter'], label: 'Pick', primary: true, onPress: () => pick(index) },
    browse('Browse', () => setIndex(Math.max(0, index - 1)), () => setIndex(Math.min(d.candidates.length - 1, index + 1)), true),
    { keys: ['Escape'], label: 'Main Menu', onPress: onMenu },
  ];

  return (
    <Frame
      club={info}
      title={info.name}
      sub={opening ? `The Draft · Pick ${pickNo} of 11` : `Summer Re-draft · ${REDRAFTS_PER_SUMMER - d.redraftsLeft} of ${REDRAFTS_PER_SUMMER} used`}
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
      info={<><span>Choose</span><b>{SLOT_NAMES[slotPos]}</b></>}
    >
      <div className="draft">
        <Pitch formation={club.formation} plates={plates} />
        <div className="right win">
          <div className="win-title">Choose Your {SLOT_NAMES[slotPos]}</div>
          <div className="cards5" key={key}>
            {d.candidates.map((id, i) => {
              const p = game.players[id];
              const row = data.seasons[game.season][id];
              return (
                <button
                  key={id}
                  className={`ccard ${i === index ? 'on' : ''}`}
                  style={{ '--d': `${i * 110}ms` } as React.CSSProperties}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => pick(i)}
                  tabIndex={-1}
                >
                  <div className="top">
                    <span className="r">{p.ovr}</span>
                    <span className="pos">{slotPos}</span>
                  </div>
                  <div className="band"><b>{data.names[id][0]}</b></div>
                  <div className="meta">
                    <div className="line"><b>{p.age}</b> years old</div>
                    <div className="line">{data.names[id][1]}</div>
                    <div className="line club">{p.club >= 0 ? clubOf(data, p.club).name : row ? data.meta.clubNames[row[6]] : 'Free agent'}</div>
                    <div className="line">Value <b>{moneyShort(p.value)}</b></div>
                  </div>
                  <span className="tagline">{p.age <= 21 ? 'One for the future?' : p.age >= 31 ? 'Veteran' : p.ovr >= 84 ? 'World class' : 'In his prime'}</span>
                </button>
              );
            })}
          </div>
          <div className="note">
            {opening ? 'Ratings are 2015/16. Nobody tells you who will grow: that is down to your ball knowledge.' : 'Your old player has gone. Pick his replacement.'}
          </div>
        </div>
      </div>
    </Frame>
  );
}
