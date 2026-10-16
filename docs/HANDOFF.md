# Handoff: Five Seasons

Read this first in a new session. Repo: `lennylrz/Football-Simulator`, branch
`claude/continue-0sh3ao` (all work so far is pushed there; no PR yet).

## What the game is

A browser football draft game, laptop-first. The user creates their own
club (the 21st club of the 2015/16 English top flight), drafts an XI one
position at a time (pick 1 of 5 real players, 2015 rating and age shown,
potential hidden), then plays five seasons 2015/16 to 2019/20. Each
summer reveals rating changes (glow-ups and busts, from real next-season
FIFA ratings plus noise) and allows up to 3 re-draft gambles. Seasons play
out matchday by matchday (pause, fast, skip). League, FA Cup and Champions
League; the treble is the headline goal and deliberately rare. Ends with a
legacy score, best/worst pick, Hall of Fame and a share card.

## Screen flow today

`Home` (era picker) → `MainMenu` (2015 era, shattered-ball menu) →
`NewClub` → `Draft` → `Summer` → season viewer + `Results` → `Summer` …
→ `Summary`. Routing is in `src/App.tsx` (`mode` state + `game.stage`).

The era home (`src/console/home/`): clean paper/ink/blue look by default;
hovering an era panel (2000-2005, 2005-2010, 2010-2015, 2015-2020,
2020-now) cross-fades the whole screen into that era's style and restyles
the panels. Only 2015-2020 is playable.

## Code map

- `src/game/`: all game logic, framework-free and unit-tested.
  `draft.ts` (draft mode), `game.ts` (state, season flow, 21st club via
  `registerUserClub`), `match.ts`/`season.ts` (engine), `cups.ts`, `ai.ts`
  (AI transfers), `development.ts`, `career.ts` (stats, legacy score).
  The older management mode (offers/bids/squad of 26) still lives in
  `market.ts`/`game.ts` and its tests but is not in the UI.
- `src/console/`: the UI. Everything renders on a fixed 1280x720 stage
  scaled to the window (`Stage` in `ui.tsx`). `Frame` = club-colour header
  + body + command bar. `CommandBar`/`useCommands` = keyboard keycaps that
  are also clickable; every screen declares its commands there.
- `src/index.css`: the 2015 console look (glossy split bars `.gbar`, grey
  tiles `.ltile`, navy windows `.win`, tables `.tbl`, keycaps `.key`).
- `public/data/*.json`: processed player data (FIFA 16-20 from the Kaggle
  "FIFA 23 complete player dataset"); see `docs/DATA.md`.

## Commands

```sh
npm install
npm run dev          # local dev server
npx vitest run       # 19 tests incl. balancing (~1 min)
npx tsc -b && npx eslint .
npm run build
node scripts/build_single.mjs <out.html>   # one-file build with data inlined
```

The owner tests via a private claude.ai artifact built with
`build_single.mjs`: https://claude.ai/artifact/JW7U7s7sS78tim68rTKBJj
(republish the single file to that same URL so the link stays the same).
Browser checks: Playwright with Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, viewport 1440x900.

## Owner's preferences (keep these)

- Laptop-first; keyboard-driven with the command bar.
- No crests, kits, league or publisher branding, no fake badges, no player
  silhouettes, no emoji in the UI. Real player and club names are fine.
- Calm screens: not overwhelming, few decisions at a time, rewarding
  reveals. Virality and "ball knowledge" matter.
- Era styles must look intentionally vintage, never cheap. 2015 = FIFA 13
  era console menus (see `docs/design-2015-console.html`).
- Long-term plan in `docs/ROADMAP.md`: more eras/start years, daily draft,
  leaderboard, Ball Knowledge mode (ratings hidden), friend challenges.
- Vercel is not connected yet; the owner will import the repo at
  vercel.com/new (team "PingPong Ltd") or say "you do it".

## Next task

Add a **welcome screen before the era home**, so the site works like a
proper game website:

- Main options: **Singleplayer** (goes to the era home), **Multiplayer**
  (placeholder: "coming soon", no functionality), and the classic items:
  e.g. How to Play, Settings, Credits/About, and legal (unofficial fan
  game, data source CC0).
- Its own clean style, consistent with the era home's default look
  (paper, ink, one blue), keyboard and mouse.
- Keep the existing save/continue behaviour working; update the
  Playwright flows and keep all tests passing.
- Commit and push to `claude/continue-0sh3ao`, rebuild the single file
  and republish to the artifact URL above.
