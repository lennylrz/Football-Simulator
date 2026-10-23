import { useState } from 'react';
import { CL_ROUNDS, type CupMatch, type Entrant, FA_ROUNDS, type Tie, tiesOf, WINNER } from '../../game/cups';
import { Bracket } from '../Bracket';
import { NUM_SEASONS } from '../../game/data';
import { seasonLabel, trophiesOf } from '../../game/game';
import { useGame } from '../../ui/context';
import { closeCommand, HallOfFame, LeaveCareer, leaveCommands, reachedText, seasonColumns, seasonPlayers } from '../overlays';
import { rivalCommand, RivalOverlay } from '../room';
import { SortTable } from '../SortTable';
import '../results.css';
import { SeasonViewer } from '../Viewer';
import { PlayerCard, SeasonStory } from '../awards';
import { HONOURS, SeasonMoments } from '../moments';
import { clubOf, type Command, Frame, KeyCap, ordinal } from '../ui';

const TABS = ['Story', 'Table', 'Your Matches', 'Champions League', 'FA Cup', 'Leaders', 'Squad'] as const;

/** Rounds as cup runs list them, short so the opponent has room. */
const ROUND_SHORT: Record<string, string> = {
  'Third round': 'Round 3', 'Fourth round': 'Round 4', 'Fifth round': 'Round 5', 'Round of 16': 'Last 16', 'Quarter-final': 'Quarter', 'Semi-final': 'Semi', Final: 'Final',
};


export function Results() {
  const { data, game, send, settings, quit, room } = useGame();
  const [rival, setRival] = useState(false);
  const [card, setCard] = useState<number | null>(null);
  const waiting = !!room?.full.mp?.views[game.user]?.done;
  const [leaving, setLeaving] = useState(false);
  const [revealing, setRevealing] = useState(settings.matchSpeed !== 'instant');
  // Then the season's moments: trophies, the Ballon d'Or, the player of the season.
  const [celebrating, setCelebrating] = useState(true);
  const [tab, setTab] = useState(0);
  const [hall, setHall] = useState(false);
  const h = game.history[game.history.length - 1];
  const result = game.result!;
  const info = clubOf(data, game.user);
  const finish = h.table.findIndex((r) => r.club === game.user) + 1;
  const won = trophiesOf(h, game.user);
  const last = game.season >= NUM_SEASONS - 1;
  const ent = (e: Entrant) => (typeof e === 'number' ? clubOf(data, e).short : e);

  if (revealing) return <SeasonViewer game={game} data={data} onDone={() => setRevealing(false)} fastStart={settings.matchSpeed === 'fast'} rival={room?.rival} />;
  if (celebrating) return <SeasonMoments game={game} data={data} onDone={() => setCelebrating(false)} />;

  const commands: Command[] = leaving
    ? leaveCommands(quit, () => setLeaving(false))
    : hall
    ? closeCommand(() => setHall(false))
    : rival
    ? closeCommand(() => setRival(false))
    : [
        waiting
          ? { keys: ['Space'], label: 'Waiting for your rival…', primary: true, disabled: true, onPress: () => {} }
          : { keys: ['Space'], label: last ? 'Career Summary' : `On to ${seasonLabel(game.season + 1)}`, primary: true, onPress: () => send({ t: 'continue' }) },
        { keys: ['Q', 'E'], label: 'Tabs', onPress: (k) => setTab((t) => (t + (k === 'Q' ? -1 : 1) + TABS.length) % TABS.length) },
        { keys: ['H'], label: 'Hall of Fame', onPress: () => setHall(true) },
        ...rivalCommand(room, () => setRival(true)),
        { keys: ['Escape'], label: room ? 'Leave Room' : 'Leave Career', onPress: () => setLeaving(true) },
      ];

  const userMatches = (() => {
    const out: { slot: number; comp: string; cls: string; m: { home: Entrant; away: Entrant; hg: number; ag: number; pens?: 0 | 1 } }[] = [];
    result.rounds.forEach((r, ri) =>
      r.forEach(([home, away, hg, ag]) => {
        if (home === game.user || away === game.user) out.push({ slot: ri + 1, comp: `League ${ri + 1}`, cls: '', m: { home, away, hg, ag } });
      }),
    );
    const cup = (label: string, cls: string, list: CupMatch[]) =>
      list.forEach((m) => {
        if (m.home === game.user || m.away === game.user) {
          out.push({ slot: m.slot, comp: `${label} ${m.round === 'Group stage' ? 'Group' : m.round}${m.leg ? ` (${m.leg})` : ''}`, cls, m });
        }
      });
    cup('FA', 'fa', result.fa.matches);
    cup('CL', 'cl', result.cl.matches);
    return out.sort((a, b) => a.slot - b.slot);
  })();

  const outcome = (m: { home: Entrant; away: Entrant; hg: number; ag: number; pens?: 0 | 1 }) => {
    const mine = m.home === game.user ? m.hg - m.ag : m.ag - m.hg;
    if (mine !== 0) return mine > 0 ? 'W' : 'L';
    if (m.pens === undefined) return 'D';
    return (m.pens === 0) === (m.home === game.user) ? 'W' : 'L';
  };

  const group = result.cl.groups?.find((g) => g.some((r) => r.team === game.user));
  /** The user's ties in a cup, round by round. */
  const run = (matches: CupMatch[], rounds: string[]) =>
    rounds.flatMap((round) => tiesOf(matches, round).filter((t) => t.a === game.user || t.b === game.user));
  const faRun = run(result.fa.matches, FA_ROUNDS);
  const clRun = run(result.cl.matches, CL_ROUNDS.slice(1));
  const faOut = faRun.find((t) => t.winner !== game.user);
  const runRows = (list: Tie[]) =>
    list.map((t) => {
      const home = t.a === game.user;
      const opp = home ? t.b : t.a;
      const won = t.winner === game.user;
      const [f, a] = home ? [t.ga, t.gb] : [t.gb, t.ga];
      return (
        <tr key={t.round}>
          <td className="comp" title={t.round}>{ROUND_SHORT[t.round] ?? t.round}</td>
          <td className="ellip">{t.legs.length > 1 ? 'vs' : home ? 'vs' : 'at'} {ent(opp)}</td>
          <td className="score">{f}–{a}{t.pens ? <small> p</small> : ''}{t.legs.length > 1 ? <small> agg</small> : ''}</td>
          <td className="c"><span className={`tag ${won ? 'g' : 'r'}`}>{won ? (t.round === 'Final' ? 'WON' : 'THROUGH') : 'OUT'}</span></td>
        </tr>
      );
    });

  return (
    <Frame
      club={info}
      title={info.name}
      sub="Season Review"
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
    >
      <div className="win review">
        <div className={`win-title ${won.length ? 'won' : ''}`}>{won.length ? `${HONOURS[won.join(' ')]} · ${seasonLabel(game.season)}` : `Season Review ${seasonLabel(game.season)}`}</div>
        <div className={`office ${won.length === 3 ? 'treble' : ''}`} style={{ height: 132 }}>
          <div className="col">
            <span className="cap">League · Your Finish</span>
            <span className="big">{ordinal(finish)} · {h.table[finish - 1].pts} pts</span>
            <span className="kv"><span>Champions</span><b>{clubOf(data, h.table[0].club).name}</b></span>
            {h.predicted !== undefined && (
              <span className="kv"><span>On paper</span><b className={finish < h.predicted ? 'good' : finish > h.predicted ? 'bad' : ''}>Predicted {ordinal(h.predicted)}{finish < h.predicted ? ', beat it' : finish > h.predicted ? ', fell short' : ', spot on'}</b></span>
            )}
          </div>
          <div className="sep" />
          <div className="col">
            <span className="cap">Cups</span>
            <span className="kv"><span>FA Cup</span><b className={h.faReached[game.user] === WINNER ? 'gold' : ''}>{reachedText(h.faReached[game.user])}</b></span>
            <span className="kv"><span>Won by</span><span>{typeof h.faWinner === 'number' ? clubOf(data, h.faWinner).name : h.faWinner}</span></span>
            <span className="kv"><span>Champions League</span><b className={h.clReached[game.user] === WINNER ? 'gold' : ''}>{reachedText(h.clReached[game.user])}</b></span>
            <span className="kv"><span>Won by</span><span>{typeof h.clWinner === 'number' ? clubOf(data, h.clWinner).name : h.clWinner}</span></span>
          </div>
        </div>
        <div className="tabsbar dpanel">
          <div className="tabs">
            <KeyCap k="Q" />
            {TABS.map((t, i) => (
              <button key={t} className={`t ${i === tab ? 'on' : ''}`} onClick={() => setTab(i)} tabIndex={-1}>{t}</button>
            ))}
            <KeyCap k="E" />
          </div>
        </div>
        <div className="content">
          {tab === 0 && <SeasonStory h={h} data={data} user={game.user} game={game} />}
          {tab === 1 && (
            <div className="pane dpanel">
              <div className="tblwrap scroll">
                <table className="tbl">
                  <thead><tr><th className="n">#</th><th>Club</th><th className="n">P</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n">GF</th><th className="n">GA</th><th className="n">GD</th><th className="n sort">Pts</th></tr></thead>
                  <tbody>
                    {h.table.map((r, i) => (
                      <tr key={r.club} className={`${r.club === game.user ? 'sel' : ''} ${i < 4 ? 'zone-cl' : i === 4 ? 'zone-el' : i >= h.table.length - 3 ? 'zone-rel' : ''}`}>
                        <td className="n">{i + 1}</td><td>{clubOf(data, r.club).name}</td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td>
                        <td className="n">{r.gf}</td><td className="n">{r.ga}</td><td className="n">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td className="n"><b>{r.pts}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 2 && (
            <div className="pane dpanel">
              <div className="tblwrap scroll">
                <table className="tbl">
                  <thead><tr><th>Competition</th><th className="n">Home</th><th className="c">Score</th><th>Away</th><th className="c">Result</th></tr></thead>
                  <tbody>
                    {userMatches.map((x, i) => {
                      const o = outcome(x.m);
                      return (
                        <tr key={i}>
                          <td className={`comp ${x.cls}`}>{x.comp}</td>
                          <td className="n">{ent(x.m.home)}</td>
                          <td className="score">{x.m.hg}–{x.m.ag}{x.m.pens !== undefined ? ' p' : ''}</td>
                          <td>{ent(x.m.away)}</td>
                          <td className="c"><span className={`tag ${o === 'W' ? 'g' : o === 'L' ? 'r' : 'k'}`}>{o}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 3 && (
            <>
              <div className="pane dpanel" style={{ flex: 'none', width: 400 }}>
                <div className="ph gbar">{group ? 'Your Group' : 'Group Stage'}<small>{reachedText(h.clReached[game.user])}</small></div>
                {group ? (
                  <table className="tbl">
                    <thead><tr><th>Club</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n">GD</th><th className="n sort">Pts</th></tr></thead>
                    <tbody>
                      {group.map((r, k) => (
                        <tr key={String(r.team)} className={`${r.team === game.user ? 'sel' : ''} ${k < 2 ? 'zone-cl' : ''}`}>
                          <td className="ellip">{ent(r.team)}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td>
                          <td className="n">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td className="n"><b>{r.pts}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty">You didn't qualify this season. Finish in the top four to play in it next season.</div>
                )}
                {clRun.length > 0 && (
                  <>
                    <div className="ph gbar">Your Knockout Ties<small>{result.cl.winner === game.user ? 'Champions' : ''}</small></div>
                    <div className="tblwrap scroll">
                      <table className="tbl cuptbl"><tbody>{runRows(clRun)}</tbody></table>
                    </div>
                  </>
                )}
              </div>
              <div className="pane dpanel">
                <div className="ph gbar">Knockout Stage<small>Won by {ent(result.cl.winner)} · aggregate scores, * on penalties</small></div>
                <Bracket matches={result.cl.matches} rounds={CL_ROUNDS.slice(1)} user={game.user} name={ent} />
              </div>
            </>
          )}
          {tab === 4 && (
            <>
              <div className="pane dpanel" style={{ flex: 'none', width: 400 }}>
                <div className="ph gbar">Your Cup Run<small>{reachedText(h.faReached[game.user])}</small></div>
                <table className="tbl cuptbl"><tbody>{runRows(faRun)}</tbody></table>
                <div className="note">
                  {result.fa.winner === game.user
                    ? <b>FA Cup winners.</b>
                    : faOut ? <>Knocked out in the {faOut.round.toLowerCase()} by <b>{ent(faOut.winner)}</b>.</> : 'No FA Cup run this season.'}
                </div>
              </div>
              <div className="pane dpanel">
                <div className="ph gbar">From the Quarter-finals<small>Won by {ent(result.fa.winner)} · * on penalties</small></div>
                <Bracket matches={result.fa.matches} rounds={FA_ROUNDS.slice(3)} user={game.user} name={ent} />
              </div>
            </>
          )}
          {tab === 5 && (
            <>
              {([['Top Scorers', h.topScorers], ['Top Assists', h.topAssists]] as const).map(([label, list]) => (
                <div key={label} className="pane dpanel">
                  <div className="ph gbar">{label}<small>League</small></div>
                  <div className="tblwrap scroll">
                    <table className="tbl">
                      <tbody>
                        {list.slice(0, 15).map(([id, club, n], i) => (
                          <tr key={id} className={club === game.user ? 'sel' : ''}><td className="n">{i + 1}</td><td className="ellip">{data.names[id][0]}</td><td>{clubOf(data, club).short}</td><td className="n"><b>{n}</b></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
          {tab === 6 && (
            <div className="pane dpanel">
              <div className="tblwrap scroll">
                <SortTable rows={seasonPlayers(game, h.season)} columns={seasonColumns(game, data)} initial="avg" rowKey={(r) => r.id} onRow={(r) => setCard(r.id)} />
              </div>
            </div>
          )}
        </div>
      </div>
      {hall && <HallOfFame game={game} data={data} />}
      {leaving && <LeaveCareer />}
      {rival && room && <RivalOverlay room={room} data={data} me={game.user} />}
      {card !== null && <PlayerCard game={game} data={data} id={card} onClose={() => setCard(null)} />}
    </Frame>
  );
}
