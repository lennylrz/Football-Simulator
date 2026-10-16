import { useCallback, useEffect, useRef, useState } from 'react';
import { Home } from './console/home/Home';
import { Welcome } from './console/home/Welcome';
import { Draft } from './console/screens/Draft';
import { MainMenu } from './console/screens/MainMenu';
import { NewClub } from './console/screens/NewClub';
import { Results } from './console/screens/Results';
import { Summary } from './console/screens/Summary';
import { Summer } from './console/screens/Summer';
import { HallOfFame } from './console/overlays';
import { CommandBar, Stage } from './console/ui';
import { type GameData, loadGameData } from './game/data';
import type { ClubInfo } from './game/clubs';
import { type GameState, newGame, REAL_CLUBS, registerUserClub } from './game/game';
import type { Formation } from './game/positions';
import { applySettings, loadSettings, saveSettings, type Settings } from './settings';
import { loadRun, saveRun } from './storage';
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

type Mode = 'welcome' | 'home' | 'menu' | 'clubs' | 'menu-hall' | 'play';

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(() => loadRun());
  const [mode, setMode] = useState<Mode>('welcome');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  useEffect(() => applySettings(settings), [settings]);
  const changeSettings = (s: Settings) => {
    saveSettings(s);
    setSettings(s);
  };

  useEffect(() => {
    loadGameData(fetchJson).then((d) => {
      // A saved career's own club joins the 20 real ones.
      const saved = loadRun();
      if (saved?.ownClub) registerUserClub(d, saved.ownClub);
      setData(d);
    }, (e) => setError(String(e)));
  }, []);

  // Actions run synchronously on a copy, so callers can read results right away.
  const current = useRef(game);
  current.current = game;
  const act = useCallback(
    (fn: (s: GameState, d: GameData) => void) => {
      if (!current.current || !data) return;
      const next = structuredClone(current.current);
      fn(next, data);
      current.current = next;
      saveRun(next);
      setGame(next);
    },
    [data],
  );

  const start = (club: ClubInfo, formation: Formation, seed: number) => {
    if (!data) return;
    const g = newGame(data, REAL_CLUBS, seed, 'draft', formation, club);
    g.ownClub = club;
    saveRun(g);
    setGame(g);
    setMode('play');
  };

  if (error) return <Stage><div className="empty" style={{ padding: 60 }}>Couldn't load the game data. {error}</div></Stage>;
  if (!data) return <Stage><div className="empty" style={{ padding: 60 }}>Loading players…</div></Stage>;

  if (mode === 'welcome') {
    return (
      <Stage tone="home">
        <Welcome
          data={data}
          save={game}
          settings={settings}
          onSettings={changeSettings}
          onDeleteSave={() => {
            saveRun(null);
            setGame(null);
          }}
          onPlay={() => setMode('home')}
        />
      </Stage>
    );
  }
  if (mode === 'home') {
    return (
      <Stage tone="home">
        <Home onPlay={() => setMode('menu')} onBack={() => setMode('welcome')} />
      </Stage>
    );
  }
  if (mode === 'menu' || mode === 'menu-hall') {
    return (
      <Stage tone="light">
        <MainMenu data={data} save={game} onNew={() => setMode('clubs')} onContinue={() => setMode('play')} onHall={() => setMode('menu-hall')} onHome={() => setMode('home')} />
        {mode === 'menu-hall' && game && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 6 }}>
            <HallOfFame game={game} data={data} />
            <CommandBar commands={[{ keys: ['Escape', 'Enter'], label: 'Close', primary: true, onPress: () => setMode('menu') }]} />
          </div>
        )}
      </Stage>
    );
  }
  if (mode === 'clubs' || !game) {
    return (
      <Stage>
        <NewClub onStart={start} onBack={() => setMode('menu')} />
      </Stage>
    );
  }

  const toMenu = () => setMode('menu');
  let screen;
  if (game.stage === 'results') screen = <Results />;
  else if (game.stage === 'summary') screen = <Summary onNewCareer={() => setMode('clubs')} />;
  else if (game.draft?.slot !== null && game.draft?.slot !== undefined) screen = <Draft onMenu={toMenu} />;
  else screen = <Summer onMenu={toMenu} />;

  return (
    <GameContext.Provider value={{ data, game, act, quit: () => setMode('menu') }}>
      <Stage>{screen}</Stage>
    </GameContext.Provider>
  );
}
