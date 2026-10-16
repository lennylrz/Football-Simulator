# Five Seasons

A football draft game for the browser. Create your own club, the 21st club
of the 2015/16 English top flight, and draft an XI of real players: for
each position you pick one of five, seeing only their 2015 rating and age.
Then play five seasons, 2015/16 to 2019/20.

- **The draft.** Strikers first, goalkeeper last. Each set of five mixes a
  star (sometimes), established players and youngsters. Who becomes great is
  down to your ball knowledge.
- **The season.** Every matchday's scores appear one by one, with your cup
  ties and a live table; pause, speed up or skip to the review. League, FA
  Cup and Champions League (top four qualify).
- **The summer.** Your players' new ratings are revealed (glow-ups and
  busts, from their real next FIFA rating plus noise). Gamble on up to three
  re-drafts: the player in that position leaves and you pick from five new
  candidates.
- **The goal.** The treble. Every run ends with a legacy score, your best
  and worst pick, and a share card.

Players develop as they really did, give or take: next season's real FIFA
rating is the expected value, with random noise around it.

## Development

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # unit and balancing tests (vitest)
npm run build     # static site in dist/
```

Vite, React, TypeScript, Vitest. No backend; the current run is saved in
localStorage. The interface is a fixed 1280x720 stage scaled to the window,
styled after the console football games of 2012-2015 (see
docs/design-2015-console.html and docs/ROADMAP.md), and fully playable from
the keyboard: the bar along the bottom lists the keys for each screen.

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
