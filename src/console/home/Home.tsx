import { useState } from 'react';
import { useCommands } from '../ui';
import './home.css';
import { Preview, PREVIEWS } from './Previews';

type EraKey = keyof typeof PREVIEWS;

const ERAS: { key: EraKey; years: string; style: string; live: boolean }[] = [
  { key: 2000, years: '2000–2005', style: 'The desktop era', live: false },
  { key: 2005, years: '2005–2010', style: 'The chrome era', live: false },
  { key: 2010, years: '2010–2015', style: 'The tiles era', live: false },
  { key: 2015, years: '2015–2020', style: 'The console era', live: true },
  { key: 2020, years: '2020–now', style: 'The modern era', live: false },
];

export function Home({ onPlay, onBack }: { onPlay: () => void; onBack: () => void }) {
  // null: nothing hovered, the clean home page shows.
  const [index, setIndex] = useState<number | null>(null);
  const era = index === null ? null : ERAS[index];
  const go = () => era?.live && onPlay();
  useCommands([
    {
      keys: ['Left', 'Right'],
      label: 'Era',
      onPress: (k) => setIndex((i) => (i === null ? 3 : Math.max(0, Math.min(ERAS.length - 1, i + (k === 'Left' ? -1 : 1))))),
    },
    { keys: ['Enter'], label: 'Play', onPress: () => (era ? go() : setIndex(3)) },
    { keys: ['Escape'], label: 'Back', onPress: () => (index === null ? onBack() : setIndex(null)) },
  ]);

  return (
    <div className={`home ${era ? `themed t${era.key}` : ''}`}>
      {/* Every era's full-screen look, cross-faded in on hover. */}
      {ERAS.map((e, i) => (
        <div key={e.key} className={`layer ${i === index ? 'shown' : ''}`} aria-hidden>
          <Preview era={e.key} width={1280} />
        </div>
      ))}

      <button className="back" onClick={onBack} tabIndex={-1}>‹ Main menu</button>

      <div className="clean">
        <div className="mark">Five Seasons<span>.</span></div>
        <p className="tag">Pick an era. Draft a team. Live with how they turned out.</p>
        <p className="hint">Hover an era to step into it.</p>
      </div>

      <div className="eras" onMouseLeave={() => setIndex(null)}>
        {ERAS.map((e, i) => (
          <button
            key={e.key}
            className={`era ${i === index ? 'on' : ''} ${e.live ? 'live' : ''}`}
            onMouseEnter={() => setIndex(i)}
            onClick={() => (e.live ? onPlay() : setIndex(i))}
            tabIndex={-1}
          >
            <span className="years">{e.years}</span>
            <span className="style">{e.style}</span>
            <span className="state">{e.live ? (i === index ? 'Click or Enter to play' : 'Playable now') : 'Coming later'}</span>
          </button>
        ))}
      </div>
      <div className="fine">Unofficial fan game · real player ratings</div>
    </div>
  );
}
