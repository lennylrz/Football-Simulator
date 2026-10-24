# Five Seasons

A football draft game for the browser. Pick an era (2010-2015 or 2015-2020;
2020-2025 has its data but is not open yet), create your own club, the 21st club of that era's English top
flight, and draft an XI of real players: for each position you pick one of
five, seeing only their rating and age at the start. Then play five seasons.

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
- **Play styles.** Tiki-Taka, Through the Star, Park the Bus or Gegenpress,
  chosen with your club and changeable each summer. A style shifts how many
  goals your matches have, who scores them, and whose good seasons turn into
  the biggest rating gains; none is better overall.
- **The season review.** A few lines on how your season went, your player of
  the season, the Ballon d'Or podium and the Golden Boot. Click a player (here,
  in the Squad tab or the Hall of Fame) for his card: rating over the career,
  season by season, awards.
- **The goal.** The treble. Every run ends with a legacy score, your best
  and worst pick, and a share card.

Players develop as they really did, give or take: next season's real FIFA
rating is the expected value, with random noise around it.

## Daily Challenge

One challenge a day, the same for everyone (welcome screen, Daily Challenge):
the day's seed, era and rule come from a list of 20 by day number
(`src/game/daily.ts`; day 1 is 23 October 2026, days turn at local
midnight). Rules filter who the draft offers (only Portugal, kids only,
Real Madrid's squad, Bundesliga XI...), change the career's rules (two
choices, ratings hidden, no re-drafts, a locked play style) or set a target
(top half every season, win the league, finish above a rival). One attempt:
starting the draft uses it up. The career summary shows a result to copy,

```
Five Seasons Daily #12 · One club men
3rd 1st🏆 2nd 1st🏆🏆 4th
Legacy 11,250
```

and sends the score to the day's leaderboard (`daily_scores` in the
Supabase project, append-only like the room tables: one row per browser per
day). When a rule leaves too few players for a pick, older and lower-rated
players count, then the same line of the team, and only then does the rule
bend for that pick.

## Play a Friend

Two-player rooms (main menu, Play a Friend). The host creates a club and gets
a five-letter code (or an invite link, `?room=CODE`); the guest joins with
their own club. Both draft in their own time and are never offered the same
player, then press Ready; the host plays the season. Both clubs join the
league (22 clubs), each manager can look at the other's lineup and their
head-to-heads (V), and matches between them are played out minute by minute.

Rooms live in a Supabase project (`five-seasons`): a `rooms` row (era, seed,
the host's rules and club) and an append-only `room_actions` log. Each
browser replays the log, in order, through the same game engine
(`src/game/actions.ts`), so both always agree; anyone with the code can read
a room and add moves, nothing can be changed or deleted. A browser keeps its
player id in localStorage, so leaving and joining again with the code carries
on.

## Development

```sh
npm install
npm run dev       # http://localhost:5173
npm test          # unit and balancing tests (vitest)
npm run build     # static site in dist/
```

Vite, React, TypeScript, Vitest. No backend and no saved careers: leaving a
career ends it. Settings and the players offered in recent careers (so new
drafts bring new faces) are kept in localStorage. The interface is a fixed 1280x720 stage scaled to the window,
styled after the console football games of 2012-2015 (see
docs/design-2015-console.html and docs/ROADMAP.md), and fully playable from
the keyboard: the bar along the bottom lists the keys for each screen.

## Data

Player data comes from Kaggle datasets: FIFA 11-15 ratings from the European
Soccer Database (Hugo Mathien, ODbL) and FIFA 15, FIFA 16-20 from the "FIFA 23
complete player dataset" (Stefano Leone, CC0), FIFA 21-FC 24 from his "EA
Sports FC 24 complete player dataset" (CC0) and FC 25 from the "EA Sports FC
25 database" (nyagami, Apache 2.0).

```sh
scripts/fetch_data.sh                  # Kaggle CLI -> data/raw/ (gitignored)
python3 scripts/process_data.py        # -> public/data/<era>/*.json (committed, ~1 MB each)
python3 scripts/process_data.py 2020   # one era only
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
`npm run build`, output `dist`). The build also writes `dist/daily.html`, the
same page with the Daily Challenge's link preview, and `vercel.json` serves it
at `/daily`, the link the daily result ends with. Link preview images and app
icons are in `public/` (`og.png`, `og-daily.png`, `icon-*.png`).

On phones the game is the same 1280x720 screen: held sideways it fills the
screen; held upright a card asks to turn the phone, then the game is drawn
sideways (Android also goes full screen in landscape). On touch screens the
first tap on a draft card, era or menu item selects it and the second acts.

## Legal

Unofficial fan game, not affiliated with any league, club or EA. Real
player and club names, plain club colours only: no crests, kits or league
branding.
