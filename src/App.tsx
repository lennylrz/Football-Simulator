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
import { Stage, ThemeContext } from './console/ui';
import './console/editorial.css';
import { type Action, applyAction, type RoomManager } from './game/actions';
import { RoomSession } from './console/RoomSession';
import { Lobby } from './console/screens/Lobby';
import { createRoom, getRoom, hasJoined, normalizeCode, playerId, type Room } from './net/room';
import { type Era, type GameData, loadGameData } from './game/data';
import type { ClubInfo } from './game/clubs';
import { activateEra, type GameState, newGame, REAL_CLUBS } from './game/game';
import type { Formation } from './game/positions';
import type { PlayStyle } from './game/styles';
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

type Mode = 'welcome' | 'home' | 'setup' | 'menu' | 'clubs' | 'play' | 'lobby' | 'roomclub' | 'room';

/** An invite link: ?room=CODE */
const INVITE = normalizeCode(new URLSearchParams(location.search).get('room') ?? '');

/** Each era's data, fetched the first time it is picked. */
const eraData = new Map<Era, Promise<GameData>>();

export default function App() {
  const [era, setEra] = useState<Era | null>(null);
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [mode, setMode] = useState<Mode>('welcome');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // Two-player rooms: the room, the club to join it with, and the lobby's state.
  const [room, setRoom] = useState<Room | null>(null);
  const [pendingRoom, setPendingRoom] = useState<Room | null>(null);
  const [joinAs, setJoinAs] = useState<RoomManager | undefined>(undefined);
  const [lobby, setLobby] = useState<{ busy: boolean; error: string | null; code: string }>({ busy: false, error: null, code: INVITE });
  /** where the lobby was opened from, and whether a host still has to pick an era */
  const [lobbyFrom, setLobbyFrom] = useState<'welcome' | 'menu'>('menu');
  const [hostNeedsEra, setHostNeedsEra] = useState(false);

  // An invite link opens the lobby in the room's era, code filled in.
  useEffect(() => {
    if (!INVITE) return;
    getRoom(INVITE).then((r) => {
      if (!r) return;
      setEra(r.era as Era);
      setMode('lobby');
    }, () => {});
  }, []);
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
    if (era === null) return;
    if (!eraData.has(era)) eraData.set(era, loadGameData(fetchJson, era));
    let live = true;
    eraData.get(era)!.then(
      (d) => {
        if (!live) return;
        activateEra(d);
        setData(d);
      },
      (e) => {
        eraData.delete(era);
        if (live) setError(String(e));
      },
    );
    return () => {
      live = false;
    };
  }, [era]);

  const send = useCallback(
    (a: Action) => {
      if (!current.current || !data) return;
      const next = structuredClone(current.current);
      applyAction(next, data, next.user, a);
      current.current = next;
      if (next.draft?.shown) rememberShown(next.seed, next.draft.shown);
      setGame(next);
    },
    [data],
  );

  // A typed-in seed replays exactly the same draft, so it ignores recent careers.
  const start = (club: ClubInfo, formation: Formation, seed: number, shared: boolean, style: PlayStyle) => {
    if (!data) return;
    const g = newGame(data, REAL_CLUBS, seed, 'draft', formation, club, rulesOf(settings), shared ? [] : recentPlayers(seed));
    g.clubs[g.user].style = style;
    g.ownClub = club;
    if (g.draft?.shown) rememberShown(g.seed, g.draft.shown);
    current.current = g;
    setGame(g);
    setMode('play');
  };

  const joinRoom = async (code: string) => {
    setLobby({ busy: true, error: null, code });
    try {
      const r = await getRoom(code);
      if (!r) {
        setLobby({ busy: false, error: 'No room with that code.', code });
        return;
      }
      setEra(r.era as Era);
      setLobby({ busy: false, error: null, code });
      // The host, or a guest coming back, carries on; a new guest makes a club first.
      if (r.host.pid === playerId() || (await hasJoined(code))) {
        setJoinAs(undefined);
        setRoom(r);
        setMode('room');
      } else {
        setPendingRoom(r);
        setMode('roomclub');
      }
    } catch (e) {
      setLobby({ busy: false, error: String(e), code });
    }
  };
  const roomClub = async (club: ClubInfo, formation: Formation, style: PlayStyle) => {
    if (pendingRoom) {
      setJoinAs({ club, formation, style });
      setRoom(pendingRoom);
      setPendingRoom(null);
      setMode('room');
      return;
    }
    setLobby((l) => ({ ...l, busy: true, error: null }));
    try {
      const r = await createRoom(era!, rulesOf(settings), { club, formation, style });
      setLobby((l) => ({ ...l, busy: false }));
      setJoinAs(undefined);
      setRoom(r);
      setMode('room');
    } catch (e) {
      setLobby((l) => ({ ...l, busy: false, error: String(e) }));
      setMode('lobby');
    }
  };
  const leaveRoom = () => {
    setRoom(null);
    setPendingRoom(null);
    setJoinAs(undefined);
    if (location.search) history.replaceState(null, '', location.pathname);
    setMode('menu');
  };

  const theme = era === 2015 ? 'ed' : '';
  const view = (() => {
    if (error) return <Stage><div className="empty" style={{ padding: 60 }}>Couldn't load the game data. {error}</div></Stage>;

    if (mode === 'welcome') {
      return (
        <Stage tone="home">
          <Welcome
            settings={settings}
            onSettings={changeSettings}
            onPlay={() => {
              setHostNeedsEra(false);
              setMode('home');
            }}
            onMulti={() => {
              setLobbyFrom('welcome');
              setMode('lobby');
            }}
          />
        </Stage>
      );
    }
    if (mode === 'home') {
      return (
        <Stage tone="home">
          <Home
            onPlay={(e) => {
              setEra(e);
              // A host from the welcome screen's Multiplayer goes on to make the room's club.
              setMode(hostNeedsEra ? 'roomclub' : 'setup');
              setHostNeedsEra(false);
            }}
            onBack={() => setMode(hostNeedsEra ? 'lobby' : 'welcome')}
          />
        </Stage>
      );
    }
    if (mode === 'lobby') {
      return (
        <Stage>
          <Lobby
            era={era !== null}
            initialCode={lobby.code}
            busy={lobby.busy}
            error={lobby.error}
            onHost={() => {
              setPendingRoom(null);
              if (era === null) {
                setHostNeedsEra(true);
                setMode('home');
              } else setMode('roomclub');
            }}
            onJoin={(code) => void joinRoom(code)}
            onBack={() => setMode(lobbyFrom === 'welcome' || era === null ? 'welcome' : 'menu')}
          />
        </Stage>
      );
    }
    // Every screen past the era picker shows that era's data.
    if (!data || data.era !== era) return <Stage><div className="empty" style={{ padding: 60 }}>Loading players…</div></Stage>;
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
          <MainMenu onNew={() => setMode('clubs')} onMulti={() => {
            setLobbyFrom('menu');
            setMode('lobby');
          }} onSettings={() => setMode('setup')} onHome={() => setMode('home')} />
        </Stage>
      );
    }
    if (mode === 'roomclub') {
      return (
        <Stage>
          <NewClub room={pendingRoom ? 'guest' : 'host'} busy={lobby.busy} onStart={(club, formation, _seed, _shared, style) => void roomClub(club, formation, style)} onBack={() => setMode('lobby')} settings={settings} />
        </Stage>
      );
    }
    if (mode === 'room' && room) {
      return <RoomSession room={room} data={data} settings={settings} joinAs={joinAs} onLeave={leaveRoom} />;
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
      <GameContext.Provider value={{ data, game, send, quit, settings }}>
        <Stage>{screen}</Stage>
      </GameContext.Provider>
    );
  })();
  return <ThemeContext.Provider value={theme}>{view}</ThemeContext.Provider>;
}
