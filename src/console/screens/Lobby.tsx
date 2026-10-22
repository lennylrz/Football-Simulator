import { useState } from 'react';
import { eraYears } from '../../game/data';
import { normalizeCode } from '../../net/room';
import '../room.css';
import { type Command, Frame } from '../ui';

/** Play a Friend: host a room, or join one with its code. */
export function Lobby({ onHost, onJoin, onBack, error, busy, initialCode = '', era }: {
  /** the era chosen already, if any: a host without one picks it next */
  era?: boolean;
  onHost: () => void; onJoin: (code: string) => void; onBack: () => void; error?: string | null; busy?: boolean; initialCode?: string;
}) {
  const [code, setCode] = useState(initialCode);
  const ok = code.length === 5 && !busy;
  const commands: Command[] = [
    { keys: ['Enter'], label: busy ? 'Connecting…' : 'Join with Code', primary: true, disabled: !ok, onPress: () => onJoin(code) },
    { keys: ['H'], label: 'Host a Room', disabled: busy, onPress: onHost },
    { keys: ['Escape'], label: 'Back', onPress: onBack },
  ];
  return (
    <Frame title="Play a Friend" sub={era ? `${eraYears()} · two managers, one league` : 'Two managers, one league'} commands={commands}>
      <div className="lobby">
        <div className="win card">
          <h3>Host a room</h3>
          <p>{era ? 'Create your club' : 'Pick an era, create your club'} and get a five-letter code. Send it to a friend: they join with their own club, and the room uses your era and settings.</p>
          <p>You each draft in your own time and never get offered the same player. When you're both ready, you play the season.</p>
          <button className="go" onClick={onHost} disabled={busy} tabIndex={-1}>Host a Room</button>
        </div>
        <div className="win card">
          <h3>Join a room</h3>
          <p>Type the code your friend sent you.</p>
          <input className="name code" autoFocus value={code} maxLength={5} placeholder="CODE" onChange={(e) => setCode(normalizeCode(e.target.value))} />
          {error && <p className="err">{error}</p>}
          <button className="go" onClick={() => onJoin(code)} disabled={!ok} tabIndex={-1}>Join</button>
          <p>Left a room? Join it again with the same code on the same device to carry on.</p>
        </div>
      </div>
    </Frame>
  );
}

/** Waiting for the guest, with the code to share. */
export function RoomWaiting({ code, onLeave, joining }: { code: string; onLeave: () => void; joining?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}?room=${code}`;
  const copy = () => {
    void navigator.clipboard?.writeText(link).then(() => setCopied(true), () => {});
  };
  return (
    <Frame title={`Room ${code}`} sub={joining ? 'Joining…' : 'Waiting for your friend'} commands={[
      { keys: ['Enter'], label: copied ? 'Link Copied' : 'Copy Invite Link', primary: true, onPress: copy },
      { keys: ['Escape'], label: 'Leave Room', onPress: onLeave },
    ]}>
      <div className="lobby" style={{ gridTemplateColumns: '1fr' }}>
        <div className="win card" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p>{joining ? 'Joining the room…' : 'Send this code to your friend. They choose Play a Friend, then Join.'}</p>
          <div className="bigcode">{code}</div>
          {!joining && <p>Or send the link: {link}</p>}
          {!joining && <p>The draft starts as soon as they join.</p>}
        </div>
      </div>
    </Frame>
  );
}
