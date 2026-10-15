import { useCallback, useEffect, useRef, useState } from 'react';
import { MainMenu } from './console/screens/MainMenu';
import { ClubSelect } from './console/screens/ClubSelect';
import { Hub } from './console/screens/Hub';
import { Results } from './console/screens/Results';
import { Summary } from './console/screens/Summary';
import { Team } from './console/screens/Team';
import { BidsStep, OffersStep, SquadStep } from './console/screens/Window';
import { HallOfFame } from './console/overlays';
import { CommandBar, Stage } from './console/ui';
import { type GameData, loadGameData } from './game/data';
import { type GameState, newGame } from './game/game';
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

type Mode = 'menu' | 'clubs' | 'menu-hall' | 'play';

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(() => loadRun());
  const [mode, setMode] = useState<Mode>('menu');
  const [atHub, setAtHub] = useState(true);

  useEffect(() => {
    loadGameData(fetchJson).then(setData, (e) => setError(String(e)));
  }, []);

  // A new season opens at the hub.
  const season = game?.season;
  useEffect(() => setAtHub(true), [season]);

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

  const start = (club: number, seed: number) => {
    if (!data) return;
    const g = newGame(data, club, seed);
    saveRun(g);
    setGame(g);
    setAtHub(true);
    setMode('play');
  };

  if (error) return <Stage><div className="empty" style={{ padding: 60 }}>Couldn't load the game data. {error}</div></Stage>;
  if (!data) return <Stage><div className="empty" style={{ padding: 60 }}>Loading players…</div></Stage>;

  if (mode === 'menu' || mode === 'menu-hall') {
    return (
      <Stage tone="light">
        <MainMenu data={data} save={game} onNew={() => setMode('clubs')} onContinue={() => { setAtHub(true); setMode('play'); }} onHall={() => setMode('menu-hall')} />
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
        <ClubSelect data={data} onStart={start} onBack={() => setMode('menu')} />
      </Stage>
    );
  }

  const toHub = () => setAtHub(true);
  let screen;
  if (game.stage === 'results') screen = <Results />;
  else if (game.stage === 'summary') screen = <Summary onNewCareer={() => setMode('clubs')} />;
  else if (atHub) screen = <Hub onContinue={() => setAtHub(false)} onMenu={() => setMode('menu')} />;
  else if (game.stage === 'lineup') screen = <Team onHub={toHub} />;
  else if (game.step === 'squad') screen = <SquadStep onHub={toHub} />;
  else if (game.step === 'offers') screen = <OffersStep onHub={toHub} />;
  else screen = <BidsStep onHub={toHub} />;

  return (
    <GameContext.Provider value={{ data, game, act, quit: () => setMode('menu') }}>
      <Stage>{screen}</Stage>
    </GameContext.Provider>
  );
}
