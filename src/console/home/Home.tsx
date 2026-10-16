import { useState } from 'react';
import { useCommands } from '../ui';
import './home.css';
import { Preview, PREVIEWS } from './Previews';

type EraKey = keyof typeof PREVIEWS;

const ERAS: { key: EraKey; years: string; style: string; blurb: string; live: boolean }[] = [
  { key: 2000, years: '2000–2005', style: 'The desktop era', blurb: 'Grey windows, navy title bars, dense tables and a progress bar that takes its time.', live: false },
  { key: 2005, years: '2005–2010', style: 'The chrome era', blurb: 'Glossy pill buttons, shiny orbs and a memory card holding your only career.', live: false },
  { key: 2010, years: '2010–2015', style: 'The tiles era', blurb: 'Big live tiles over a dimmed stadium, light type and big numbers.', live: false },
  { key: 2015, years: '2015–2020', style: 'The console era', blurb: 'Glossy bars, grey tiles, a calendar and the silver button bar. Draft real players from 2015 and see who becomes a star.', live: true },
  { key: 2020, years: '2020–now', style: 'The modern era', blurb: 'Clean, minimal and quiet, with your club colour as the only accent.', live: false },
];

export function Home({ onPlay }: { onPlay: () => void }) {
  const [index, setIndex] = useState(3);
  const era = ERAS[index];
  const go = () => era.live && onPlay();
  useCommands([
    { keys: ['Left', 'Right'], label: 'Era', onPress: (k) => setIndex((i) => Math.max(0, Math.min(ERAS.length - 1, i + (k === 'Left' ? -1 : 1)))) },
    { keys: ['Enter'], label: 'Play', onPress: go },
  ]);

  return (
    <div className="home">
      <div className="mark">Five Seasons<span>.</span></div>
      <div className="tag">Pick an era. Draft a team. Live with how they turned out.</div>
      <div className="fine">Unofficial fan game · real player ratings</div>

      <div className="info">
        <div className="style">{era.style}</div>
        <div className="years">{era.years}</div>
        <p>{era.blurb}</p>
        <span className={`status ${era.live ? 'live' : ''}`}><i />{era.live ? 'Playable now' : 'Coming later'}</span>
        <button className="play" onClick={go} disabled={!era.live} tabIndex={-1}>
          {era.live ? <>Start {era.years}<kbd>ENTER</kbd></> : 'Not yet available'}
        </button>
      </div>

      <div className="hwin preview">
        <div className="bar">Five Seasons · {era.years}<span className="ctl"><i /><i /><i /></span></div>
        <div className="fade" key={era.key}>
          <Preview era={era.key} width={666} />
        </div>
      </div>

      <div className="eras">
        {ERAS.map((e, i) => (
          <button key={e.key} className={`era ${i === index ? 'on' : ''}`} onMouseEnter={() => setIndex(i)} onFocus={() => setIndex(i)} onClick={() => (e.live ? onPlay() : setIndex(i))} tabIndex={-1}>
            <div className="bar">{e.years}<em className={e.live ? 'live' : ''}>{e.live ? 'Play' : 'Soon'}</em></div>
            <div className="thumb"><Preview era={e.key} width={217} /></div>
          </button>
        ))}
      </div>
      <div className="hkeys"><span><kbd>←</kbd><kbd>→</kbd>Choose an era</span><span><kbd>ENTER</kbd>Play</span></div>
    </div>
  );
}
