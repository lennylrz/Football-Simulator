# Handoff: Five Seasons

Read this first in a new session. Repo: `lennylrz/Football-Simulator`.
Everything below is merged to `main` (last: PR #9) and live at
https://five-seasons-football.vercel.app (Vercel project `five-seasons`,
team "PingPong Ltd"; every merge to `main` deploys to production). The
owner tests on the live site, so changes reach them only once merged.
Always ask before merging.

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
npx vitest run              # 13 files, 59 tests incl. balance (~2-3 min)
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

## Next tasks (from the owner, in this order)

### 1. Black bars around the game

The stage is a fixed 16:9 1280x720 box scaled to fit (`Stage` in
`ui.tsx`), and `.stage-wrap` / `body` are `#000`, so any window that isn't
16:9 shows black bars (on a laptop browser: left and right). Fix so it
looks intentional on any window: at least paint `.stage-wrap` with the
current screen's background (per theme: welcome/home paper, console
charcoal, Slate blue gradient), ideally let the background extend to the
full window while the 1280x720 content stays centred. Check every screen
and both themes, and the era picker.

### 2. 2020-2025 not playable yet

Make the 2020-2025 tile "Coming later" and not clickable (`ERAS` in
`src/console/home/Home.tsx`, `live: false`), also in the room host's era
choice. Only 2010-15 and 2015-20 are in focus.

### 3. Full visual sweep, both themes (2010-15 and 2015-20)

Go through every screen and overlay in both eras and fix every overflow,
clipping and spill: welcome, era picker, settings, new club, draft
(choose-first state, every position, bench, hidden-ratings and pick-timer
settings), summer (first summer and later ones, retired players, re-draft
confirm, swap mode, star pick, dressing-room notes), season viewer
(league days, cup days, paused), season reveal, season review (all tabs:
story, table, your matches, Champions League group/knockout/bracket, FA Cup,
leaders, squad; treble and trophy states), Hall of Fame, player card,
transfers, career summary and season report, share card, lobby, waiting
room, rival lineup, live head-to-head. Known spots: text spills when you
win something (trophy lines in the review header and summer header),
delta badges clipped at the pitch edges, long club/player names,
the squad table getting short under the dressing-room notes.
Screenshot each one with Playwright before and after.

### 4. Make winning feel like winning (both themes)

The screens should react: when you win the league, a cup or the treble,
the screen lights up (flash, confetti or the era's equivalent, a trophy
moment, then the review). Also: the last matchday live when the title race
is within ~3 points, glow-ups ticking up on the summer reveal, a moment
for a player of the season / Ballon d'Or from your club. Respect
"reduce motion" (`.calm`). Each era in its own style.

### 5. Daily Challenge

One challenge a day, the same for everyone: fixed seed, era and rule;
one attempt; a copyable result text (e.g. `Five Seasons Daily #12 · Only
Portugal / 3rd 1st🏆 2nd 1st🏆🏆 4th / Legacy 11,250`) and a daily
leaderboard in Supabase (new append-only table, insert + select RLS like
the room tables). The day's challenge is picked from a list by day number.
Engine hooks: candidate filters go in `drawCandidates` / `drawBenchCandidates`
(`src/game/draft.ts`; widen the pool or relax the rating floor when a filter
leaves too few players); "manage an existing club" uses the engine's real-club
mode (`newGame` with a club index < `REAL_CLUBS`; the transfer/management
mode still exists in `market.ts` but has no UI) or, simpler, pre-fills the
draft with that club's real squad; clubs from abroad would need their
squads added to `squads.json` by `scripts/process_data.py`.

The first 20 challenges (owner asked for exactly this kind of list):

1. **Only Portugal**: every candidate is Portuguese.
2. **Kids only**: every player 21 or under at the start.
3. **Old guard**: every player 30 or over.
4. **Galácticos in England**: start with Real Madrid's 2015 squad (needs
   their squad in the data) in the Premier League.
5. **The underdog**: manage the real club predicted to finish 20th (e.g.
   Watford/Bournemouth 2015) with no re-drafts; target a top-half finish.
6. **Only Brazil**: every candidate is Brazilian.
7. **Bargain bin**: every player valued under €5m.
8. **Two choices**: only 2 candidates per pick (the setting allows 3-5 today; allow 2 for this challenge).
9. **Blind draft**: ratings hidden all career.
10. **Bundesliga XI**: every candidate plays in Germany at the start.
11. **Park the Bus or bust**: style locked to Park the Bus, win the league.
12. **One club men**: every candidate from a single foreign club per
    position line (e.g. defence all from Juventus, attack all from PSG).
13. **Only Spain**: every candidate is Spanish.
14. **No re-drafts**: the XI you draft is the XI you keep for 5 seasons.
15. **Star system**: Through the Star, and your star must be under 23.
16. **Home-grown**: every candidate is English.
17. **Serie A XI**: every candidate plays in Italy at the start.
18. **Rated 75-80**: no candidate above 80 or below 75 at the start.
19. **The rival**: start as last season's champions' biggest rival with
    their real squad; finish above the champions every season.
20. **Mixed bag**: one player from each of 11 different countries.

Score each challenge with the normal legacy score (optionally a challenge
target, e.g. "top half" or "above the champions", shown as pass/fail in
the result text). Keep the rules shown in one short line on the draft.

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
