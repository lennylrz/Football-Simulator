# Roadmap and long-term vision

Notes from the project owner, kept for later. Nothing here is built yet
unless marked done.

## Eras: the look changes with the years

The game's visual style follows the era being played, and modernises as
the run moves through time, roughly every five years.

| Years | Style direction | Reference |
|---|---|---|
| 2000-2004 | Early-2000s desktop management sim: grey bevelled windows, navy title bars, dense tables | "Manager '01" in docs/design-directions.html |
| 2005-2009 | (to design) | |
| 2010-2018 | Console football game of 2012-2015 (FIFA 13 era): glossy split bars, grey tiles, bold Arial-style type, calendar strip, breaking news, dark transfer tables, silver prompt bar, results ticker, white shattered-ball main menu | docs/design-2015-console.html (current direction, built from the owner's reference screenshots); earlier attempts in docs/design-2015-options.html |
| 2019 onwards | Clean and modern minimalist, club colour as the accent | "Clean Sheet" in docs/design-directions.html |

For the current 2015 start: 2015/16, 2016/17 and 2017/18 use the 2015-era
style; from 2018/19 or 2019/20 the game switches to the modern style (exact
season to decide). The switch itself should be a moment: a short
transition screen when the new era arrives.

Every style must look intentional: deliberately vintage, never a poorly
made website. No real logos, crests, kits, typefaces or league branding.

## Multiple starting points

A run can start in 2010, 2015 or 2020 (done, October 2026; see docs/DATA.md
for the sources). All three use the 2015 console style for now; each era's
own starting style, progressing with the years, is still to build. 2000 and
2005 need data: no open dataset found has ratings from before FIFA 11
(sofifa.com goes back to FIFA 07).

## Other saved ideas

- Hall of Fame / trophy cabinet viewable at any time (done).
- FA Cup and Champions League with a hard treble (done).
- Six design directions catalogue: docs/design-directions.html.
- Sticker Album, Matchday Programme and Tactics Board directions are liked
  too; they could be used for special screens (share card as an album page
  or newspaper front page, tactics board for the lineup) or for other eras.

## Game format (October 2026)

The game is now a draft: the user's own club joins the 20 real clubs as a
21st club; the XI is drafted one position at a time from five real players;
each summer reveals rating changes and allows up to three re-draft gambles;
seasons play out matchday by matchday with a skip. The earlier management
mode (offers, bids, squad of 26) is still in the game logic and covered by
tests, but no longer in the interface.

Ideas not built yet: a daily draft that is the same for everyone, a
leaderboard, a "Ball Knowledge" mode with ratings hidden, friend challenge
links using the seed.
