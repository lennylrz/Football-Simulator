import { useEffect, useMemo, useRef, useState } from 'react';
import { career as computeCareer } from '../../game/career';
import { challengeOf, resultText, targetMet } from '../../game/daily';
import { dailyBoard, submitDaily } from '../../net/daily';
import { saveDailyRecord } from '../../storage';
import { eraSeasons } from '../../game/data';
import { seasonLabel } from '../../game/game';
import { useGame } from '../../ui/context';
import { downloadBlob, drawShareCard, shareOrDownload } from '../../ui/shareCard';
import { careerColumns, closeCommand, HallOfFame, SeasonReport } from '../overlays';
import { SortTable } from '../SortTable';
import { browse, canShareText, clubOf, type Command, copyText, dailyLink, Frame, ordinal, ResultLines, shareText, useListNav, useTheme } from '../ui';

const TROPHY = { league: 'League', fa: 'FA Cup', cl: 'Europe' } as const;

export function Summary({ onNewCareer }: { onNewCareer: () => void }) {
  const { data, game } = useGame();
  const theme = useTheme();
  const info = clubOf(data, game.user);
  const c = useMemo(() => computeCareer(game), [game]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hall, setHall] = useState(false);
  const [report, setReport] = useState<number | null>(null);
  const nav = useListNav(c.seasons.length);

  // A Daily Challenge: the result to share, kept here and sent to the day's leaderboard once.
  const challenge = challengeOf(game.daily?.challenge);
  const met = targetMet(game, data);
  const text = challenge && game.daily ? resultText(game.daily.day, challenge, c.seasons, c.score, met, dailyLink()) : null;
  const [board, setBoard] = useState<Awaited<ReturnType<typeof dailyBoard>> | 'error' | null>(null);
  const [copied, setCopied] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    if (!game.daily || !text || sent.current) return;
    sent.current = true;
    const day = game.daily.day;
    saveDailyRecord({ day, done: true, club: info.name, score: c.score, text });
    const result = { finishes: c.seasons.map((s) => s.finish), trophies: c.seasons.map((s) => s.trophies.length), ...(met === undefined ? {} : { met }) };
    submitDaily(day, { club: info.name, score: c.score, result })
      .then(() => dailyBoard(day, 5))
      .then(setBoard, () => setBoard('error'));
  }, [game.daily, text, info.name, c, met]);
  const copy = async () => {
    if (text && (await copyText(text))) setCopied(true);
  };
  const shareResult = async () => {
    if (text && (await shareText(text)) === 'copied') setCopied(true);
  };

  useEffect(() => {
    if (!canvas.current) return;
    const draw = () => {
      if (!canvas.current) return;
      drawShareCard(canvas.current, { club: info, career: c, name: (id) => data.names[id][0], seed: game.seed, site: window.location.host, theme });
      setPreview(canvas.current.toDataURL('image/png'));
    };
    draw();
    // Redraw once the era's web fonts have loaded.
    document.fonts?.ready.then(draw);
  }, [info, c, data, game.seed, theme]);

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
        { ...browse('Season', nav.up, nav.down), hidden: !!text },
        { keys: ['R'], label: 'Season Report', onPress: () => setReport(c.seasons[nav.index].season) },
        { keys: ['S'], label: 'Save Image', onPress: download },
        { keys: ['H'], label: 'Hall of Fame', onPress: () => setHall(true) },
        ...(text ? [{ keys: ['C'], label: copied ? 'Copied' : 'Copy Result', onPress: () => void copy() } as Command] : []),
        { keys: ['Space'], label: game.daily ? 'Menu' : 'New Career', onPress: onNewCareer },
      ];
  const legends = c.players.filter((p) => p.apps >= 10);

  return (
    <Frame club={info} title={info.name} sub="Career Complete" right={<><small>Seasons</small>{eraSeasons()}</>} commands={commands}
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
            {challenge && text ? (
              <>
                <div className="ph gbar">Daily #{game.daily!.day} · {challenge.name}<small>{challenge.target ? `${challenge.target.label}: ${met ? 'done' : 'missed'}` : challenge.rule}</small></div>
                <div className="daily-end">
                  <div className="res">
                    <ResultLines text={text} />
                    <button className="rowbtn" onClick={() => void shareResult()} tabIndex={-1}>{copied ? 'Copied' : canShareText() ? 'Share result' : 'Copy result'}</button>
                  </div>
                  <div className="board">
                    {board === null && <div className="empty">Sending your score…</div>}
                    {board === 'error' && <div className="empty">The leaderboard can't be reached right now. Your result is saved here.</div>}
                    {board && board !== 'error' && (
                      <>
                        {board.top.map((s, k) => (
                          <div key={k} className={`brow ${s.mine ? 'me' : ''}`}><span>{k + 1}</span><span className="cl">{s.club}</span><b>{s.score.toLocaleString('en-GB')}</b></div>
                        ))}
                        {board.mine && board.rank !== undefined && board.rank > board.top.length && (
                          <div className="brow me"><span>{board.rank}</span><span className="cl">{board.mine.club}</span><b>{board.mine.score.toLocaleString('en-GB')}</b></div>
                        )}
                        {board.rank !== undefined && <div className="sub">{ordinal(board.rank)} of {board.total} today</div>}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="ph gbar">Club Legends<small>All competitions</small></div>
                <div className="tblwrap scroll">
                  <SortTable rows={legends} columns={careerColumns(data)} initial="score" rowKey={(p) => p.id} rowClass={(p) => (p.id === c.playerOfCareer?.id ? 'star' : '')} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {hall && <HallOfFame game={game} data={data} />}
      {report !== null && <SeasonReport game={game} data={data} season={report} />}
    </Frame>
  );
}
