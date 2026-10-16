import { useEffect, useRef, useState } from 'react';
import { pickCandidate, redraftsPerSummer } from '../../game/draft';
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
  const { data, game, act, settings } = useGame();
  const hidden = settings.hiddenRatings;
  const club = game.clubs[game.user];
  const d = game.draft!;
  const slots = FORMATIONS[club.formation];
  const slotPos = slots[d.slot!];
  const [index, setIndex] = useState(0);
  const key = `${game.season}-${d.slot}-${d.picks.length}`;
  useEffect(() => setIndex(0), [key]);

  // Pick timer: when it runs out, the highlighted player is picked.
  const [left, setLeft] = useState(settings.pickTimer);
  const autoPick = useRef(() => {});
  useEffect(() => {
    if (!settings.pickTimer) return;
    setLeft(settings.pickTimer);
    const started = Date.now();
    const t = setInterval(() => {
      const remaining = settings.pickTimer - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(t);
        autoPick.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, [key, settings.pickTimer]);
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
  autoPick.current = () => pick(index);
  const redrafts = redraftsPerSummer(game);
  const commands: Command[] = [
    { keys: ['Enter'], label: 'Pick', primary: true, onPress: () => pick(index) },
    browse('Browse', () => setIndex(Math.max(0, index - 1)), () => setIndex(Math.min(d.candidates.length - 1, index + 1)), true),
    { keys: ['Escape'], label: 'Main Menu', onPress: onMenu },
  ];

  return (
    <Frame
      club={info}
      title={info.name}
      sub={opening ? `The Draft · Pick ${pickNo} of 11` : `Summer Re-draft · ${Math.max(0, redrafts - d.redraftsLeft)} of ${redrafts} used`}
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
      info={settings.pickTimer
        ? <><span>Time</span><b className={`timer ${left <= 5 ? 'low' : ''}`}>0:{String(left).padStart(2, '0')}</b></>
        : <><span>Choose</span><b>{SLOT_NAMES[slotPos]}</b></>}
    >
      <div className="draft">
        <Pitch formation={club.formation} plates={plates} />
        <div className="right win">
          <div className="win-title">Choose Your {SLOT_NAMES[slotPos]}</div>
          {settings.pickTimer > 0 && <div className="pick-timer"><i style={{ width: `${(left / settings.pickTimer) * 100}%` }} /></div>}
          <div className="cards5" key={key} style={{ gridTemplateColumns: `repeat(${d.candidates.length}, 1fr)` }}>
            {d.candidates.map((id, i) => {
              const p = game.players[id];
              const row = data.seasons[game.season][id];
              return (
                <button
                  key={id}
                  className={`ccard ${i === index ? 'on' : ''} ${hidden ? 'hid' : ''}`}
                  style={{ '--d': `${i * 110}ms` } as React.CSSProperties}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => pick(i)}
                  tabIndex={-1}
                >
                  <div className="top">
                    <span className="r">{hidden ? '?' : p.ovr}</span>
                    <span className="pos">{slotPos}</span>
                  </div>
                  <div className="band"><b>{data.names[id][0]}</b></div>
                  <div className="meta">
                    <div className="line"><b>{p.age}</b> years old</div>
                    <div className="line">{data.names[id][1]}</div>
                    <div className="line club">{p.club >= 0 ? clubOf(data, p.club).name : row ? data.meta.clubNames[row[6]] : 'Free agent'}</div>
                    {hidden ? <div className="line">Rating <b>hidden</b></div> : <div className="line">Value <b>{moneyShort(p.value)}</b></div>}
                  </div>
                  <span className="tagline">{p.age <= 21 ? 'One for the future?' : p.age >= 31 ? 'Veteran' : !hidden && p.ovr >= 84 ? 'World class' : 'In his prime'}</span>
                </button>
              );
            })}
          </div>
          <div className="note">
            {hidden
              ? 'Ratings are hidden: pick on name, age and club alone. You see his rating once he is yours.'
              : opening ? 'Ratings are 2015/16. Nobody tells you who will grow: that is down to your ball knowledge.' : 'Your old player has gone. Pick his replacement.'}
          </div>
        </div>
      </div>
    </Frame>
  );
}
