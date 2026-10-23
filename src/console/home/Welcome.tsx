import { type ReactNode, useEffect, useState } from 'react';
import { dailyChallenge, dailyNumber, untilNextDaily } from '../../game/daily';
import { dailyBoard, type DailyScore } from '../../net/daily';
import type { Settings } from '../../settings';
import { dailyRecord } from '../../storage';
import { copyText, ordinal, ResultLines, useCommands } from '../ui';
import './welcome.css';

type ItemId = 'single' | 'daily' | 'multi' | 'how' | 'settings' | 'about' | 'legal';

const ERA_YEARS: Record<number, string> = { 2010: '2010–2015', 2015: '2015–2020', 2020: '2020–2025' };

const ITEMS: { id: ItemId; label: string; note: string }[] = [
  { id: 'single', label: 'Singleplayer', note: 'Pick an era and start a career' },
  { id: 'daily', label: 'Daily Challenge', note: '' },
  { id: 'multi', label: 'Multiplayer', note: 'Host a room or join with a code' },
  { id: 'how', label: 'How to Play', note: 'The rules in one minute' },
  { id: 'settings', label: 'Settings', note: 'Motion' },
  { id: 'about', label: 'About & Credits', note: 'Who made this, and with what' },
  { id: 'legal', label: 'Legal', note: 'Unofficial fan game, data licence' },
];

type Board = Awaited<ReturnType<typeof dailyBoard>>;

const hm = (ms: number) => `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;

export function Welcome({ settings, onSettings, onPlay, onMulti, onDaily }: {
  settings: Settings; onSettings: (s: Settings) => void; onPlay: () => void; onMulti: () => void; onDaily: () => void;
}) {
  const [index, setIndex] = useState(0);
  // Today's challenge, how it went here, and the day's board.
  const day = dailyNumber();
  const challenge = dailyChallenge(day);
  const record = dailyRecord(day);
  const [board, setBoard] = useState<Board | 'error' | null>(null);
  const [copied, setCopied] = useState(false);
  // 'panel' while the arrow keys move through the settings instead of the menu.
  const [focus, setFocus] = useState<'menu' | 'panel'>('menu');
  const [row, setRow] = useState(0);
  const item = ITEMS[index];

  const select = (i: number) => setIndex(i);
  const onDailyItem = ITEMS[index].id === 'daily';
  useEffect(() => {
    if (!onDailyItem || board) return;
    dailyBoard(day, 5).then(setBoard, () => setBoard('error'));
  }, [onDailyItem, board, day]);
  const copy = async () => {
    if (record?.text && (await copyText(record.text))) setCopied(true);
  };
  const choose = (id: ItemId) => {
    if (id === 'single') onPlay();
    else if (id === 'daily') {
      if (!record) onDaily();
    }
    else if (id === 'multi') onMulti();
    else if (id === 'settings') {
      setFocus('panel');
      setRow(0);
    }
  };
  const settingRows = [() => onSettings({ ...settings, reduceMotion: !settings.reduceMotion })];

  useCommands(
    focus === 'menu'
      ? [
          { keys: ['Up', 'Down'], label: 'Choose', onPress: (k) => select((index + (k === 'Up' ? ITEMS.length - 1 : 1)) % ITEMS.length) },
          { keys: ['Enter', 'Space'], label: 'Select', onPress: () => choose(item.id) },
          { keys: ['C'], label: 'Copy', hidden: true, disabled: item.id !== 'daily' || !record?.text, onPress: () => void copy() },
        ]
      : [
          { keys: ['Up', 'Down'], label: 'Setting', onPress: (k) => setRow((r) => Math.max(0, Math.min(settingRows.length - 1, r + (k === 'Up' ? -1 : 1)))) },
          { keys: ['Enter', 'Space'], label: 'Change', onPress: () => settingRows[row]() },
          { keys: ['Escape', 'Left'], label: 'Back', onPress: () => setFocus('menu') },
        ],
  );

  let panel: ReactNode;
  if (item.id === 'single') {
    panel = (
      <>
        <h2>Singleplayer</h2>
        <p className="lead">Create your own club, draft an XI of real players one position at a time, then live with five seasons of how they turned out.</p>
        <div className="w-save fresh"><span className="dot" />Two eras are playable now: 2010–2015 and 2015–2020. Careers are not saved: leave one and it ends.</div>
        <button className="w-cta" onClick={onPlay} tabIndex={-1}>Choose an era <span className="kbd">Enter</span></button>
      </>
    );
  } else if (item.id === 'daily') {
    const row = (s: DailyScore, rank: number) => (
      <div key={`${rank}-${s.club}`} className={`w-row ${s.mine ? 'me' : ''}`}>
        <span className="rk">{rank}</span><span className="cl">{s.club}</span><b>{s.score.toLocaleString('en-GB')}</b>
      </div>
    );
    panel = (
      <>
        <h2>Daily Challenge <span className="w-soon">#{day}</span></h2>
        <p className="lead"><b>{challenge.name}</b> · {ERA_YEARS[challenge.era]}</p>
        <div className="w-rule">{challenge.rule}{challenge.target ? <> <b>Target:</b> {challenge.target.label[0].toLowerCase()}{challenge.target.label.slice(1)}.</> : null}</div>
        {!record ? (
          <>
            <p className="muted">The same challenge and seed for everyone today, and one attempt: leaving the career ends it.</p>
            <button className="w-cta" onClick={onDaily} tabIndex={-1}>Play today's challenge <span className="kbd">Enter</span></button>
          </>
        ) : (
          <div className="w-daily">
            <div className="w-result">
              {record.text ? (
                <>
                  <ResultLines text={record.text} />
                  <button className="w-copy" onClick={() => void copy()} tabIndex={-1}>{copied ? 'Copied' : 'Copy result'} <span className="kbd">C</span></button>
                </>
              ) : (
                <p>You started today's challenge and left it. One attempt a day.</p>
              )}
              <p className="muted">Next challenge in {hm(untilNextDaily())}.</p>
            </div>
            <div className="w-board">
              <div className="cap">Today's best</div>
              {board === null && <p className="muted">Loading…</p>}
              {board === 'error' && <p className="muted">The leaderboard can't be reached right now.</p>}
              {board && board !== 'error' && (
                <>
                  {board.top.map((s, k) => row(s, k + 1))}
                  {board.mine && board.rank !== undefined && board.rank > board.top.length && row(board.mine, board.rank)}
                  {board.total === 0 && <p className="muted">No scores yet today.</p>}
                  {board.rank !== undefined && <p className="muted">You are {ordinal(board.rank)} of {board.total}.</p>}
                </>
              )}
            </div>
          </div>
        )}
      </>
    );
  } else if (item.id === 'multi') {
    panel = (
      <>
        <h2>Multiplayer</h2>
        <p className="lead">Draft against a friend from the same pool of players, then let five seasons decide who had the better eye.</p>
        <div className="w-save fresh"><span className="dot" />Host a room and send the five-letter code, or join a friend's. You never get offered the same players, you play in the same league and meet twice a season, live.</div>
        <button className="w-cta" onClick={onMulti} tabIndex={-1}>Host or join a room <span className="kbd">Enter</span></button>
      </>
    );
  } else if (item.id === 'how') {
    panel = (
      <>
        <h2>How to Play</h2>
        <ol className="w-steps">
          <li><span><b>Pick an era.</b> 2010–2015 or 2015–2020; more are on the way.</span></li>
          <li><span><b>Create your club.</b> It joins the 20 clubs of the English top flight as the 21st.</span></li>
          <li><span><b>Draft your XI.</b> One position at a time, in any order you like, pick 1 of 5 real players. Rating and age are shown, potential stays hidden.</span></li>
          <li><span><b>Play five seasons.</b> League, FA Cup and Champions League, matchday by matchday. Pause, speed up or skip.</span></li>
          <li><span><b>Gamble each summer.</b> Ratings follow real history and how each player performed for you. Re-draft a few positions a summer, each one once.</span></li>
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
        </div>
        <p className="muted">{focus === 'panel' ? 'Up and Down to move, Enter to change, Esc to go back.' : 'Press Enter or click a setting to change it.'} Settings are kept in this browser only. Careers are not saved: leave one and it ends.</p>
        <p className="muted">Game rules (hidden ratings, pick timer, re-drafts per summer, match speed) open as soon as you pick an era.</p>
      </>
    );
  } else if (item.id === 'about') {
    panel = (
      <>
        <h2>About & Credits</h2>
        <p className="lead">Five Seasons is a football draft game for people with ball knowledge: you only see how good a player is today, and history decides the rest.</p>
        <dl className="w-credits">
          <dt>Player data</dt><dd>FIFA 11 to EA FC 25 ratings. 2010–2015: the "European Soccer Database" by Hugo Mathien (ODbL) and FIFA 15. 2015–2020: the "FIFA 23 complete player dataset" by Stefano Leone (CC0). 2020–2025: his "EA Sports FC 24 complete player dataset" (CC0) and the "EA Sports FC 25 database" by nyagami (Apache 2.0). Some nationalities from the Transfermarkt dataset by davidcariboo (CC0). All on Kaggle.</dd>
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
            <span className="w-label">{it.label}</span>
            <span className="w-note">{it.id === 'daily' ? `#${day} · ${challenge.name}${record ? (record.done ? ' · played' : ' · started') : ''}` : it.note}</span>
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
