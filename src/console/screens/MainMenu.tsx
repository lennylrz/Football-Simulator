import { useEffect, useRef, useState } from 'react';
import { eraYears, SEASON_YEARS } from '../../game/data';

const FIFA: Record<number, string> = { 2010: 'FIFA 11-15', 2015: 'FIFA 16-20', 2020: 'FIFA 21-FC 25' };
import '../menu.css';
import { drawShards } from '../shards';
import { browse, Frame } from '../ui';

interface Tab {
  id: 'new' | 'settings';
  label: string;
  desc: string;
  flag: string;
}

const TABS: Tab[] = [
  {
    id: 'new',
    label: 'New Career',
    get desc() {
      return `Create your own club, draft an XI of real ${SEASON_YEARS[0]} players and take on the 20 clubs of the English top flight for five seasons.`;
    },
    flag: 'Start here',
  },
  { id: 'settings', label: 'Settings', desc: 'Hidden ratings, the pick timer, re-drafts per summer, match speed and more.', flag: 'Your rules' },
];

export function MainMenu({ onNew, onSettings, onHome }: { onNew: () => void; onSettings: () => void; onHome: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (canvas.current) drawShards(canvas.current);
  }, []);
  const tabs = TABS;
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(60);
  const tab = tabs[Math.min(index, tabs.length - 1)];

  useEffect(() => {
    const el = rail.current?.children[index] as HTMLElement | undefined;
    if (el) setLeft(60 + el.offsetLeft + 24);
  }, [index, tabs.length]);

  const go = (t: Tab) => (t.id === 'new' ? onNew() : onSettings());

  return (
    <div className="mm">
      <canvas ref={canvas} width={1280} height={720} aria-hidden />
      <div className="title">
        FIVE SEASONS<span>{eraYears(' · ')} CAREER</span>
      </div>
      <p className="tagline">
        Draft real players from {SEASON_YEARS[0]}, watch who becomes a star, and gamble each summer. Five seasons to build a legacy. <em>Can you win the treble?</em>
      </p>
      <div className="desc" style={{ left }}>
        {tab.desc}
        <span className="flag">{tab.flag}</span>
      </div>
      <div className="rail" ref={rail}>
        {tabs.map((t, i) => (
          <button key={t.id} className={`tab ${i === index ? 'on' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => go(t)} tabIndex={-1}>
            {t.label}
          </button>
        ))}
      </div>
      <Frame
        full
        commands={[
          { keys: ['Enter'], label: 'Select', primary: true, onPress: () => go(tab) },
          browse('Move', () => setIndex(Math.max(0, index - 1)), () => setIndex(Math.min(tabs.length - 1, index + 1)), true),
          { keys: ['Escape'], label: 'All Eras', onPress: onHome },
        ]}
        info={<>Unofficial fan game · {FIFA[SEASON_YEARS[0]]} ratings</>}
      >
        {null}
      </Frame>
    </div>
  );
}
