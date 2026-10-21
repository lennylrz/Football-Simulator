import { useEffect, useMemo, useRef, useState } from 'react';
import { career as computeCareer } from '../../game/career';
import { seasonLabel } from '../../game/game';
import { useGame } from '../../ui/context';
import { downloadBlob, drawShareCard, shareOrDownload } from '../../ui/shareCard';
import { careerColumns, closeCommand, HallOfFame, SeasonReport } from '../overlays';
import { SortTable } from '../SortTable';
import { browse, clubOf, type Command, Frame, ordinal, useListNav } from '../ui';

const TROPHY = { league: 'League', fa: 'FA Cup', cl: 'Europe' } as const;

export function Summary({ onNewCareer }: { onNewCareer: () => void }) {
  const { data, game } = useGame();
  const info = clubOf(data, game.user);
  const c = useMemo(() => computeCareer(game), [game]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hall, setHall] = useState(false);
  const [report, setReport] = useState<number | null>(null);
  const nav = useListNav(c.seasons.length);

  useEffect(() => {
    if (!canvas.current) return;
    drawShareCard(canvas.current, { club: info, career: c, name: (id) => data.names[id][0], seed: game.seed, site: window.location.host });
    setPreview(canvas.current.toDataURL('image/png'));
  }, [info, c, data, game.seed]);

  const file = `five-seasons-${info.code.toLowerCase()}.png`;
  const share = async () => {
    if (!canvas.current) return;
    try {
      const how = await shareOrDownload(canvas.current, file, c.trebles ? `I won the treble with ${info.name}. Can you?` : `My five seasons with ${info.name}. Can you do better?`);
      setStatus(how === 'downloaded' ? 'Saved to your downloads.' : 'Shared.');
    } catch {
      setStatus('Could not create the image.');
    }
  };
  const download = () => canvas.current?.toBlob((b) => b && downloadBlob(b, file), 'image/png');

  const commands: Command[] = hall || report !== null
    ? closeCommand(() => {
        setHall(false);
        setReport(null);
      })
    : [
        { keys: ['Enter'], label: 'Share Card', primary: true, onPress: share },
        browse('Season', nav.up, nav.down),
        { keys: ['R'], label: 'Season Report', onPress: () => setReport(c.seasons[nav.index].season) },
        { keys: ['S'], label: 'Save Image', onPress: download },
        { keys: ['H'], label: 'Hall of Fame', onPress: () => setHall(true) },
        { keys: ['Space'], label: 'New Career', onPress: onNewCareer },
      ];
  const legends = c.players.filter((p) => p.apps >= 10);

  return (
    <Frame club={info} title={info.name} sub="Career Complete" right={<><small>Seasons</small>2015/16 – 2019/20</>} commands={commands}
      info={<><span>Legacy</span><b>{c.score.toLocaleString('en-GB')}</b></>}>
      <canvas ref={canvas} style={{ display: 'none' }} />
      <div className="win">
        <div className="win-title">{c.trebles ? 'Treble Winners' : 'Career Summary'}</div>
        <div className="panes" style={{ gridTemplateColumns: '380px 1fr', paddingTop: 0 }}>
          <div className="pane dpanel" style={{ alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 }}>
            {preview && <img src={preview} alt="Share card" style={{ height: 470, boxShadow: '0 0 0 1px #000, 0 8px 20px rgba(0,0,0,.6)' }} />}
            <div style={{ color: '#8f9297', fontSize: 15 }}>{status ?? 'Press Enter to share, S to save the image.'}</div>
          </div>
          <div className="pane dpanel">
            <div className="ph gbar">Season by Season<small>Click a season for its report</small></div>
            <table className="tbl">
              <thead><tr><th>Season</th><th className="n">Finish</th><th className="n">Pts</th><th>Trophies</th></tr></thead>
              <tbody>
                {c.seasons.map((s, i) => (
                  <tr key={s.season} className={i === nav.index ? 'sel' : ''} onClick={() => { nav.setIndex(i); setReport(s.season); }}>
                    <td>{seasonLabel(s.season)}</td><td className="n">{ordinal(s.finish)}</td>
                    <td className="n">{game.history.find((h) => h.season === s.season)!.table[s.finish - 1].pts}</td>
                    <td>{s.trophies.length === 3 ? <span className="tag y">TREBLE</span> : s.trophies.map((t) => TROPHY[t]).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ph gbar">Club Legends<small>All competitions</small></div>
            <div className="tblwrap scroll">
              <SortTable rows={legends} columns={careerColumns(data)} initial="score" rowKey={(p) => p.id} rowClass={(p) => (p.id === c.playerOfCareer?.id ? 'star' : '')} />
            </div>
            <div className="note">
              {c.bestPick && <>Best pick: <b>{data.names[c.bestPick.player][0]} {c.bestPick.from} → {c.bestPick.to}</b>. </>}
              {c.worstPick && <>Worst pick: {data.names[c.worstPick.player][0]} {c.worstPick.from} → {c.worstPick.to}.</>}
            </div>
          </div>
        </div>
      </div>
      {hall && <HallOfFame game={game} data={data} />}
      {report !== null && <SeasonReport game={game} data={data} season={report} />}
    </Frame>
  );
}
