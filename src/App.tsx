import { useCallback, useEffect, useRef, useState } from 'react';
import { Home } from './console/home/Home';
import { Welcome } from './console/home/Welcome';
import { Draft } from './console/screens/Draft';
import { GameSetup } from './console/screens/GameSetup';
import { MainMenu } from './console/screens/MainMenu';
import { NewClub } from './console/screens/NewClub';
import { Results } from './console/screens/Results';
import { Summary } from './console/screens/Summary';
import { Summer } from './console/screens/Summer';
import { Stage } from './console/ui';
import { type GameData, loadGameData } from './game/data';
import type { ClubInfo } from './game/clubs';
import { type GameState, newGame, REAL_CLUBS } from './game/game';
import type { Formation } from './game/positions';
import { applySettings, loadSettings, rulesOf, saveSettings, type Settings } from './settings';
import { recentPlayers, rememberShown } from './storage';
import { GameContext } from './ui/context';

declare global {
  interface Window {
    /** game data inlined by scripts/build_single.mjs for the single-file build */
    __GAME_DATA__?: Record<string, unknown>;
  }
}

async function fetchJson(file: string) {
  const inlined = window.__GAME_DATA__?.[file];
  if (inlined) return inlined;
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file}`);
  return res.json();
}

type Mode = 'welcome' | 'home' | 'setup' | 'menu' | 'clubs' | 'play';

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [mode, setMode] = useState<Mode>('welcome');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // Actions run synchronously on a copy, so callers can read results right away.
  const current = useRef(game);
  current.current = game;
  useEffect(() => applySettings(settings), [settings]);
  const changeSettings = (s: Settings) => {
    saveSettings(s);
    setSettings(s);
    // A career in progress follows the rules too.
    const g = current.current;
    if (g) {
      const next = { ...g, rules: rulesOf(s) };
      current.current = next;
      setGame(next);
    }
  };

  useEffect(() => {
    loadGameData(fetchJson).then(setData, (e) => setError(String(e)));
  }, []);

  const act = useCallback(
    (fn: (s: GameState, d: GameData) => void) => {
      if (!current.current || !data) return;
      const next = structuredClone(current.current);
      fn(next, data);
      current.current = next;
      if (next.draft?.shown) rememberShown(next.seed, next.draft.shown);
      setGame(next);
    },
    [data],
  );

  // A typed-in seed replays exactly the same draft, so it ignores recent careers.
  const start = (club: ClubInfo, formation: Formation, seed: number, shared: boolean) => {
    if (!data) return;
    const g = newGame(data, REAL_CLUBS, seed, 'draft', formation, club, rulesOf(settings), shared ? [] : recentPlayers(seed));
    g.ownClub = club;
    if (g.draft?.shown) rememberShown(g.seed, g.draft.shown);
    current.current = g;
    setGame(g);
    setMode('play');
  };

  if (error) return <Stage><div className="empty" style={{ padding: 60 }}>Couldn't load the game data. {error}</div></Stage>;
  if (!data) return <Stage><div className="empty" style={{ padding: 60 }}>Loading players…</div></Stage>;

  if (mode === 'welcome') {
    return (
      <Stage tone="home">
        <Welcome settings={settings} onSettings={changeSettings} onPlay={() => setMode('home')} />
      </Stage>
    );
  }
  if (mode === 'home') {
    return (
      <Stage tone="home">
        <Home onPlay={() => setMode('setup')} onBack={() => setMode('welcome')} />
      </Stage>
    );
  }
  if (mode === 'setup') {
    return (
      <Stage>
        <GameSetup settings={settings} onChange={changeSettings} onDone={() => setMode('menu')} onBack={() => setMode('home')} />
      </Stage>
    );
  }
  if (mode === 'menu') {
    return (
      <Stage tone="light">
        <MainMenu onNew={() => setMode('clubs')} onSettings={() => setMode('setup')} onHome={() => setMode('home')} />
      </Stage>
    );
  }
  if (mode === 'clubs' || !game) {
    return (
      <Stage>
        <NewClub onStart={start} onBack={() => setMode('menu')} settings={settings} />
      </Stage>
    );
  }

  // Leaving a career ends it: there is nothing to continue.
  const quit = () => {
    current.current = null;
    setGame(null);
    setMode('menu');
  };
  let screen;
  if (game.stage === 'results') screen = <Results />;
  else if (game.stage === 'summary') screen = <Summary onNewCareer={() => setMode('clubs')} />;
  else if (game.draft?.slot !== null && game.draft?.slot !== undefined) screen = <Draft />;
  else screen = <Summer />;

  return (
    <GameContext.Provider value={{ data, game, act, quit, settings }}>
      <Stage>{screen}</Stage>
    </GameContext.Provider>
  );
}
