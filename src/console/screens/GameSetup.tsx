import { DEFAULT_SETTINGS, OPTIONS, type Settings, step } from '../../settings';
import '../setup.css';
import { browse, type Command, Frame, KeyCap, useListNav } from '../ui';

/** Game settings, shown when the era is chosen and from its main menu. */
export function GameSetup({
  settings, onChange, onDone, onBack, hasSave,
}: { settings: Settings; onChange: (s: Settings) => void; onDone: () => void; onBack: () => void; hasSave: boolean }) {
  const nav = useListNav(OPTIONS.length);
  const opt = OPTIONS[nav.index];
  const change = (i: number, dir: 1 | -1) => onChange(step(settings, OPTIONS[i].key, dir));
  const isDefault = OPTIONS.every((o) => settings[o.key] === DEFAULT_SETTINGS[o.key]);

  const commands: Command[] = [
    { keys: ['Enter'], label: 'Continue', primary: true, onPress: onDone },
    browse('Setting', nav.up, nav.down),
    browse('Change', () => change(nav.index, -1), () => change(nav.index, 1), true),
    { keys: ['R'], label: 'Defaults', disabled: isDefault, onPress: () => onChange({ ...DEFAULT_SETTINGS }) },
    { keys: ['Escape'], label: 'All Eras', onPress: onBack },
  ];

  let group = '';
  return (
    <Frame title="Game Settings" sub="2015 – 2020 · Five Seasons" commands={commands} info={<>{isDefault ? 'Default settings' : 'Custom settings'}</>}>
      <div className="setup">
        <div className="win">
          <div className="win-title">Settings</div>
          <div className="rows dpanel">
            {OPTIONS.map((o, i) => {
              const head = o.group !== group ? (group = o.group) : null;
              const value = settings[o.key];
              const vals = o.values as unknown[];
              const at = vals.indexOf(value);
              return (
                <div key={o.key} className="srow-wrap">
                  {head && <div className="shead">{head}</div>}
                  <div className={`srow ${i === nav.index ? 'on' : ''}`} onMouseEnter={() => nav.setIndex(i)} onClick={() => nav.setIndex(i)}>
                    <span className="sl">{o.label}</span>
                    <span className="sv">
                      <button className="arr" disabled={at <= 0} onClick={() => change(i, -1)} tabIndex={-1} aria-label="Previous"><KeyCap k="Left" /></button>
                      <b>{(o.show as (v: unknown) => string)(value)}</b>
                      <button className="arr" disabled={at >= vals.length - 1} onClick={() => change(i, 1)} tabIndex={-1} aria-label="Next"><KeyCap k="Right" /></button>
                    </span>
                    {value !== DEFAULT_SETTINGS[o.key] && <span className="dot" title="Changed from default" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="win side">
          <div className="win-title">{opt.label}</div>
          <div className="office about">
            <span className="cap">{opt.group}</span>
            <p>{opt.desc}</p>
            <span className="kv"><span>Default</span><b>{(opt.show as (v: unknown) => string)(DEFAULT_SETTINGS[opt.key])}</b></span>
          </div>
          <div className="note">
            Settings are saved in this browser. {hasSave ? 'Your saved career follows them too: re-drafts from next summer, choices from the next pick.' : 'You can change them later from the main menu.'}
          </div>
        </div>
      </div>
    </Frame>
  );
}
