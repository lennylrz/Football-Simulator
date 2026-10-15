# Five Seasons

A compressed football manager for the browser. Pick one of the 20 English
top-flight clubs of summer 2015 and manage it for five seasons, 2015/16 to
2019/20. A run takes about ten minutes and ends with a share card.

Each season:

1. **Transfer window.** Five players are offered to you, drawn from the
   market around what your club's reputation can attract. Sell anyone to
   AI clubs or clubs abroad. Rival clubs shop too: on deadline day your
   unsigned targets may be gone.
2. **Team selection.** Five formations; players out of position are
   penalised.
3. **Season.** One click plays the league, the FA Cup and the Champions
   League (top four qualify). Then: table, every result, cup runs, league
   leaders and your squad's stats.

The headline goal is the treble. It is hard even with the strongest squad.
The Hall of Fame (🏆 in the header) tracks your trophies, best players,
player of the career and best and worst signings at any point.

Players develop as they really did, give or take: next season's real FIFA
rating is the expected value, with random noise around it.

## Development

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # unit and balancing tests (vitest)
npm run build     # static site in dist/
```

Vite, React, TypeScript, Tailwind, Vitest. No backend; the current run is
saved in localStorage.

## Data

Player data comes from the "FIFA 23 complete player dataset" (Stefano Leone,
Kaggle, CC0): FIFA 16 ratings for 2015/16 through FIFA 20 for 2019/20.

```sh
scripts/fetch_data.sh             # Kaggle CLI -> data/raw/ (gitignored)
python3 scripts/process_data.py   # -> public/data/*.json (committed, ~1.1 MB)
```

See [docs/DATA.md](docs/DATA.md) for what is extracted and a summary.

## How it works

- `src/game/match.ts`: team strength by area (GK, defence, midfield,
  attack) from the XI with positional fit; Poisson goals with home
  advantage, match form and season-long form; goals, assists and match
  ratings per player. Seeded RNG: the same seed, club and decisions replay a
  run.
- `src/game/development.ts`: season-to-season ratings from the next FIFA
  edition plus noise (sd 2, occasionally 5); without a next row, the average
  change for the player's age, and likely retirement for older players.
- `src/game/ai.ts`: AI clubs patch their weakest position within budget and
  within what their reputation can attract, sell surplus players, and lose
  stars to clubs abroad. Reputation and income follow results.
- `src/game/cups.ts`: FA Cup from the third round and a 32-team Champions
  League. Clubs outside the 20 play at their real squad strength.
- Balancing tests (`src/game/*.test.ts`) simulate hundreds of seasons and
  check champions, points, goals, home wins, top scorers, Champions League
  share and treble rarity against real ranges.

## Deploy

Static site: on Vercel, import the repository with the Vite preset (build
`npm run build`, output `dist`).

## Legal

Unofficial fan game, not affiliated with any league, club or EA. Real
player and club names, plain club colours only: no crests, kits or league
branding.
