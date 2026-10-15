import { useMemo, useState } from 'react';
import { applyAutoLineup, lineupProblems, seasonLabel, setFormation, simulate, swapLineup } from '../../game/game';
import { teamStrength } from '../../game/lineup';
import { FORMATION_NAMES, FORMATIONS, type Formation, type Position, parsePositions, positionFit } from '../../game/positions';
import { useGame } from '../../ui/context';
import '../team.css';
import { browse, clubOf, type Command, Frame, KeyCap, money, primaryPos, useListNav, useScrollIntoView } from '../ui';

const ROW_Y: Record<Position, number> = {
  GK: 90, CB: 74, LB: 69, RB: 69, LWB: 57, RWB: 57, CDM: 59, CM: 46, LM: 42, RM: 42, CAM: 32, LW: 20, RW: 20, CF: 17, ST: 11,
};

function coords(f: Formation): { x: number; y: number }[] {
  const slots = FORMATIONS[f];
  const rows = new Map<number, number[]>();
  slots.forEach((s, i) => rows.set(ROW_Y[s], [...(rows.get(ROW_Y[s]) ?? []), i]));
  const out: { x: number; y: number }[] = [];
  for (const [y, idx] of rows) idx.forEach((slot, k) => (out[slot] = { x: ((k + 1) / (idx.length + 1)) * 100, y }));
  slots.forEach((s, i) => {
    if (['LB', 'LWB', 'LM', 'LW'].includes(s)) out[i].x = Math.min(out[i].x, 13);
    if (['RB', 'RWB', 'RM', 'RW'].includes(s)) out[i].x = Math.max(out[i].x, 87);
  });
  return out;
}

export function Team({ onHub }: { onHub: () => void }) {
  const { data, game, act } = useGame();
  const club = game.clubs[game.user];
  const slots = FORMATIONS[club.formation];
  const rows = useMemo(() => {
    const inXI = new Set(club.xi);
    const onBench = new Set(club.bench);
    const res = club.squad.filter((id) => !inXI.has(id) && !onBench.has(id)).sort((a, b) => game.players[b].ovr - game.players[a].ovr);
    return [
      ...club.xi.map((id, i) => ({ id, kind: 'xi' as const, slot: slots[i] as string })),
      ...club.bench.map((id) => ({ id, kind: 'sub' as const, slot: 'SUB' })),
      ...res.map((id) => ({ id, kind: 'res' as const, slot: 'RES' })),
    ];
  }, [club.xi, club.bench, club.squad, slots, game.players]);
  const nav = useListNav(rows.length);
  const body = useScrollIntoView(nav.index);
  const [marked, setMarked] = useState<number | null>(null);
  const problems = lineupProblems(game, game.user);
  const place = coords(club.formation);

  const eff = club.xi.map((id, i) => {
    const p = game.players[id];
    return p ? p.ovr * positionFit(parsePositions(p.pos), slots[i]) : 0;
  });
  const strength = teamStrength(slots, eff);

  const pick = (index: number) => {
    const id = rows[index]?.id;
    if (id === undefined) return;
    nav.setIndex(index);
    if (marked === null) setMarked(id);
    else {
      act((s) => swapLineup(s, s.user, marked, id));
      setMarked(null);
    }
  };
  const formationStep = (d: number) => {
    const i = FORMATION_NAMES.indexOf(club.formation);
    const f = FORMATION_NAMES[(i + d + FORMATION_NAMES.length) % FORMATION_NAMES.length];
    act((s) => setFormation(s, s.user, f));
    setMarked(null);
  };

  const commands: Command[] = [
    { keys: ['Enter'], label: marked === null ? 'Select' : 'Swap', primary: true, onPress: () => pick(nav.index) },
    browse('Browse', nav.up, nav.down),
    { keys: ['Q', 'E'], label: 'Formation', onPress: (k) => formationStep(k === 'Q' ? -1 : 1) },
    { keys: ['A'], label: 'Auto-Pick', onPress: () => { act((s) => applyAutoLineup(s, s.user)); setMarked(null); } },
    { keys: ['Space'], label: 'Play the Season', disabled: problems.length > 0, onPress: () => act((s, d) => simulate(s, d)) },
    { keys: ['Escape'], label: marked === null ? 'Hub' : 'Cancel', onPress: () => (marked === null ? onHub() : setMarked(null)) },
  ];

  const info = clubOf(data, game.user);
  return (
    <Frame
      club={info}
      title={info.name}
      sub="Pick Your Team"
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
      info={<><span>Budget</span><b>{money(club.cash)}</b></>}
    >
      <div className="team">
        <div className="listpane dpanel">
          <div className="ph gbar">Squad<small>{marked === null ? 'Select a player, then another to swap' : `Swap ${data.names[marked][0]} with…`}</small></div>
          <div className="tblwrap scroll">
            <table className="tbl">
              <thead><tr><th>Slot</th><th>Player</th><th>Pos</th><th className="n">Age</th><th className="n sort">Rating</th></tr></thead>
              <tbody ref={body}>
                {rows.map((r, i) => {
                  const p = game.players[r.id];
                  if (!p) return null;
                  const fit = r.kind === 'xi' ? positionFit(parsePositions(p.pos), r.slot as Position) : 1;
                  const shown = Math.round(p.ovr * fit);
                  const first = (i === club.xi.length && r.kind === 'sub') || (r.kind === 'res' && rows[i - 1]?.kind !== 'res');
                  return (
                    <tr
                      key={r.id}
                      className={`${r.kind} ${i === nav.index ? 'sel' : ''} ${r.id === marked ? 'marked' : ''} ${first ? 'div' : ''}`}
                      onClick={() => pick(i)}
                    >
                      <td className="slot">{r.slot}</td>
                      <td className="ellip">{data.names[r.id][0]}</td>
                      <td>{primaryPos(p.pos)}</td>
                      <td className="n">{p.age}</td>
                      <td className="n">{shown}{shown < p.ovr && <span className="pen">−{p.ovr - shown}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="note">{problems[0] ?? 'Players out of position play below their rating. The five subs cover knocks and come on late in games.'}</div>
        </div>
        <div className="right">
          <div className="formbar dpanel">
            <div className="tabs">
              <KeyCap k="Q" />
              {FORMATION_NAMES.map((f) => (
                <button key={f} className={`t ${f === club.formation ? 'on' : ''}`} onClick={() => act((s) => setFormation(s, s.user, f))} tabIndex={-1}>{f}</button>
              ))}
              <KeyCap k="E" />
            </div>
          </div>
          <div className="pitch">
            <svg className="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".5" vectorEffect="non-scaling-stroke">
                <rect x="2" y="2" width="96" height="96" />
                <line x1="2" y1="50" x2="98" y2="50" />
                <ellipse cx="50" cy="50" rx="10" ry="8" />
                <rect x="28" y="2" width="44" height="14" />
                <rect x="28" y="84" width="44" height="14" />
              </g>
            </svg>
            {club.xi.map((id, i) => {
              const p = game.players[id];
              if (!p) return null;
              const fit = positionFit(parsePositions(p.pos), slots[i]);
              const rowIndex = i;
              return (
                <div
                  key={id}
                  className={`plate ${nav.index === rowIndex ? 'sel' : ''} ${marked === id ? 'marked' : ''} ${fit < 1 ? 'off' : ''}`}
                  style={{ left: `${place[i].x}%`, top: `${place[i].y}%` }}
                  onClick={() => pick(rowIndex)}
                >
                  <b>{Math.round(p.ovr * fit)}</b>
                  <span>{data.names[id][0]}</span>
                  <em>{slots[i]}{fit < 1 ? ` −${p.ovr - Math.round(p.ovr * fit)}` : ''}</em>
                </div>
              );
            })}
          </div>
          <div className="strength">
            {(['gk', 'def', 'mid', 'att'] as const).map((k) => (
              <div key={k} className="ltile">
                <small>{{ gk: 'Goalkeeper', def: 'Defence', mid: 'Midfield', att: 'Attack' }[k]}</small>
                <b>{strength[k].toFixed(1)}</b>
                <i style={{ '--w': `${Math.max(0, Math.min(100, (strength[k] - 60) * 3.3))}%` } as React.CSSProperties} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}
