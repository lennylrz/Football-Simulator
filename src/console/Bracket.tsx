import { type CupMatch, type Entrant, type Tie, tiesOf } from '../game/cups';

/**
 * Knockout rounds side by side, each tie lined up between the two it came
 * from. The user's club and its path are highlighted.
 */
export function Bracket({ matches, rounds, user, name }: { matches: CupMatch[]; rounds: string[]; user: number; name: (e: Entrant) => string }) {
  const cols = rounds.map((r) => tiesOf(matches, r));
  const side = (t: Tie, team: Entrant, goals: number) => (
    <div className={`bt ${t.winner === team ? 'won' : 'lost'} ${team === user ? 'me' : ''}`}>
      <span className="nm">{name(team)}</span>
      <b>{goals}{t.pens && t.winner === team ? '*' : ''}</b>
    </div>
  );
  return (
    <div className="bracket" style={{ gridTemplateColumns: `repeat(${rounds.length}, 1fr)` }}>
      {cols.map((ties, c) => (
        <div key={rounds[c]} className={`bcol ${ties.length > 4 ? 'dense' : ''}`}>
          <div className="bhead">{rounds[c]}</div>
          <div className="bties">
            {ties.map((t, k) => (
              <div
                key={k}
                className={`btie ${t.a === user || t.b === user ? 'mine' : ''}`}
                title={t.legs.map((m) => `${name(m.home)} ${m.hg}–${m.ag} ${name(m.away)}${m.pens !== undefined ? ' (pens)' : ''}`).join('\n')}
              >
                {side(t, t.a, t.ga)}
                {side(t, t.b, t.gb)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
