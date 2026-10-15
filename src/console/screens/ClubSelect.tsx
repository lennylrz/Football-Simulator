import { useMemo, useState } from 'react';
import { CLUBS, repLabel } from '../../game/clubs';
import type { GameData } from '../../game/data';
import { browse, type Command, Frame, money, Overlay, useListNav, useScrollIntoView } from '../ui';

const CL_2015 = ['Chelsea', 'Manchester City', 'Arsenal', 'Manchester United'];

export function ClubSelect({ data, onStart, onBack }: { data: GameData; onStart: (club: number, seed: number) => void; onBack: () => void }) {
  const clubs = useMemo(
    () =>
      data.meta.gameClubs
        .map((name, i) => {
          const info = CLUBS.find((c) => c.name === name)!;
          const rated = data.squads[name].map((id) => ({ id, ovr: data.seasons[0][id][0] })).sort((a, b) => b.ovr - a.ovr);
          const xi = rated.slice(0, 11).reduce((s, x) => s + x.ovr, 0) / 11;
          return { i, info, xi, star: rated[0] };
        })
        .sort((a, b) => b.info.rep - a.info.rep || b.xi - a.xi)
        .map((c, _, all) => ({ ...c, rank: all.slice().sort((x, y) => y.xi - x.xi).indexOf(c) + 1 })),
    [data],
  );
  const nav = useListNav(clubs.length);
  const body = useScrollIntoView(nav.index);
  const c = clubs[nav.index];
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedText, setSeedText] = useState('');

  const start = () => {
    const parsed = Number.parseInt(seedText, 10);
    onStart(c.i, Number.isFinite(parsed) ? parsed >>> 0 : Math.floor(Math.random() * 2 ** 32));
  };

  const commands: Command[] = seedOpen
    ? [
        { keys: ['Enter'], label: 'Done', primary: true, onPress: () => setSeedOpen(false) },
        { keys: ['Escape'], label: 'Clear', onPress: () => { setSeedText(''); setSeedOpen(false); } },
      ]
    : [
        { keys: ['Enter'], label: 'Start Career', primary: true, onPress: start },
        browse('Browse', nav.up, nav.down),
        { keys: ['S'], label: 'Replay Seed', onPress: () => setSeedOpen(true) },
        { keys: ['Escape'], label: 'Back', onPress: onBack },
      ];

  return (
    <Frame title="New Career" sub="Choose your club · Summer 2015" commands={commands} info={<><span>Seed</span><b>{seedText || 'Random'}</b></>}>
      <div className="win">
        <div className="win-title">Choose Your Club</div>
        <div className="office">
          <div className="col">
            <span className="cap">{repLabel(c.info.rep)}</span>
            <span className="big">{c.info.name}</span>
            <span className="kv"><b>Transfer Budget</b><span>{money(c.info.budget * 1000)}</span></span>
            <span className="kv"><b>Reputation</b><span>{c.info.rep} / 100</span></span>
          </div>
          <div className="sep" />
          <div className="col">
            <span className="cap">Squad</span>
            <span className="kv"><span>Star Player</span><b>{data.names[c.star.id][0]} ({c.star.ovr})</b></span>
            <span className="kv"><span>Best XI Rating</span><b>{c.xi.toFixed(1)}</b></span>
            <span className="kv"><span>Strength Rank</span><b>{c.rank} of 20</b></span>
            <span className="kv"><span>Champions League</span><b>{CL_2015.includes(c.info.name) ? 'Qualified' : 'Not qualified'}</b></span>
          </div>
        </div>
        <div className="panes">
          <div className="pane dpanel">
            <div className="ph gbar">The Job</div>
            <div className="kvlist">
              <div><span>Seasons</span><b>2015/16 to 2019/20</b></div>
              <div><span>Competitions</span><b>League, FA Cup, Europe</b></div>
              <div><span>Squad Size</span><b>16 to 26 players</b></div>
              <div className="head">The ultimate goal</div>
              <div><span>The Treble</span><b>All three in one season</b></div>
              <button className="act on focus" onClick={start} tabIndex={-1}>Start Career</button>
              <button className="act" onClick={() => setSeedOpen(true)} tabIndex={-1}>Replay a Seed</button>
            </div>
          </div>
          <div className="pane dpanel">
            <div className="ph gbar">Clubs: 20<small>Sorted by reputation</small></div>
            <div className="tblwrap scroll">
              <table className="tbl">
                <thead>
                  <tr><th>Club</th><th>Status</th><th className="n">Budget</th><th className="n sort">Best XI</th></tr>
                </thead>
                <tbody ref={body}>
                  {clubs.map((x, k) => (
                    <tr key={x.i} className={k === nav.index ? 'sel' : ''} onClick={() => nav.setIndex(k)} onDoubleClick={start}>
                      <td className="ellip">{x.info.name}</td>
                      <td>{repLabel(x.info.rep)}</td>
                      <td className="n">€{x.info.budget}m</td>
                      <td className="n">{x.xi.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {seedOpen && (
        <Overlay title="Replay a Seed">
          <div className="kvlist" style={{ padding: '18px 22px' }}>
            <div><span>The same seed, club and decisions replay the same career.</span></div>
            <input
              autoFocus
              inputMode="numeric"
              value={seedText}
              placeholder="Random"
              onChange={(e) => setSeedText(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setSeedOpen(false);
              }}
              style={{ marginTop: 8, height: 40, fontSize: 22, padding: '0 12px', background: '#fff', color: '#111', border: '2px solid #4f74ad' }}
            />
          </div>
        </Overlay>
      )}
    </Frame>
  );
}
