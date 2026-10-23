import { type ReactNode, useEffect, useRef, useState } from 'react';
import { isBench, redraftsPerSummer, XI } from '../../game/draft';
import { seasonLabel } from '../../game/game';
import { challengeOf, ruleLine } from '../../game/daily';
import { FORMATIONS } from '../../game/positions';
import { playerBlurb } from '../../game/blurbs';
import type { GameData } from '../../game/data';
import type { GameState } from '../../game/game';
import { useGame } from '../../ui/context';
import { closeCommand, LeaveCareer, leaveCommands } from '../overlays';
import { rivalCommand, RivalOverlay } from '../room';
import { BenchStrip, Pitch, type PlateInfo } from '../Pitch';
import { browse, clubOf, type Command, Frame, moneyShort, primaryPos, useTheme } from '../ui';

const SLOT_NAMES: Record<string, string> = {
  GK: 'Goalkeeper', CB: 'Centre-back', LB: 'Left-back', RB: 'Right-back', LWB: 'Left wing-back', RWB: 'Right wing-back',
  CDM: 'Defensive midfielder', CM: 'Central midfielder', CAM: 'Attacking midfielder', LM: 'Left midfielder', RM: 'Right midfielder',
  LW: 'Left winger', RW: 'Right winger', CF: 'Centre-forward', ST: 'Striker',
};

export function Draft() {
  const { data, game, send, settings, quit, room } = useGame();
  const [leaving, setLeaving] = useState(false);
  const [rival, setRival] = useState(false);
  const hidden = settings.hiddenRatings;
  // A Daily Challenge's rule stays in view while drafting.
  const challenge = challengeOf(game.daily?.challenge);
  const rule = challenge ? `Daily #${game.daily!.day} · ${ruleLine(challenge)}` : null;
  const theme = useTheme();
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
  // The opening draft starts on an empty pitch: the manager picks where to begin.
  const [started, setStarted] = useState(false);
  const choosing = opening && pickNo === 1 && !started && !room;
  const total = XI + club.bench.length;

  // In the opening draft the positions can be filled in any order.
  const open = opening ? d.queue : [];
  const plates: PlateInfo[] = club.xi.map((id, i) => {
    const p = game.players[id];
    if (i === d.slot && !choosing) return { label: slots[i], state: 'now' };
    if (!p || id < 0) return { label: slots[i], state: open.includes(i) ? 'open' : 'empty' };
    return { rating: p.ovr, name: data.names[id][0], label: slots[i] };
  });
  const subs: PlateInfo[] = club.bench.map((id, j) => {
    const p = game.players[id];
    if (XI + j === d.slot && !choosing) return { label: 'SUB', state: 'now' };
    if (!p || id < 0) return { label: 'SUB', state: open.includes(XI + j) ? 'open' : 'empty' };
    return { rating: p.ovr, name: data.names[id][0], label: primaryPos(p.pos) };
  });

  const pick = (i: number) => !choosing && d.candidates[i] !== undefined && send({ t: 'pick', player: d.candidates[i] });
  autoPick.current = () => pick(index);
  const redrafts = redraftsPerSummer(game);
  const switchTo = (slot: number) => {
    setStarted(true);
    if (slot !== d.slot) send({ t: 'slot', slot });
  };
  const order = open.slice().sort((a, b) => a - b);
  const cycle = (dir: 1 | -1) => {
    const at = order.indexOf(d.slot!);
    switchTo(order[(at + dir + order.length) % order.length]);
  };
  const commands: Command[] = leaving
    ? leaveCommands(quit, () => setLeaving(false))
    : rival
    ? closeCommand(() => setRival(false))
    : choosing
    ? [
        { keys: ['Enter'], label: `Start with ${SLOT_NAMES[slotPos] ?? 'the suggested position'}`, primary: true, onPress: () => setStarted(true) },
        { keys: ['Escape'], label: 'Leave Career', onPress: () => setLeaving(true) },
      ]
    : [
        { keys: ['Enter'], label: 'Pick', primary: true, onPress: () => pick(index) },
        browse('Browse', () => setIndex(Math.max(0, index - 1)), () => setIndex(Math.min(d.candidates.length - 1, index + 1)), true),
        { keys: ['Q', 'E'], label: 'Position', hidden: order.length < 2, disabled: order.length < 2, onPress: (k) => cycle(k === 'Q' ? -1 : 1) },
        ...rivalCommand(room, () => setRival(true)),
        { keys: ['Escape'], label: room ? 'Leave Room' : 'Leave Career', onPress: () => setLeaving(true) },
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
      {theme === 'sl' ? (
        <div className="sl-draft">
          <div className="pitchcol">
            <Pitch formation={club.formation} plates={plates} onPick={opening ? (i) => order.includes(i) && switchTo(i) : undefined} />
            <BenchStrip plates={subs} onPick={opening ? (j) => order.includes(XI + j) && switchTo(XI + j) : undefined} />
          </div>
          {choosing ? (
            <div className="sl-panel"><ChooseFirst /></div>
          ) : (
            <SlHub
              key={key}
              ids={d.candidates}
              index={index}
              setIndex={setIndex}
              onPick={pick}
              hidden={hidden}
              title={bench ? 'Choose a substitute' : `Choose your ${SLOT_NAMES[slotPos].toLowerCase()}`}
              timer={settings.pickTimer > 0 ? left / settings.pickTimer : undefined}
              note={rule ? <b className="rule">{rule}</b> : (bench
                ? 'Substitutes cover any outfield position.'
                : hidden
                ? 'Ratings hidden: pick on name, age and club alone.'
                : opening
                  ? 'Click any position on the pitch to draft it next.'
                  : 'Your old player has gone. Pick his replacement.')}
            />
          )}
        </div>
      ) : (
        <div className="draft">
          <div className="pitchcol">
            <Pitch formation={club.formation} plates={plates} onPick={opening ? (i) => order.includes(i) && switchTo(i) : undefined} />
            <BenchStrip plates={subs} onPick={opening ? (j) => order.includes(XI + j) && switchTo(XI + j) : undefined} />
          </div>
          <div className="right win">
            <div className="win-title">{bench ? 'Choose a Substitute' : `Choose Your ${SLOT_NAMES[slotPos]}`}</div>
            {settings.pickTimer > 0 && <div className="pick-timer"><i style={{ width: `${(left / settings.pickTimer) * 100}%` }} /></div>}
            {choosing ? <ChooseFirst /> : (
              <>
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
                <div className={`note ${rule ? 'rule' : ''}`}>
                  {rule ?? (bench
                    ? 'Substitutes cover any outfield position.'
                    : hidden
                    ? 'Ratings hidden: pick on name, age and club.'
                    : opening
                      ? 'Click any position on the pitch to draft it next.'
                      : 'Your old player has gone. Pick his replacement.')}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {leaving && <LeaveCareer />}
      {rival && room && <RivalOverlay room={room} data={data} me={game.user} />}
    </Frame>
  );
}

/** "E. Cavani" -> ["E.", "Cavani"]; "Paco Alcácer" -> ["Paco", "Alcácer"]; "Neymar" -> ["", "Neymar"]. */
function splitName(name: string): [string, string] {
  const k = name.indexOf(' ');
  return k < 0 ? ['', name] : [name.slice(0, k), name.slice(k + 1)];
}

function ChooseFirst() {
  return (
    <div className="sl-choose empty">
      <div>
        <h3>Where do you start?</h3>
        <p>Click any position on the pitch to draft it first, or press Enter to start up front. After each pick you can jump to any open position.</p>
      </div>
    </div>
  );
}

const tier = (r: number) => (r >= 85 ? 'r-a' : r >= 80 ? 'r-b' : r >= 74 ? 'r-c' : 'r-d');

/** The 2015-2020 draft: the five as a transfer-hub list, the highlighted one in an overview with a scout's note. */
function SlHub({ ids, index, setIndex, onPick, hidden, title, timer, note }: {
  ids: number[]; index: number; setIndex: (i: number) => void; onPick: (i: number) => void; hidden: boolean;
  title: string; timer?: number; note: ReactNode;
}) {
  const { data, game } = useGame();
  const id = ids[index];
  const p = game.players[id];
  if (!p) return null;
  const row = data.seasons[game.season][id];
  const clubOfPlayer = (pid: number): { name: string } => {
    const q = game.players[pid];
    if (q.club >= 0) return { name: clubOf(data, q.club).short };
    const r = data.seasons[game.season][pid];
    return { name: r ? data.meta.clubNames[r[6]] : 'Free agent' };
  };
  const [first, last] = splitName(data.names[id][0]);
  const blurb = draftBlurb(data, game, id, hidden);
  const club = clubOfPlayer(id);
  const pos = primaryPos(row?.[5] ?? p.pos);
  return (
    <div className="sl-hub">
      <div className="sl-panel">
        <div className="sl-cap">{title}<b>· pick one</b><small>{ids.length} on the table</small></div>
        {timer !== undefined && <div className="pick-timer"><i style={{ width: `${timer * 100}%` }} /></div>}
        <div className="sl-th"><span>PLAYER</span><span>AGE</span><span>OVR</span></div>
        {ids.map((cid, i) => {
          const c = game.players[cid];
          const cc = clubOfPlayer(cid);
          return (
            <button key={cid} className={`sl-row ${i === index ? 'on' : ''}`} style={{ '--d': `${i * 60}ms` } as React.CSSProperties}
              onClick={() => (i === index ? onPick(i) : setIndex(i))} onMouseEnter={() => setIndex(i)} tabIndex={-1}>
              <span className="who">
                <span className="nm"><b>{data.names[cid][0]}</b><small>{cc.name} · {data.names[cid][1]}</small></span>
              </span>
              <span className="age">{c.age}</span>
              <span className={`ovr ${hidden ? '' : tier(c.ovr)}`}>{hidden ? '?' : c.ovr}</span>
            </button>
          );
        })}
        <div className="sl-note">{note}</div>
      </div>
      <div className="sl-panel">
        <div className="sl-cap">Overview</div>
        <div className="sl-ov" key={id}>
          <div className="top">
            <div>
              <div className="first">{first || ' '}</div>
              <div className="last">{last}</div>
              <div className="club">{club.name} · {pos} · {p.age}</div>
            </div>
            <div className="ovr"><small>OVR</small><b className={hidden ? '' : tier(p.ovr)}>{hidden ? '?' : p.ovr}</b></div>
          </div>
          <div className="grid">
            <span>NATION<b>{data.names[id][1]}</b></span>
            <span>VALUE<b>{hidden ? '—' : moneyShort(p.value)}</b></span>
            <span>PLAYS<b>{(row?.[5] ?? p.pos).split(',').slice(0, 3).join(' · ')}</b></span>
          </div>
          <div className="kick">{blurb.kicker}</div>
          <p className="text">{blurb.text}</p>
          <div className="acts">
            <button className="sl-btn go" onClick={() => onPick(index)} tabIndex={-1}>Sign {last}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The scouting paragraph: hand-written for the era's stars, built from archetypes for everyone else. */
function draftBlurb(data: GameData, game: GameState, id: number, hidden: boolean): { kicker: string; text: string } {
  const p = game.players[id];
  const row = data.seasons[game.season][id];
  const club = p.club >= 0 ? clubOf(data, p.club).name : row ? data.meta.clubNames[row[6]] : undefined;
  return playerBlurb({
    id, era: data.era, name: data.names[id][0], nation: data.names[id][1], pos: p.pos, age: p.age, ovr: p.ovr, pot: p.pot,
    value: p.value, club, hidden, seed: game.seed,
  });
}
