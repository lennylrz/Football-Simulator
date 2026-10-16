import { useEffect, useRef, useState } from 'react';
import type { GameData } from '../../game/data';
import { type GameState, seasonLabel } from '../../game/game';
import '../menu.css';
import { drawShards } from '../shards';
import { browse, clubOf, Frame } from '../ui';

interface Tab {
  id: 'new' | 'continue' | 'hall' | 'settings';
  label: string;
  desc: string;
  flag: string;
}

export function MainMenu({
  data, save, onNew, onContinue, onHall, onSettings, onHome,
}: { data: GameData; save: GameState | null; onNew: () => void; onContinue: () => void; onHall: () => void; onSettings: () => void; onHome: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (canvas.current) drawShards(canvas.current);
  }, []);

  const club = save && save.user >= 0 ? clubOf(data, save.user) : null;
  const tabs: Tab[] = [
    {
      id: 'new',
      label: 'New Career',
      desc: 'Create your own club, draft an XI of real 2015 players and take on the 20 clubs of the English top flight for five seasons.',
      flag: save ? 'Replaces your saved career' : 'Start here',
    },
  ];
  if (save && club) {
    const where =
      save.stage === 'summary' ? 'your five seasons are complete' : `season ${save.season + 1} of 5, ${seasonLabel(save.season)}`;
    tabs.push(
      {
        id: 'continue',
        label: 'Continue',
        desc: `Pick up where you left off: ${club.name}, ${where}.`,
        flag: save.stage === 'summary' ? 'Career complete' : 'Career in progress',
      },
      { id: 'hall', label: 'Hall of Fame', desc: 'Your trophies, your best players and your best and worst signings so far.', flag: 'Treble watch' },
    );
  }
  tabs.push({ id: 'settings', label: 'Settings', desc: 'Hidden ratings, the pick timer, re-drafts per summer, match speed and more.', flag: 'Your rules' });
  const [index, setIndex] = useState(save ? 1 : 0);
  const [left, setLeft] = useState(60);
  const tab = tabs[Math.min(index, tabs.length - 1)];

  useEffect(() => {
    const el = rail.current?.children[index] as HTMLElement | undefined;
    if (el) setLeft(60 + el.offsetLeft + 24);
  }, [index, tabs.length]);

  const go = (t: Tab) => (t.id === 'new' ? onNew() : t.id === 'continue' ? onContinue() : t.id === 'settings' ? onSettings() : onHall());

  return (
    <div className="mm">
      <canvas ref={canvas} width={1280} height={720} aria-hidden />
      <div className="title">
        FIVE SEASONS<span>2015 · 2020 CAREER</span>
      </div>
      <p className="tagline">
        Draft real players from 2015, watch who becomes a star, and gamble each summer. Five seasons to build a legacy. <em>Can you win the treble?</em>
      </p>
      {club && save && (
        <div className="stamp">
          Saved career<b>{club.short} · {save.stage === 'summary' ? 'Complete' : seasonLabel(save.season)}</b>
        </div>
      )}
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
        info={<>Unofficial fan game · FIFA 16-20 ratings</>}
      >
        {null}
      </Frame>
    </div>
  );
}
