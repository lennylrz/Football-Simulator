# Handoff: Five Seasons

Read this first in a new session. Repo: `lennylrz/Football-Simulator`.
PR #9 is merged to `main` and live at
https://five-seasons-football.vercel.app (Vercel project `five-seasons`,
team "PingPong Ltd"; every merge to `main` deploys to production). The
owner tests on the live site, so changes reach them only once merged.
Always ask before merging. The five tasks the owner set after PR #9 are done
on branch `claude/wizardly-meitner-j6p00i` (see "Done since PR #9").

## What the game is

A browser football draft game, laptop-first, played on a train in ~10
minutes. Pick an era, create a club (the 21st club of that era's English
top flight), draft an XI plus bench one position at a time (pick 1 of 5
real players, era rating and age shown, potential hidden), then play five
seasons. Each summer reveals rating changes (real next-season FIFA ratings
plus form and noise) and allows re-draft gambles. League, FA Cup and
Champions League; the treble is the headline goal and deliberately rare.
Ends with a legacy score, Hall of Fame and a share card. Two-player rooms
("Play a Friend") share one league.

## Screen flow

`Welcome` (Singleplayer, Multiplayer, How to Play, Settings, ...) → `Home`
(era picker; hovering an era cross-fades the screen into its look) →
`GameSetup` (settings; Enter = New Career) → `NewClub` (name, colours,
formation, play style) → `Draft` (opens on an empty pitch: click where to
start) → `Summer` (squad, re-drafts, swaps, star pick, dressing-room notes)
→ season viewer + `Results` (season review: story, table, matches, cups,
awards) → `Summer` ... → `Summary` (career summary + share card). The old
second main menu (`MainMenu`) was removed. Routing: `src/App.tsx` (`mode`
state + `game.stage`). Multiplayer: `Lobby` → `NewClub` (room) →
`RoomSession`.

## Eras and looks

- Data for 2010, 2015 and 2020 (`public/data/<era>/`, see `docs/DATA.md`).
  2000 and 2005 show "Coming later".
- Theme per era via `ThemeContext` in `src/console/ui.tsx`, set in
  `App.tsx` (`era === 2015 ? 'sl' : ''`) and applied as a class on `.stage`.
  - 2010-2015: the 2012-15 console look (`src/index.css` + screen sheets:
    glossy bars, grey tiles, navy windows, white cards).
  - 2015-2020: "Slate", the FIFA 17-19 career hub (`src/console/slate.css`,
    every rule scoped under `.stage.sl`): slate-blue screen, dark glass
    panels, Barlow / Barlow Condensed, cream selection bar, amber accent,
    ratings coloured by tier, grass pitch. The 2015 draft has its own
    layout (`SlHub` in `screens/Draft.tsx`: shortlist + overview with the
    scouting blurb). No kits, crests or club colours on players (only
    English clubs have colour data; the owner rejected grey placeholders).
  - 2020-2025: plays with the console look today; its own modern design is
    not done (see tasks).
- Era previews on the era picker: `src/console/home/Previews.tsx`.
- The design canvas with all explored looks (A-D, E, round 3 F-I):
  https://claude.ai/artifact/T2d4jABgw8U8463EFhPED8 (the owner picked G,
  "Slate", after rejecting the dark "Night" and "Editorial" looks as too
  dark and not football-like).

## Code map

- `src/game/` (framework-free, unit-tested):
  - `game.ts` state, season flow, `simulate`, `advancePlayers`, `starOf`.
  - `draft.ts` draft mode (offers, re-drafts, swaps). `actions.ts` the
    action log both single player and rooms go through (`applyAction`).
  - `match.ts` / `season.ts` engine (`ENGINE` constants). `cups.ts`.
  - `development.ts` growth: `formBoost` (judged against team-mates and
    the player's own area via `areaPar`), `topDamp` above 90, exceptions:
    Messi 158023 and Ronaldo 20801 (`GOATS`, ceiling 98, Ballon d'Or bonus
    in `awards.ts`), Neymar 190871 (ceiling 96). `BUILT_ON_ROOM`: a bus
    back line or a defender star gets more room at the top.
  - `styles.ts` play styles (Tiki-Taka, Through the Star, Park the Bus,
    Gegenpress); `STAR_ROLES`: the star (picked by the manager, action
    `{ t: 'star', player }`) scores if a forward, creates if a midfielder,
    leads the defence if a defender/keeper.
  - `awards.ts` (Player of the Season, Ballon d'Or), `story.ts` +
    `storyText.ts` (end-of-season story, ~850 templates, no repeats within
    a career), `squadStories.ts` (summer dressing-room notes), `blurbs.ts`
    + `blurbData.ts` (scouting blurbs: hand-written for ~37 stars per era,
    archetypes for the rest), `career.ts` (legacy score, Hall of Fame).
- `src/net/` Supabase rooms (project `ehmghfdaagfgzhglrifm`, anon key in
  `room.ts`; tables are append-only action logs, RLS allows select and
  insert). The sandbox blocks supabase.co, so tests stub the REST calls.
- `src/console/` UI on a fixed 1280x720 `Stage` scaled to the window.
  `Frame` = header + body + `CommandBar` (keycaps that are also
  clickable). Overlays: `overlays.tsx` (Hall of Fame, transfers, season
  report), `awards.tsx` (story, awards, `PlayerCard` with rating graph),
  `room.tsx` (rival lineup, live head-to-head).
- `src/ui/shareCard.ts` share image (console and Slate variants).

## Commands

```sh
npm install
npm run dev                 # vite dev server
npx tsc -b && npx eslint src
npx vitest run              # 14 files, ~110 tests incl. balance and every daily (~3 min)
npm run build
```

Browser checks: Playwright (global install, `require('/opt/node22/lib/node_modules/playwright')`),
Chromium preinstalled; drive the game with the keyboard (Enter through the
welcome, era picker and settings) and screenshot each screen.

## Balance (measured, keep it)

The owner says the difficulty is perfect: keep the drafted club's title
rate ~11%, Champions League win rate ~1%, treble ~0.1% per season. Any
engine change must be re-measured over many careers (a scripted manager
drafting the best-rated candidate). Last measured: 100+ point seasons
19%, 40+ goal top scorer 6%, ~1 player rated 92+ at career end outside
the exceptions; best Park the Bus defender ~91-92, up to 94-96.

## Owner's preferences

- Laptop-first; keyboard and mouse both must work everywhere.
- Minimal text: no explanatory notes on screens; calm, few decisions at a
  time, rewarding reveals. Nothing dismissive about players ("no growth
  left", "finished", "past it" are banned in generated text).
- Era looks must feel like football games of that time and never cheap or
  "AI-made"; not too dark, not childish or neon.
- No kits or club colours on players unless every club has real colours.
- Surgical balance changes only; never cap anything, keep everything possible.

## Done since PR #9

1. **No black bars.** `Stage` (`ui.tsx`) makes `.stage` the window's size
   and centres the 1280x720 content in `.stage-in`; `--bx`/`--by` are the
   extra room each side and `inset: var(--bleed)` takes a full-screen layer
   to the window's edges (overlays, the season reveal, the console command
   bar, the welcome grid, the era previews, the season moments).
   `OnStage` portals overlays straight onto the stage so they cover the
   header too. `StageSize` gives the stage's size in stage pixels.
2. **2020-2025 is "Coming later"** (`ERAS` in `Home.tsx`, `live: false`).
   Room hosts pick their era on the same screen.
3. **Visual sweep**, both themes, with a Playwright script that plays whole
   careers and flags clipped or truncated text. Fixed: the review's trophy
   row (the window title now says it: "League Champions", "The Double",
   gold band), the summer table (all eleven fit; dressing-room notes show
   one at a time), delta badges at the touchlines, cup-run columns, the
   round of 16 bracket in Slate, Hall of Fame width, season report labels,
   the room's summer command bar. A user club can no longer take a real
   club's name (`uniqueClub` in `game.ts`; it confused name-based lookups).
4. **Winning feels like winning** (`console/moments.tsx`, `moments.css`,
   `console/FinalDay.tsx`): a flash, confetti and a stamp in the viewer when
   the title is clinched or a final won; the season's moments after the
   last matchday (each trophy, the double/treble, a Ballon d'Or place, the
   player of the season), which move on by themselves; the last matchday
   played live when the title is within three points; summer ratings tick
   up from last season's (`Tick` in `Pitch.tsx`) and big glow-ups light
   their plate. Console: gold gloss, rays, ticker tape in club colours.
   Slate: amber sweep, settling caps, gold flakes. Reduce Motion keeps the
   moments and drops the movement.
5. **Daily Challenge** (`game/daily.ts`, `net/daily.ts`, welcome menu,
   summary). The 20 challenges below are all in, in that order by day
   number (day 1 = 23 Oct 2026, local midnight). Candidate filters go
   through `allowedFor`/`poolFor` in `draft.ts` (widen: older and
   lower-rated, then the same line of the team, then bend the rule for that
   pick). Real Madrid, the underdog and the rival are done as squad
   filters (draft only from that squad), not as managing a real club. One
   attempt per browser (`storage.ts`), leaderboard in Supabase
   `daily_scores` (insert + select RLS, unique per day and browser id).
   `daily.test.ts` drafts every challenge, by best rating and by first
   candidate, and plays it through.

## Done after PR #10 (making it shareable)

- **Phones.** The stage is centred by its middle (`.stage-wrap > .stage`),
  which also fixed windows smaller than 1280x720 (the stage used to sit
  off-centre and clipped). On a phone held upright (`phoneUpright` in
  `ui.tsx`) the stage is turned 90 degrees after a card (`TurnPhone.tsx`)
  asks to turn the phone; Play tries full screen and a landscape lock
  (Android). Safe-area insets keep content clear of the notch. On touch, a
  first tap selects where hovering would preview (`touchTap`, `onHover`).
  The confetti canvas sizes itself through the stage's scale.
- **`/daily`** opens the welcome screen on today's challenge (`DAILY_LINK`
  in `App.tsx`); `vercel.json` rewrites it to `daily.html`, which
  `vite.config.ts` writes at build with the Daily Challenge's link preview.
  The result text ends with that link; on phones the result button opens
  the share sheet (`shareText`). Before playing, the panel shows how many
  have played today and the best score.
- **Link previews and icons**: Open Graph and Twitter tags in `index.html`
  (absolute URLs on five-seasons-football.vercel.app), `public/og.png`,
  `public/og-daily.png`, icons and `manifest.webmanifest` (no emoji
  favicon any more). The images were rendered from an HTML design with
  Playwright from `scripts/og.html` (`node scripts/render_og.cjs`).

## Next tasks

None set by the owner yet. Open points worth raising:

- The leaderboard trusts the browser, like the rooms: anyone with the
  public key could post a made-up score. Fine for friends; a server-side
  replay of the seed and picks would make it honest.
- Club names on the board are free text (40 characters max), unfiltered.
- "Galácticos" and "The rival" draft from the real squad rather than
  managing the real club with its squad (the engine's real-club mode would
  need a UI for it).

### The 20 daily challenges (built)

As they read in the game (`CHALLENGES` in `src/game/daily.ts`), with their era:

1. **Only Portugal** (2015-2020): Every player is Portuguese.
2. **Kids only** (2015-2020): Every player is 21 or under at the start.
3. **Old guard** (2010-2015): Every player is 30 or over at the start.
4. **Galácticos in England** (2015-2020): Real Madrid's squad only, in the Premier League.
5. **The underdog** (2010-2015): Draft from the five weakest squads. No re-drafts. Target: top half every season.
6. **Only Brazil** (2010-2015): Every player is Brazilian.
7. **Bargain bin** (2015-2020): Every player is valued under €5m.
8. **Two choices** (2010-2015): Two candidates per pick, not five.
9. **Blind draft** (2015-2020): Ratings hidden in every draft.
10. **Bundesliga XI** (2015-2020): Every player plays in Germany.
11. **Park the Bus or bust** (2010-2015): Park the Bus all career. Target: win the league.
12. **One club men** (2015-2020): Defence from Juventus, midfield from Bayern, attack from PSG.
13. **Only Spain** (2010-2015): Every player is Spanish.
14. **No re-drafts** (2015-2020): The XI you draft is the XI you keep.
15. **Star system** (2010-2015): Through the Star, with a star under 23.
16. **Home-grown** (2015-2020): Every player is English.
17. **Serie A XI** (2010-2015): Every player plays in Italy.
18. **Rated 75-80** (2015-2020): Every player is rated 75 to 80 when offered.
19. **The rival** (2010-2015): Arsenal's squad only. Target: above Chelsea every season.
20. **Mixed bag** (2015-2020): Every player from a different country.

### Later ideas (agreed, not started)

- "The one that got away": after each summer and at the end, the best player
  you were offered but passed on (`DraftState.offers` / `shown` already store
  every candidate).
- Badges and a sticker album of every player drafted (localStorage).
- One decision per season (January bid for your star; a crisis choice).
- Ghost runs: share a seed link, a friend plays the same draft later, then
  compare season by season.
- Dynasty mode: carry the squad from 2015-20 into 2020-25.
- A modern design for 2020-2025.
