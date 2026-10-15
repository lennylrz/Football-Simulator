import { useCallback, useEffect, useRef, useState } from 'react';
import { type GameData, loadGameData } from './game/data';
import { type GameState, newGame } from './game/game';
import { Lineup } from './screens/Lineup';
import { Results } from './screens/Results';
import { Start } from './screens/Start';
import { Summary } from './screens/Summary';
import { TransferWindow } from './screens/TransferWindow';
import { loadRun, saveRun } from './storage';
import { GameContext } from './ui/context';
import { Header } from './ui/Header';

async function fetchJson(file: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file}`);
  return res.json();
}

export default function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(() => loadRun());

  useEffect(() => {
    loadGameData(fetchJson).then(setData, (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [game?.stage, game?.season]);

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
  };

  const quit = () => {
    saveRun(null);
    setGame(null);
  };

  if (error) return <Centered>Couldn't load the game data. {error}</Centered>;
  if (!data) return <Centered>Loading players…</Centered>;
  if (!game) return <Start data={data} onStart={start} />;

  return (
    <GameContext.Provider value={{ data, game, act, quit }}>
      <div className="mx-auto min-h-dvh max-w-3xl pb-28">
        <Header />
        <main className="space-y-3 px-3 pt-3">
          {game.stage === 'window' && <TransferWindow />}
          {game.stage === 'lineup' && <Lineup />}
          {game.stage === 'results' && <Results />}
          {game.stage === 'summary' && <Summary />}
        </main>
      </div>
    </GameContext.Provider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-6 text-center text-slate-300">{children}</div>;
}
