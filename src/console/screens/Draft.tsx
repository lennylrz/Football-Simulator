import { useEffect, useRef, useState } from 'react';
import { chooseSlot, isBench, pickCandidate, redraftsPerSummer, XI } from '../../game/draft';
import { seasonLabel } from '../../game/game';
import { FORMATIONS } from '../../game/positions';
import { useGame } from '../../ui/context';
import { LeaveCareer, leaveCommands } from '../overlays';
import { BenchStrip, Pitch, type PlateInfo } from '../Pitch';
import { browse, clubOf, type Command, Frame, moneyShort, primaryPos } from '../ui';

const SLOT_NAMES: Record<string, string> = {
  GK: 'Goalkeeper', CB: 'Centre-back', LB: 'Left-back', RB: 'Right-back', LWB: 'Left wing-back', RWB: 'Right wing-back',
  CDM: 'Defensive midfielder', CM: 'Central midfielder', CAM: 'Attacking midfielder', LM: 'Left midfielder', RM: 'Right midfielder',
  LW: 'Left winger', RW: 'Right winger', CF: 'Centre-forward', ST: 'Striker',
};

export function Draft() {
  const { data, game, act, settings, quit } = useGame();
  const [leaving, setLeaving] = useState(false);
  const hidden = settings.hiddenRatings;
  const club = game.clubs[game.user];
  const d = game.draft!;
  const slots = FORMATIONS[club.formation];
  const bench = isBench(d.slot!);
  const slotPos = bench ? 'SUB' : slots[d.slot!];
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
  const total = XI + club.bench.length;

  // In the opening draft the positions can be filled in any order.
  const open = opening ? d.queue : [];
  const plates: PlateInfo[] = club.xi.map((id, i) => {
    const p = game.players[id];
    if (i === d.slot) return { label: slots[i], state: 'now' };
    if (!p || id < 0) return { label: slots[i], state: open.includes(i) ? 'open' : 'empty' };
    return { rating: p.ovr, name: data.names[id][0], label: slots[i] };
  });
  const subs: PlateInfo[] = club.bench.map((id, j) => {
    const p = game.players[id];
    if (XI + j === d.slot) return { label: 'SUB', state: 'now' };
    if (!p || id < 0) return { label: 'SUB', state: open.includes(XI + j) ? 'open' : 'empty' };
    return { rating: p.ovr, name: data.names[id][0], label: primaryPos(p.pos) };
  });

  const pick = (i: number) => act((s, dd) => void pickCandidate(s, dd, s.draft!.candidates[i]));
  autoPick.current = () => pick(index);
  const redrafts = redraftsPerSummer(game);
  const switchTo = (slot: number) => act((s, dd) => void chooseSlot(s, dd, slot));
  const order = open.slice().sort((a, b) => a - b);
  const cycle = (dir: 1 | -1) => {
    const at = order.indexOf(d.slot!);
    switchTo(order[(at + dir + order.length) % order.length]);
  };
  const commands: Command[] = leaving
    ? leaveCommands(quit, () => setLeaving(false))
    : [
        { keys: ['Enter'], label: 'Pick', primary: true, onPress: () => pick(index) },
        browse('Browse', () => setIndex(Math.max(0, index - 1)), () => setIndex(Math.min(d.candidates.length - 1, index + 1)), true),
        { keys: ['Q', 'E'], label: 'Position', hidden: order.length < 2, disabled: order.length < 2, onPress: (k) => cycle(k === 'Q' ? -1 : 1) },
        { keys: ['Escape'], label: 'Leave Career', onPress: () => setLeaving(true) },
      ];

  return (
    <Frame
      club={info}
      title={info.name}
      sub={opening ? `The Draft · Pick ${pickNo} of ${total}` : `Summer Re-draft · ${Math.max(0, redrafts - d.redraftsLeft)} of ${redrafts} used`}
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
      info={settings.pickTimer
        ? <><span>Time</span><b className={`timer ${left <= 5 ? 'low' : ''}`}>0:{String(left).padStart(2, '0')}</b></>
        : <><span>Choose</span><b>{bench ? 'Substitute' : SLOT_NAMES[slotPos]}</b></>}
    >
      <div className="draft">
        <div className="pitchcol">
          <Pitch formation={club.formation} plates={plates} onPick={opening ? (i) => order.includes(i) && i !== d.slot && switchTo(i) : undefined} />
          <BenchStrip plates={subs} onPick={opening ? (j) => order.includes(XI + j) && XI + j !== d.slot && switchTo(XI + j) : undefined} />
        </div>
        <div className="right win">
          <div className="win-title">{bench ? 'Choose a Substitute' : `Choose Your ${SLOT_NAMES[slotPos]}`}</div>
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
                    <span className="pos">{bench ? primaryPos(p.pos) : slotPos}</span>
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
            {bench
              ? 'Substitutes play any outfield position. They come off the bench, start now and then, and can be moved into your XI each summer.'
              : hidden
              ? 'Ratings are hidden: pick on name, age and club alone. You see his rating once he is yours.'
              : opening
                ? `Draft in any order: click a position on the pitch or press Q and E. Ratings are ${seasonLabel(0)}; who grows is down to your ball knowledge.`
                : 'Your old player has gone. Pick his replacement.'}
          </div>
        </div>
      </div>
      {leaving && <LeaveCareer />}
    </Frame>
  );
}
