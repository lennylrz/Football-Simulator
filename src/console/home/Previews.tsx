// Static previews of each era's look, drawn at 1280x720.
import '../draft.css';
import './previews.css';

const CANDS: [number, string, string, string, number][] = [
  [77, 'A. Milik', 'Ajax', 'Poland', 21],
  [80, 'Paco Alcácer', 'Valencia CF', 'Spain', 21],
  [85, 'E. Cavani', 'Paris Saint-Germain', 'Uruguay', 28],
  [75, 'D. Pabón', 'CF Monterrey', 'Colombia', 27],
  [82, 'R. Sterling', 'Manchester City', 'England', 20],
];

function P2000() {
  const rows: [string, string, number, string, number, string][] = [
    ['Henry, Thierry', 'ST', 23, 'Arsenal', 88, '£24.0m'],
    ['Figo, Luís', 'RM', 28, 'Barcelona', 90, '£37.0m'],
    ['Nesta, Alessandro', 'CB', 24, 'Lazio', 89, '£21.5m'],
    ['Gerrard, Steven', 'CM', 20, 'Liverpool', 74, '£6.0m'],
    ['Ronaldinho', 'AM', 20, 'Grêmio', 78, '£4.5m'],
    ['Buffon, Gianluigi', 'GK', 22, 'Parma', 86, '£18.0m'],
  ];
  return (
    <div className="pv pv-2000">
      <div className="w">
        <div className="t"><span>Five Seasons 2000 — Transfer Window</span><i><span>_</span><span>□</span><span>×</span></i></div>
        <div className="m"><span><u>G</u>ame</span><span><u>S</u>quad</span><span><u>T</u>ransfers</span><span><u>F</u>ixtures</span><span><u>H</u>elp</span></div>
        <div className="b">
          <div className="side">
            <span className="btn">1. Squad</span><span className="btn on">2. Draft</span><span className="btn">3. Tactics</span><span className="btn">4. Continue</span>
          </div>
          <div className="panel">
            <table>
              <thead><tr><th>Name</th><th>Pos</th><th className="r">Age</th><th>Club</th><th className="r">Ovr</th><th className="r">Value</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r[0]} className={i === 0 ? 'sel' : ''}><td>{r[0]}</td><td>{r[1]}</td><td className="r">{r[2]}</td><td>{r[3]}</td><td className="r">{r[4]}</td><td className="r">{r[5]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="s"><span>Transfer window open</span><span>Season 2000/01</span><span>Processing…</span></div>
      </div>
    </div>
  );
}

function P2005() {
  return (
    <div className="pv pv-2005">
      <div className="logo">FIVE SEASONS<small>2005 · 2010</small></div>
      <div className="pills">
        <div className="pill on">Start Draft</div>
        <div className="pill">Load Career</div>
        <div className="pill">Hall of Fame</div>
        <div className="pill">Options</div>
      </div>
      <div className="orb" />
      <div className="bar"><span><b>A</b> Select</span><span><b>B</b> Back</span><span style={{ marginLeft: 'auto' }}>Memory card: 1 career saved</span></div>
    </div>
  );
}

function P2010() {
  return (
    <div className="pv pv-2010">
      <div className="crumb">Career · Transfers</div>
      <h3>The Draft</h3>
      <div className="grid">
        <div className="tile big">
          <small>Choose your striker</small>
          <div>
            <div className="row"><span>83 · Higuaín</span><span>Napoli</span></div>
            <div className="row"><span>80 · Lewandowski</span><span>Dortmund</span></div>
            <div className="row"><span>72 · Lukaku</span><span>Chelsea</span></div>
          </div>
          <span>Pick one of five. The future is up to you.</span>
        </div>
        <div className="tile" style={{ '--t': '#0c8f7a' } as React.CSSProperties}><small>Season</small><b>2010/11</b><span>Five to play</span></div>
        <div className="tile" style={{ '--t': '#b8432f' } as React.CSSProperties}><small>Around the league</small><b>10</b><span>Biggest deals</span></div>
        <div className="tile" style={{ '--t': '#5a3fb0' } as React.CSSProperties}><small>Your XI</small><b>0 / 11</b><span>Drafted so far</span></div>
        <div className="tile" style={{ '--t': '#2b3c58' } as React.CSSProperties}><small>Hall of Fame</small><b>0</b><span>The treble awaits</span></div>
      </div>
    </div>
  );
}

function P2015() {
  return (
    <div className="pv stage dark" style={{ '--s': 1 } as React.CSSProperties}>
      <div className="f-head" style={{ '--club-bar': 'linear-gradient(180deg, #9b4a65 0%, #7a1f3d 48%, #561629 52%, #6b1b36 100%)' } as React.CSSProperties}>
        Hindsight United<span className="sub">The Draft · Pick 1 of 11</span><span className="right"><small>Season 1 of 5</small>2015/16</span>
      </div>
      <div className="f-body">
        <div className="win" style={{ height: '100%' }}>
          <div className="win-title">Choose Your Striker</div>
          <div className="cards5">
            {CANDS.map(([r, n, c, nat, age], i) => (
              <div key={n} className={`ccard ${i === 2 ? 'on' : ''}`} style={{ opacity: 1, animation: 'none' }}>
                <div className="top"><span className="r">{r}</span><span className="pos">ST</span></div>
                <div className="band"><b>{n}</b></div>
                <div className="meta">
                  <div className="line"><b>{age}</b> years old</div>
                  <div className="line">{nat}</div>
                  <div className="line club">{c}</div>
                </div>
                <span className="tagline">{age <= 21 ? 'One for the future?' : r >= 84 ? 'World class' : 'In his prime'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cmdbar">
        <div className="hints">
          <span className="hint"><span className="keys"><span className="key primary">ENTER</span></span>Pick</span>
          <span className="hint"><span className="keys"><span className="key">‹</span><span className="key">›</span></span>Browse</span>
        </div>
        <div className="info"><span>Choose</span><b>Striker</b></div>
      </div>
    </div>
  );
}

function P2020() {
  return (
    <div className="pv pv-2020">
      <div className="top"><i />Your Club<span>2020/21 · Draft 1 of 11</span></div>
      <div className="body">
        <h4>Choose your striker</h4>
        <p>Five players, one pick. Who will be great in 2025?</p>
        <div className="cards">
          {[['E. Haaland', 'Borussia Dortmund · 20', 84], ['H. Kane', 'Tottenham · 27', 88], ['V. Osimhen', 'Napoli · 21', 78], ['O. Watkins', 'Aston Villa · 24', 75]].map(([n, c, o], i) => (
            <div key={n as string} className="card">
              <div><div className="n">{n}</div><div className="c">{c}</div></div>
              <span className="o">{o}</span>
              <span className="btn" style={i === 0 ? undefined : { background: '#f0f2f5', color: '#111418' }}>Pick</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const PREVIEWS = { 2000: P2000, 2005: P2005, 2010: P2010, 2015: P2015, 2020: P2020 } as const;

export function Preview({ era, width }: { era: keyof typeof PREVIEWS; width: number }) {
  const Comp = PREVIEWS[era];
  const s = width / 1280;
  return (
    <div style={{ position: 'relative', width, height: width * 0.5625, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${s})`, transformOrigin: '0 0', width: 1280, height: 720 }}>
        <Comp />
      </div>
    </div>
  );
}
