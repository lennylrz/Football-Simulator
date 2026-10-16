import { type ReactNode, useState } from 'react';
import type { GameData } from '../../game/data';
import { type GameState, seasonLabel } from '../../game/game';
import type { Settings } from '../../settings';
import { clubOf, useCommands } from '../ui';
import './welcome.css';

type ItemId = 'single' | 'multi' | 'how' | 'settings' | 'about' | 'legal';

const ITEMS: { id: ItemId; label: string; note: string }[] = [
  { id: 'single', label: 'Singleplayer', note: 'Pick an era and start a career' },
  { id: 'multi', label: 'Multiplayer', note: 'Draft against friends' },
  { id: 'how', label: 'How to Play', note: 'The rules in one minute' },
  { id: 'settings', label: 'Settings', note: 'Motion and saved data' },
  { id: 'about', label: 'About & Credits', note: 'Who made this, and with what' },
  { id: 'legal', label: 'Legal', note: 'Unofficial fan game, data licence' },
];

export function Welcome({
  data, save, settings, onSettings, onDeleteSave, onPlay,
}: {
  data: GameData;
  save: GameState | null;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onDeleteSave: () => void;
  onPlay: () => void;
}) {
  const [index, setIndex] = useState(0);
  // 'panel' while the arrow keys move through the settings instead of the menu.
  const [focus, setFocus] = useState<'menu' | 'panel'>('menu');
  const [row, setRow] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const item = ITEMS[index];

  const select = (i: number) => {
    setIndex(i);
    setConfirmDelete(false);
  };
  const choose = (id: ItemId) => {
    if (id === 'single') onPlay();
    else if (id === 'settings') {
      setFocus('panel');
      setRow(0);
    }
  };
  const settingRows = [
    () => onSettings({ ...settings, reduceMotion: !settings.reduceMotion }),
    () => {
      if (!save) return;
      if (!confirmDelete) return setConfirmDelete(true);
      onDeleteSave();
      setConfirmDelete(false);
    },
  ];

  useCommands(
    focus === 'menu'
      ? [
          { keys: ['Up', 'Down'], label: 'Choose', onPress: (k) => select((index + (k === 'Up' ? ITEMS.length - 1 : 1)) % ITEMS.length) },
          { keys: ['Enter', 'Space'], label: 'Select', onPress: () => choose(item.id) },
        ]
      : [
          { keys: ['Up', 'Down'], label: 'Setting', onPress: (k) => setRow((r) => Math.max(0, Math.min(settingRows.length - 1, r + (k === 'Up' ? -1 : 1)))) },
          { keys: ['Enter', 'Space'], label: 'Change', onPress: () => settingRows[row]() },
          { keys: ['Escape', 'Left'], label: 'Back', onPress: () => { setFocus('menu'); setConfirmDelete(false); } },
        ],
  );

  const club = save && save.user >= 0 ? clubOf(data, save.user) : null;
  const saveLine = save && club
    ? `${club.name}, ${save.stage === 'summary' ? 'all five seasons complete' : `season ${save.season + 1} of 5 (${seasonLabel(save.season)})`}`
    : null;

  let panel: ReactNode;
  if (item.id === 'single') {
    panel = (
      <>
        <h2>Singleplayer</h2>
        <p className="lead">Create your own club, draft an XI of real players one position at a time, then live with five seasons of how they turned out.</p>
        {saveLine ? (
          <div className="w-save"><span className="dot" />Career in progress: {saveLine}. Continue it from the era's main menu.</div>
        ) : (
          <div className="w-save fresh"><span className="dot" />No career yet. The 2015–2020 era is playable now.</div>
        )}
        <button className="w-cta" onClick={onPlay} tabIndex={-1}>Choose an era <span className="kbd">Enter</span></button>
      </>
    );
  } else if (item.id === 'multi') {
    panel = (
      <>
        <h2>Multiplayer <span className="w-soon">Coming soon</span></h2>
        <p className="lead">Draft against friends from the same pool of players, then let five seasons decide who had the better eye.</p>
        <p className="muted">Not playable yet. Singleplayer has everything for now.</p>
      </>
    );
  } else if (item.id === 'how') {
    panel = (
      <>
        <h2>How to Play</h2>
        <ol className="w-steps">
          <li><span><b>Pick an era.</b> 2015–2020 is playable now; more eras are on the way.</span></li>
          <li><span><b>Create your club.</b> It joins the 20 clubs of the English top flight as the 21st.</span></li>
          <li><span><b>Draft your XI.</b> One position at a time, pick 1 of 5 real players. Rating and age are shown, potential stays hidden.</span></li>
          <li><span><b>Play five seasons.</b> League, FA Cup and Champions League, matchday by matchday. Pause, speed up or skip.</span></li>
          <li><span><b>Gamble each summer.</b> Ratings rise and fall with real history. Re-draft up to three players a summer.</span></li>
          <li><span><b>Leave a legacy.</b> Legacy score, best and worst pick, Hall of Fame. The treble is the dream, and it is rare.</span></li>
        </ol>
        <p className="muted">Keyboard: arrow keys, Enter and Esc. Every key hint on screen can also be clicked.</p>
      </>
    );
  } else if (item.id === 'settings') {
    panel = (
      <>
        <h2>Settings</h2>
        <div className={`w-settings ${focus === 'panel' ? 'active' : ''}`}>
          <button className={`w-set ${focus === 'panel' && row === 0 ? 'on' : ''}`} onClick={() => { setFocus('panel'); setRow(0); settingRows[0](); }} tabIndex={-1}>
            <span><b>Reduce motion</b><small>Turns off animations and cross-fades.</small></span>
            <span className={`w-toggle ${settings.reduceMotion ? 'yes' : ''}`}>{settings.reduceMotion ? 'On' : 'Off'}</span>
          </button>
          <button className={`w-set ${focus === 'panel' && row === 1 ? 'on' : ''}`} disabled={!save} onClick={() => { setFocus('panel'); setRow(1); settingRows[1](); }} tabIndex={-1}>
            <span><b>Saved career</b><small>{saveLine ?? 'Nothing saved.'}</small></span>
            <span className={`w-toggle ${confirmDelete ? 'danger' : ''}`}>{!save ? 'None' : confirmDelete ? 'Press again to delete' : 'Delete'}</span>
          </button>
        </div>
        <p className="muted">{focus === 'panel' ? 'Up and Down to move, Enter to change, Esc to go back.' : 'Press Enter or click a setting to change it.'} Settings and your career are kept in this browser only.</p>
      </>
    );
  } else if (item.id === 'about') {
    panel = (
      <>
        <h2>About & Credits</h2>
        <p className="lead">Five Seasons is a football draft game for people with ball knowledge: you only see how good a player is today, and history decides the rest.</p>
        <dl className="w-credits">
          <dt>Player data</dt><dd>FIFA 16 to FIFA 20 ratings from the "FIFA 23 complete player dataset" by Stefano Leone on Kaggle (CC0).</dd>
          <dt>Built with</dt><dd>React, TypeScript and Vite.</dd>
        </dl>
      </>
    );
  } else {
    panel = (
      <>
        <h2>Legal</h2>
        <p className="lead">Five Seasons is an unofficial fan game. It is not affiliated with, endorsed by or connected to any league, club, player or game publisher.</p>
        <p>Player and club names are used only to describe real footballers and teams. Ratings come from a public dataset released under CC0 (public domain); match results, transfers and careers in the game are simulated.</p>
        <p className="muted">No account, no ads, no tracking. Your career and settings are stored only in your own browser.</p>
      </>
    );
  }

  return (
    <div className="welcome">
      <div className="w-grid" aria-hidden />
      <div className="w-fine">Unofficial fan game · real player ratings</div>

      <div className="w-hero">
        <div className="w-mark">Five Seasons<span>.</span></div>
        <p className="w-tag">Draft a team. Live with how they turned out.</p>
      </div>

      <section className={`w-panel p-${item.id}`} key={item.id}>{panel}</section>

      <nav className="w-menu" aria-label="Main menu">
        {ITEMS.map((it, i) => (
          <button
            key={it.id}
            className={`w-item ${i === index ? 'on' : ''} ${focus === 'panel' && i === index ? 'held' : ''}`}
            onMouseEnter={() => focus === 'menu' && select(i)}
            onClick={() => {
              if (focus === 'panel' && i !== index) setFocus('menu');
              select(i);
              choose(it.id);
            }}
            tabIndex={-1}
          >
            <span className="w-label">{it.label}{it.id === 'multi' && <span className="w-soon">Soon</span>}</span>
            <span className="w-note">{it.note}</span>
          </button>
        ))}
      </nav>

      <footer className="w-keys">
        <span><span className="kbd">↑</span><span className="kbd">↓</span> Choose</span>
        <span><span className="kbd">Enter</span> Select</span>
        {focus === 'panel' && <span><span className="kbd">Esc</span> Back</span>}
      </footer>
    </div>
  );
}
