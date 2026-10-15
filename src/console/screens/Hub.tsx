import { useMemo, useState } from 'react';
import { seasonLabel } from '../../game/game';
import { useGame } from '../../ui/context';
import '../hub.css';
import { calendar, currentStep, feature, headlines, hubDate, longDate, STEP_LABELS, stepDetail } from '../hub';
import { AroundTheLeague, closeCommand, HallOfFame } from '../overlays';
import { clubOf, type Command, Frame, KeyCap, money } from '../ui';

const SHORT: Record<string, string> = {
  'AFC Bournemouth': 'Bournemouth', 'Aston Villa': 'A. Villa', 'Crystal Palace': 'C. Palace', 'Manchester United': 'Man Utd',
  'Manchester City': 'Man City', 'Tottenham Hotspur': 'Spurs', 'West Bromwich Albion': 'West Brom', 'Southampton': 'Southamp.',
};

export function Hub({ onContinue, onMenu }: { onContinue: () => void; onMenu: () => void }) {
  const { data, game } = useGame();
  const [overlay, setOverlay] = useState<'around' | 'hall' | null>(null);
  const info = clubOf(data, game.user);
  const step = currentStep(game);
  const days = useMemo(() => calendar(game, data), [game, data]);
  const news = headlines(game, data);
  const feat = feature(game, data);
  const last = game.history[game.history.length - 1];
  const table = last
    ? last.table.map((r) => ({ club: r.club, p: r.p, pts: r.pts }))
    : data.meta.gameClubs.map((_, i) => ({ club: i, p: 0, pts: 0 }));
  const name = (c: number) => SHORT[data.meta.gameClubs[c]] ?? clubOf(data, c).short;

  const commands: Command[] = overlay
    ? closeCommand(() => setOverlay(null))
    : [
        { keys: ['Enter'], label: 'Continue', primary: true, onPress: onContinue },
        { keys: ['T'], label: 'Around the League', onPress: () => setOverlay('around') },
        { keys: ['H'], label: 'Hall of Fame', onPress: () => setOverlay('hall') },
        { keys: ['Escape'], label: 'Main Menu', onPress: onMenu },
      ];

  return (
    <Frame
      club={info}
      title={info.name}
      right={<><small>Season {game.season + 1} of 5</small>{seasonLabel(game.season)}</>}
      commands={commands}
      info={<><span>Budget</span><b>{money(game.clubs[game.user].cash)}</b></>}
    >
      <div className="hub">
        <div className="col1">
          <div className="date gbar">{longDate(hubDate(game.season))}</div>
          <button className="next ltile focus" onClick={onContinue} tabIndex={-1}>
            <span className="k">Next</span>
            <b>{STEP_LABELS[step]}</b>
            <span className="s">{stepDetail(game)}</span>
            <span className="go"><KeyCap k="Enter" primary />Continue</span>
          </button>
          <div className="steps">
            {STEP_LABELS.map((l, i) => (
              <div key={l} className={`st ${i < step ? 'done' : i === step ? 'on' : ''}`}>
                <i>{i < step ? '✓' : i + 1}</i>{l}
              </div>
            ))}
          </div>
          <div className="budget gbar"><span>Squad</span>{game.clubs[game.user].squad.length} players</div>
        </div>

        <div className="center">
          <div className="cal">
            {days.map((d) => (
              <div key={d.day} className={`day ${d.today ? 'today' : ''} ${d.match ? 'match' : ''}`}>
                <span className="dn gbar">{d.name}</span>
                <span className="db ltile"><span className="n">{d.day}</span>{d.match && <span className="opp">{d.match}</span>}</span>
              </div>
            ))}
          </div>
          <div className="bn gbar">Breaking News</div>
          <div className="story">
            <div className="feature">
              <div className="pic">
                <div className="figure"><span>{feat.label}</span><b>{feat.figure}</b><em>{feat.sub}</em></div>
              </div>
              <div className="cap">{feat.caption}</div>
            </div>
            <div className="side">
              {[0, 1, 2].map((i) => {
                const h = news[i];
                if (!h) return <div key={i} className="item blank" />;
                return (
                  <div key={i} className={`item ${i === 1 ? 'dark' : 'ltile'}`}>
                    <span className="dt">{h.date}</span>
                    {h.tag && <span className="ex">{h.tag}</span>}
                    {h.text}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="table">
          <div className="th gbar">{last ? `Final Table ${seasonLabel(last.season)}` : 'English League'}</div>
          <div className="cols"><span>P</span><span>PTS</span></div>
          <div className="rows">
            {table.map((r, i) => (
              <div key={r.club} className={`row ${i < 4 ? 'cl' : i === 4 ? 'el' : i >= 17 ? 'rel' : ''} ${r.club === game.user ? 'me' : ''}`}>
                <span>{i + 1}</span><span>{name(r.club)}</span><span className="r">{r.p}</span><span className="r">{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {overlay === 'around' && <AroundTheLeague game={game} data={data} />}
      {overlay === 'hall' && <HallOfFame game={game} data={data} />}
    </Frame>
  );
}
