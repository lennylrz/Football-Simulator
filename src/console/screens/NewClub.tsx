import { useState } from 'react';
import type { ClubInfo } from '../../game/clubs';
import { seasonLabel } from '../../game/data';
import { FORMATION_NAMES, type Formation } from '../../game/positions';
import { Pitch } from '../Pitch';
import type { Settings } from '../../settings';
import { browse, type Command, Frame, KeyCap, Overlay } from '../ui';

const COLOURS: [string, string, string][] = [
  ['Navy and White', '#1d3f7a', '#ffffff'],
  ['Red and White', '#c8102e', '#ffffff'],
  ['Claret and Blue', '#7a1f3d', '#8fc8ef'],
  ['Black and Gold', '#151515', '#d4a017'],
  ['Green and White', '#0b6b3a', '#ffffff'],
  ['Sky and Navy', '#6cabdd', '#1c2c5b'],
  ['Orange and Black', '#e46a12', '#111111'],
  ['Purple and Gold', '#4b2a7a', '#f2c200'],
];

function codeOf(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  const code = words.length >= 3 ? words.slice(0, 3).map((w) => w[0]).join('') : (words[0] ?? 'XI').slice(0, 3);
  return code.toUpperCase().padEnd(3, 'X');
}

export function NewClub({ onStart, onBack, settings, room, busy }: {
  onStart: (club: ClubInfo, formation: Formation, seed: number, shared: boolean) => void; onBack: () => void; settings: Settings;
  /** creating a club to host or join a two-player room */
  room?: 'host' | 'guest';
  busy?: boolean;
}) {
  const [name, setName] = useState('Five Seasons FC');
  const [colour, setColour] = useState(0);
  const [formation, setFormation] = useState<Formation>('4-3-3');
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedText, setSeedText] = useState('');
  const [c0, c1, c2] = COLOURS[colour];
  const clubName = name.trim() || 'Five Seasons FC';
  const info: ClubInfo = { name: clubName, short: clubName.length > 16 ? codeOf(clubName) : clubName, code: codeOf(clubName), primary: c1, secondary: c2, rep: 72, budget: 0 };

  const start = () => {
    const parsed = Number.parseInt(seedText, 10);
    onStart(info, formation, Number.isFinite(parsed) ? parsed >>> 0 : Math.floor(Math.random() * 2 ** 32), Number.isFinite(parsed));
  };
  const fIndex = FORMATION_NAMES.indexOf(formation);
  const commands: Command[] = seedOpen
    ? [
        { keys: ['Enter'], label: 'Done', primary: true, onPress: () => setSeedOpen(false) },
        { keys: ['Escape'], label: 'Clear', onPress: () => { setSeedText(''); setSeedOpen(false); } },
      ]
    : [
        { keys: ['Enter'], label: busy ? 'Connecting…' : room === 'host' ? 'Create the Room' : room === 'guest' ? 'Join the Room' : 'Start the Draft', primary: true, disabled: busy, onPress: start },
        { keys: ['Q', 'E'], label: 'Colours', onPress: (k) => setColour((colour + (k === 'Q' ? -1 : 1) + COLOURS.length) % COLOURS.length) },
        browse('Formation', () => setFormation(FORMATION_NAMES[(fIndex + 4) % 5]), () => setFormation(FORMATION_NAMES[(fIndex + 1) % 5]), true),
        { keys: ['S'], label: 'Replay Seed', hidden: !!room, disabled: !!room, onPress: () => setSeedOpen(true) },
        { keys: ['Escape'], label: 'Back', onPress: onBack },
      ];

  return (
    <Frame club={info} title={clubName} sub={room === 'host' ? 'Play a Friend · host a room' : room === 'guest' ? 'Play a Friend · join a room' : 'New Career · the 21st club'} commands={commands}
      info={room ? <><span>Two managers</span><b>One league</b></> : <><span>Seed</span><b>{seedText || 'Random'}</b></>}>
      <div className="draft newclub">
        <Pitch formation={formation} plates={Array.from({ length: 11 }, () => ({ label: '', state: 'empty' as const }))} />
        <div className="win">
          <div className="win-title">Create Your Club</div>
          <div className="office" style={{ height: 170, gridTemplateColumns: '1fr' }}>
            <div className="col" style={{ gap: 8 }}>
              <span className="cap">Club name</span>
              <input
                className="name"
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) start(); } }}
              />
              <span className="kv"><span>Colours · {c0}</span>
                <span className="swatches">
                  {COLOURS.map(([n, a, b], i) => (
                    <button key={n} className={`sw ${i === colour ? 'on' : ''}`} style={{ background: `linear-gradient(90deg, ${a} 60%, ${b} 60%)` }} onClick={() => setColour(i)} tabIndex={-1} aria-label={n} />
                  ))}
                </span>
              </span>
            </div>
          </div>
          <div className="panes" style={{ gridTemplateColumns: '1fr' }}>
            <div className="pane dpanel">
              <div className="ph gbar">How it works</div>
              <div className="kvlist">
                <div><span>The league</span><b>{room ? 'Both clubs join' : 'Your XI joins'} the 20 clubs of {seasonLabel(0)}</b></div>
                <div><span>The draft</span><b>Pick 1 of {settings.choices} real players per position{settings.hiddenRatings ? ', ratings hidden' : ''}</b></div>
                <div><span>Each summer</span><b>{settings.redrafts ? `See who grew, gamble on ${settings.redrafts} re-draft${settings.redrafts > 1 ? 's' : ''}` : 'See who grew, no re-drafts'}</b></div>
                <div><span>Formation</span><b className="tabs" style={{ display: 'flex', gap: 4 }}>
                  <KeyCap k="Left" />
                  {FORMATION_NAMES.map((f) => (
                    <button key={f} className={`t ${f === formation ? 'on' : ''}`} onClick={() => setFormation(f)} tabIndex={-1} style={{ height: 30, padding: '0 14px', fontSize: 15 }}>{f}</button>
                  ))}
                  <KeyCap k="Right" />
                </b></div>
                <div className="head">The ultimate goal</div>
                <div><span>The Treble</span><b>League, FA Cup and Champions League</b></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {seedOpen && (
        <Overlay title="Replay a Seed">
          <div className="kvlist" style={{ padding: '18px 22px' }}>
            <div><span>The same seed and picks replay the same career.</span></div>
            <input autoFocus inputMode="numeric" value={seedText} placeholder="Random" className="name"
              onChange={(e) => setSeedText(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setSeedOpen(false); } }} />
          </div>
        </Overlay>
      )}
    </Frame>
  );
}
