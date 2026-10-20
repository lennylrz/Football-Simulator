import { useState } from 'react';
import { type CupMatch, type Entrant, WINNER } from '../../game/cups';
import { NUM_SEASONS } from '../../game/data';
import { endSeason, seasonLabel, trophiesOf } from '../../game/game';
import { useGame } from '../../ui/context';
import { closeCommand, HallOfFame, LeaveCareer, leaveCommands, reachedText, seasonColumns, seasonPlayers } from '../overlays';
import { SortTable } from '../SortTable';
import '../results.css';
import { SeasonViewer } from '../Viewer';
import { clubOf, type Command, Frame, KeyCap, ordinal } from '../ui';

const TABS = ['Table', 'Your Matches', 'Cups', 'Leaders', 'Squad'] as const;

export function Results() {
  const { data, game, act, settings, quit } = useGame();
  const [leaving, setLeaving] = useState(false);
  const [revealing, setRevealing] = useState(settings.matchSpeed !== 'instant');
  const [tab, setTab] = useState(0);
  const [hall, setHall] = useState(false);
  const h = game.history[game.history.length - 1];
  const result = game.result!;
  const info = clubOf(data, game.user);
  const finish = h.table.findIndex((r) => r.club === game.user) + 1;
  const won = trophiesOf(h, game.user);
  const last = game.season >= NUM_SEASONS - 1;
  const ent = (e: Entrant) => (typeof e === 'number' ? clubOf(data, e).short : e);

  if (revealing) return <SeasonViewer game={game} data={data} onDone={() => setRevealing(false)} fastStart={settings.matchSpeed === 'fast'} />;

  const commands: Command[] = leaving
    ? leaveCommands(quit, () => setLeaving(false))
    : hall
    ? closeCommand(() => setHall(false))
    : [
        { keys: ['Space'], label: last ? 'Career Summary' : `On to ${seasonLabel(game.season + 1)}`, primary: true, onPress: () => act((s, d) => endSeason(s, d)) },
        { keys: ['Q', 'E'], label: 'Tabs', onPress: (k) => setTab((t) => (t + (k === 'Q' ? -1 : 1) + TABS.length) % TABS.length) },
        { keys: ['H'], label: 'Hall of Fame', onPress: () => setHall(true) },
        { keys: ['Escape'], label: 'Leave Career', onPress: () => setLeaving(true) },
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
  const ko = result.cl.matches.filter((m) => m.round !== 'Group stage');
  const fa = result.fa.matches.filter((m) => m.home === game.user || m.away === game.user || /Quarter|Semi|Final/.test(m.round));

  const matchRows = (list: CupMatch[]) =>
    list.map((m, i) => (
      <tr key={i} className={m.home === game.user || m.away === game.user ? 'me' : ''}>
        <td className="comp">{m.round}{m.leg ? ` (${m.leg})` : ''}</td>
        <td className="n">{ent(m.home)}</td>
        <td className="score">{m.hg}–{m.ag}{m.pens !== undefined ? ' p' : ''}</td>
        <td>{ent(m.away)}</td>
      </tr>
    ));

  return (
    <Frame
      club={info}
      title={info.name}
      sub="Season Review"
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
    >
      <div className="win review">
        <div className="win-title">{won.length === 3 ? 'THE TREBLE' : `Season Review ${seasonLabel(game.season)}`}</div>
        <div className={`office ${won.length === 3 ? 'treble' : ''}`} style={{ height: 132 }}>
          <div className="col">
            <span className="cap">League · Your Finish</span>
            <span className="big">{ordinal(finish)} · {h.table[finish - 1].pts} pts</span>
            <span className="kv"><span>Champions</span><b>{clubOf(data, h.table[0].club).name}</b></span>
            {h.predicted !== undefined && (
              <span className="kv"><span>On paper</span><b className={finish < h.predicted ? 'good' : finish > h.predicted ? 'bad' : ''}>Predicted {ordinal(h.predicted)}{finish < h.predicted ? ', beat it' : finish > h.predicted ? ', fell short' : ', spot on'}</b></span>
            )}
            {won.length > 0 && <span className="kv"><span>Trophies</span><b className="gold">{won.map((t) => ({ league: 'League', fa: 'FA Cup', cl: 'Champions League' })[t]).join(' · ')}</b></span>}
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
          {tab === 0 && (
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
          {tab === 1 && (
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
          {tab === 2 && (
            <>
              <div className="pane dpanel">
                <div className="ph gbar">Champions League<small>Won by {ent(result.cl.winner)}</small></div>
                <div className="tblwrap scroll">
                  {group && (
                    <table className="tbl">
                      <thead><tr><th>Your Group</th><th className="n">W</th><th className="n">D</th><th className="n">L</th><th className="n sort">Pts</th></tr></thead>
                      <tbody>
                        {group.map((r) => (
                          <tr key={String(r.team)} className={r.team === game.user ? 'sel' : ''}><td className="ellip">{ent(r.team)}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td><td className="n">{r.pts}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {!group && <div className="empty">You didn't qualify. Finish in the top four to get in.</div>}
                  <table className="tbl cuptbl"><tbody>{matchRows(ko)}</tbody></table>
                </div>
              </div>
              <div className="pane dpanel">
                <div className="ph gbar">FA Cup<small>Won by {ent(result.fa.winner)}</small></div>
                <div className="tblwrap scroll">
                  <table className="tbl cuptbl"><tbody>{matchRows(fa)}</tbody></table>
                </div>
              </div>
            </>
          )}
          {tab === 3 && (
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
          {tab === 4 && (
            <div className="pane dpanel">
              <div className="tblwrap scroll">
                <SortTable rows={seasonPlayers(game, h.season)} columns={seasonColumns(game, data)} initial="avg" rowKey={(r) => r.id} />
              </div>
            </div>
          )}
        </div>
      </div>
      {hall && <HallOfFame game={game} data={data} />}
      {leaving && <LeaveCareer />}
    </Frame>
  );
}
