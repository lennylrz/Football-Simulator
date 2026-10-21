# Handoff: Five Seasons

Read this first in a new session. Repo: `lennylrz/Football-Simulator`. Work up
to the welcome screen is on `claude/continue-0sh3ao`; the fairness and controls
pass below is on `claude/wonderful-keller-ysc4qy` (no PR yet).

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

`Welcome` (site menu) → `Home` (era picker) → `GameSetup` (game settings, opens on era click; also a main menu tab) → `MainMenu` (2015 era, shattered-ball menu) →
`NewClub` → `Draft` → `Summer` → season viewer + `Results` → `Summer` …
→ `Summary`. Routing is in `src/App.tsx` (`mode` state + `game.stage`).

The welcome screen (`src/console/home/Welcome.tsx`, `welcome.css`): the
era home's paper/ink/blue look, a menu on the right (Singleplayer,
Multiplayer "coming soon", How to Play, Settings, About & Credits, Legal)
and the selected item's content on the left. Up/Down + Enter or mouse;
Settings takes focus for its rows (Esc back). Settings live in
`src/settings.ts` (own localStorage key, `OPTIONS` drives the settings
screen): ratings shown/hidden in the draft, pick timer (off by default;
auto-picks the highlighted card), choices per pick (3-5), re-drafts per
summer (default 2), match speed (normal/fast/instant), reduce motion
(`.calm` on `<html>`). Re-drafts and choices are career rules copied into
`GameState.rules` (new careers, and synced into the running one on change);
the rest is read live from `GameContext.settings`. The welcome screen's
Settings has reduce motion. Esc on the era home
with nothing hovered, or its "Main menu" link, goes back to the welcome.

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

## Fairness and controls pass (owner feedback: "far too random")

- No saved careers. No Continue: Esc in a career asks "Leave Career?" and
  leaving ends it (`quit` in `App.tsx`). `src/storage.ts` now only remembers
  the players offered in the last 3 careers; `drawCandidates` avoids them
  when others of the same kind exist (`GameState.recent`). A typed-in seed
  ignores that list so shared seeds replay exactly.
- Match engine (`ENGINE` in `match.ts`): season form sd 1.5 -> 0.6, match
  form sd 2 -> 1.5, attack/midfield weights up a little. Strength now
  predicts the table: the strongest XI on paper wins about half the time,
  2nd about a third, 3rd and below rarely.
- Drafted players keep the position they were drafted for (their listed
  positions change between FIFA editions, which used to put them out of
  position silently). Candidates are offered only in their main position
  (`fits` in `draft.ts`, with ST/CF, LB/LWB, LW/LM-style equivalents).
- Development (`development.ts`): real next-season rating, plus a form boost
  from last season (`formBoost`: average match rating against team-mates and
  half against the league, scaled by appearances, bigger for 23 and under,
  smaller for 31+ and 88+), deviation persists at 75%, noise sd 1 (5%
  chance of sd 2.5), and the game rating stays within -6/+7 of the real one
  (cap 96 unless the real rating is higher).
- Opening draft in any order: `chooseSlot`; offers per slot are kept in
  `DraftState.offers`, so switching never re-rolls. Each position can be
  re-drafted once a summer (`DraftState.redrafted`).
- UI: clicking a button never focuses it (fixes Enter/Space double actions);
  draft cards no longer move under the pointer; Enter/Esc work while typing
  the club name. Summer screen shows "On paper" rank (`paperTable` in
  `game.ts`), last season's Form per player and a Re-draft button per row.
  Season review shows the predicted finish. `SortTable` (click headers to
  sort) is used for squad stats, Club Legends and the Hall of Fame; Career
  Summary seasons open a Season Report.

## Second pass (bench, viewer, cups, development by age)

- Bench: after the XI the user drafts 3 substitutes (setting: 3 or 5,
  `rules.bench`). Spots 0-10 are the XI, 11+ the bench (`XI`, `isBench`,
  `inSpot`, `swapSpots` in `draft.ts`). Substitutes come from any outfield
  position, mostly prospects. Each player keeps the position he was drafted
  for (`DraftState.home`, used by `engineLite` in `game.ts`); moved
  elsewhere he plays out of position. Summer: Swap (S, or the row button)
  moves players between bench and XI for free; bench spots can be re-drafted.
- Engine: `ENGINE.rotation` (12%) rests a starter when the bench has someone
  for his position within `rotationGap` (12) points; a slot's strength is now
  the minutes-weighted rating of everyone who played there, so the bench
  counts.
- Development by age (`formBoost`): 20 and under x2 (cap +9), 21-23 x1.5
  (cap +6), plus 30% of the gap to potential when playing well; 27-30 move
  at most about 1 (half the real change, small noise); 31+ decline more
  than they improve. Under-24s may drift up to +12 above their real rating.
- Season viewer: no row animation, the user's match on top with WIN / DRAW /
  LOSS colours, cup days are their own steps (user's ties, semis, finals),
  Left/Right steps through days.
- Season review: separate Champions League and FA Cup tabs. CL: the user's
  group table and knockout ties, plus a bracket (`Bracket.tsx`, ties from
  `tiesOf` in `cups.ts`). FA Cup: the user's run and a bracket from the
  quarter-finals. Knockout pairings no longer reshuffle between rounds, so
  the bracket connects.

## Next task

None set. The welcome screen is done. Candidates from `docs/ROADMAP.md`:
daily draft, Ball Knowledge mode, Vercel deploy, real multiplayer.
