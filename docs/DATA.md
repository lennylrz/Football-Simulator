# Data

Three playable eras, each with its own folder of JSON in `public/data/<era>/`
(the era is its first season's start year). Player ids are the FIFA/EA ids,
the same in every source, so a player keeps his id across eras.

| Era | Seasons | Ratings | Source |
|---|---|---|---|
| 2010 | 2010/11-2014/15 | FIFA 11-15 | European Soccer Database, FIFA 15 from the FC 24 dataset |
| 2015 | 2015/16-2019/20 | FIFA 16-20 | FIFA 23 complete player dataset, legacy file |
| 2020 | 2020/21-2024/25 | FIFA 21-FC 25 | EA Sports FC 24 complete player dataset, EA FC 25 database |

Sources (all on Kaggle):

- "FIFA 23 complete player dataset" by Stefano Leone (CC0), file
  `male_players (legacy).csv`: one snapshot per player per FIFA edition
  (15 to 23).
- "EA Sports FC 24 complete player dataset" by Stefano Leone (CC0),
  `male_players.csv`: the same columns for FIFA 15 to FC 24.
- "EA Sports FC 25 database, ratings and stats" by nyagami (Apache 2.0):
  FC 25 ratings with club, league, positions and age. No potential, value or
  wage. The EA ratings URL ends in the player id.
- "European Soccer Database" by Hugo Mathien (ODbL; contents © the original
  authors): FIFA rating snapshots 2007-2016 and the lineups, with positions on
  a grid, of 26,000 league matches in 11 European top divisions, 2008/09 to
  2015/16. No nationality, value, wage or English lower leagues. The 2010
  era's files are a derived database and fall under the ODbL too.
- "Football Data from Transfermarkt" by davidcariboo (CC0), `players.csv`:
  only for nationalities missing from the FIFA data.

## 2015 era

Columns used: `player_id` (stable across editions), `short_name`,
`nationality_name`, `player_positions`, `overall`, `potential`, `age`,
`value_eur`, `wage_eur`, `club_name`, `league_id`.

Leagues are matched by `league_id`, not name: "Premier League" is also the
name of the Russian, South African and other leagues. Top 5 = England 13,
Spain 53, Germany 19, Italy 31, France 16.

## Pipeline

```
scripts/fetch_data.sh        # Kaggle CLI -> data/raw/ (gitignored)
python3 scripts/process_data.py   # -> public/data/*.json (committed)
```

## What ships (public/data/<era>, about 1 MB each)

- `squads.json`: the 20 squads at the start of the era (league 13 in its first
  season), trimmed to 23 players each (best 3 GK + best 20 outfield).
- `season_YYYY.json`: rating row per player per season:
  `[overall, potential, age, value €k, wage €k, positions, club index]`.
  The club is the player's real club, or for players whose real club is one of
  the 20 game clubs, their last real club outside them (the game world did not
  make that move).
- `players.json`: name and nationality per player id.
- `youth.json`: academy graduates (first appearance in the data, age 21 or
  under, at one of the 20 clubs, e.g. Rashford at Manchester United in
  2016/17). They join that club in the game.
- `meta.json`: club names, and models fitted on the data:
  - market value: `log(value €k)` on overall (quadratic), age (quadratic) and
    potential-minus-overall; residual sd 0.22.
  - mean and sd of the rating change to the next edition by age (players
    rated 60+): +2.6 at 17, +0.7 at 25, 0 at 30, -0.6 at 35.
  - the share of players missing from the next edition by age. It is about
    20% even at 25 because of licensing and league coverage changes, so the
    game only treats a missing row as a likely retirement for older players.

The player universe is everyone in the era's first squads plus anyone who, in
any of the five seasons, passes the market filter: top-5 league and (overall >= 68 or
potential >= 80 at age 23 or under), or elsewhere with overall >= 75 or
potential >= 84 at 21 or under. 5,795 players in total.

## 2020 era

FIFA 21 to FC 24 come from the FC 24 dataset, read exactly like the 2015 era.
2024/25 comes from the FC 25 database:

- clubs and leagues: EA's names ("Spurs", "LALIGA EA SPORTS") are mapped to
  the dataset's through the players both files share;
- potential: FC 24 potential moved by half the change in overall, or for new
  players the median headroom for their age;
- value and wage: none, so the game's value model prices 2024/25 alone.

The value model is fitted on 2020/21-2023/24 and the development curves on
FIFA 20 to FC 25.

## 2010 era

2010/11 to 2013/14 come from the European Soccer Database, 2014/15 from
FIFA 15 in the FC 24 dataset:

- rating: the first snapshot on or after 25 August of the season's start
  year, when that year's FIFA came out;
- club and league: the club of the player's first league start that season,
  else the nearest season he started in. The 2010/11 squads are the players
  who started a league match for the club, topped up with its other players
  (goalkeepers first). Club names follow the FIFA datasets, through the FIFA
  team id;
- positions: from where he lined up that season (the grid's x runs 1-9 from
  right to left, y 1-11 from goal to attack), every slot used at least a
  fifth as often as his main one. A goalkeeper is anyone whose goalkeeping
  attributes average over 40;
- name and nationality: from FIFA 15-24 where the player is in them, else
  Transfermarkt (same birthday and a shared name), else none (about 500
  players who retired early, for example Nesta and Ballack). Names from the
  database alone lack accents;
- value and wage: none; the value model is fitted on FIFA 15;
- cup opponents: European clubs from the database's 11 leagues; English
  lower-league clubs from FIFA 15 for every season.

## 2015 era summary

Best XI average rating, 2015/16:

| Club | Best XI | Best player |
|---|---|---|
| Chelsea | 84.7 | E. Hazard 89 |
| Manchester City | 84.3 | David Silva 88 |
| Arsenal | 83.2 | M. Özil 87 |
| Manchester United | 82.7 | W. Rooney 86 |
| Liverpool | 81.1 | Coutinho 84 |
| Tottenham Hotspur | 80.4 | H. Lloris 85 |
| Everton | 79.8 | L. Baines 83 |
| Southampton | 78.0 | José Fonte 81 |
| Swansea City | 77.8 | A. Williams 81 |
| Stoke City | 77.8 | Bojan 81 |
| Newcastle United | 77.7 | G. Wijnaldum 80 |
| West Ham United | 77.5 | D. Payet 81 |
| Sunderland | 77.1 | Y. Kaboul 79 |
| West Bromwich Albion | 76.8 | S. Rondón 80 |
| Crystal Palace | 76.5 | Y. Cabaye 79 |
| Aston Villa | 76.5 | M. Richards 79 |
| Watford | 76.0 | V. Ibarbo 78 |
| Leicester City | 75.7 | G. İnler 80 |
| Norwich City | 75.0 | Y. Mulumbu 78 |
| AFC Bournemouth | 74.5 | M. Gradel 79 |

Market pool (players outside the 2015 squads with a row that season):

| Season | Players | 80+ | 85+ |
|---|---|---|---|
| 2015/16 | 3,900 | 304 | 33 |
| 2016/17 | 4,205 | 399 | 63 |
| 2017/18 | 4,367 | 410 | 71 |
| 2018/19 | 4,319 | 451 | 85 |
| 2019/20 | 4,205 | 476 | 90 |

Sample trajectories (overall, 2015/16 to 2019/20): Kane 78, 84, 86, 89, 89;
Kanté 76, 81, 87, 89, 89; Mbappé -, 71, 83, 87, 89; Salah 80, 81, 83, 88, 90;
Vardy 71, 82, 81, 82, 82; Rooney 86, 84, 81, 80, 80.
