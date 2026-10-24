// A phone held upright gets the game drawn sideways. Before that, once a
// visit, this card says to turn the phone, with today's challenge as the hook.
// Where the browser allows it (Android), Play goes full screen in landscape.
import { useState } from 'react';
import { dailyChallenge, dailyNumber } from '../game/daily';
import './turn.css';

const KEY = 'five-seasons-turned';

/** Shown already this visit: every Stage reads the same answer. */
let seen = (() => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export function useTurnCard(): [boolean, () => void] {
  const [shown, setShown] = useState(!seen);
  const done = () => {
    seen = true;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // Storage blocked: the card comes back on the next visit only.
    }
    setShown(false);
  };
  return [shown, done];
}

/** Full screen and landscape where allowed; the sideways stage covers the rest. */
async function goLandscape() {
  try {
    await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch {
    // iPhone Safari allows neither.
  }
}

export function TurnPhone({ onPlay }: { onPlay: () => void }) {
  const day = dailyNumber();
  const challenge = dailyChallenge(day);
  return (
    <div className="turn" role="dialog" aria-label="Turn your phone sideways">
      <div className="t-mark">Five Seasons<span>.</span></div>
      <p className="t-tag">Draft a team. Live with how they turned out.</p>
      <div className="t-phone" aria-hidden><i /></div>
      <h2>Turn your phone sideways</h2>
      <p className="t-daily">Daily #{day} · <b>{challenge.name}</b></p>
      <button
        className="t-go"
        onClick={() => {
          void goLandscape();
          onPlay();
        }}
      >
        Play
      </button>
    </div>
  );
}
