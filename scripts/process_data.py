"""Turns the raw Kaggle CSV into the compact JSON the game ships with.

Outputs (public/data/):
  players.json       static player info: id -> [short name, nationality]
  season_YYYY.json   one per season 2015..2019: id -> rating row (FIFA 16..20)
  squads_2015.json   the 20 Premier League squads at the start of 2015/16
  youth.json         academy graduates joining one of the 20 clubs, by season
  meta.json          clubs list, value model, development and retirement curves

Run scripts/fetch_data.sh first. Usage: python3 scripts/process_data.py
"""
import json
import os
import sys

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "male_players (legacy).csv")
OUT = os.path.join(ROOT, "public", "data")

# FIFA 16 holds ratings for 2015/16, ..., FIFA 20 for 2019/20.
SEASONS = {2015: 16, 2016: 17, 2017: 18, 2018: 19, 2019: 20}
# FIFA league ids. Names are ambiguous ("Premier League" is also Russia, ...).
EPL = 13
TOP5 = {EPL, 53, 19, 31, 16}  # England, Spain, Germany, Italy, France
SQUAD_SIZE = 23
SQUAD_GK = 3

COLS = [
    "player_id", "fifa_version", "short_name", "nationality_name",
    "player_positions", "overall", "potential", "age", "value_eur",
    "wage_eur", "club_name", "league_id",
]


def pool_mask(d):
    """Market pool filter: decent players in the top 5 leagues, high-potential
    youngsters, and notable players elsewhere."""
    top5 = d.league_id.isin(TOP5)
    good = (d.overall >= 68) | ((d.potential >= 80) & (d.age <= 23))
    elsewhere = (d.overall >= 75) | ((d.potential >= 84) & (d.age <= 21))
    return (top5 & good) | (~top5 & elsewhere)


def main():
    if not os.path.exists(RAW):
        sys.exit("Missing raw data. Run scripts/fetch_data.sh first.")
    df = pd.read_csv(RAW, usecols=COLS, low_memory=False)
    df = df[df.fifa_version.isin(range(15, 22))].copy()
    df["value_eur"] = df.value_eur.fillna(0)
    df["wage_eur"] = df.wage_eur.fillna(0)
    df["club_name"] = df.club_name.fillna("Free agent")

    by_ver = {v: df[df.fifa_version == v].set_index("player_id") for v in range(15, 22)}

    # --- 2015/16 squads -----------------------------------------------------
    f16 = by_ver[16]
    epl = f16[f16.league_id == EPL]
    clubs = sorted(epl.club_name.unique())
    assert len(clubs) == 20, clubs
    squads = {}
    for club in clubs:
        c = epl[epl.club_name == club].sort_values("overall", ascending=False)
        gk = c[c.player_positions.str.startswith("GK")].head(SQUAD_GK)
        out = c[~c.player_positions.str.startswith("GK")].head(SQUAD_SIZE - len(gk))
        squads[club] = [int(i) for i in list(gk.index) + list(out.index)]

    # --- player universe ----------------------------------------------------
    universe = {i for ids in squads.values() for i in ids}
    for season, ver in SEASONS.items():
        d = by_ver[ver]
        universe |= set(int(i) for i in d[pool_mask(d)].index)

    game_clubs = set(clubs)
    club_names = []
    club_index = {}

    def club_id(name):
        if name not in club_index:
            club_index[name] = len(club_names)
            club_names.append(name)
        return club_index[name]

    club_id("Free agent")

    # Club shown for a player outside the 20 game clubs. If his real club that
    # season is one of the 20, the game world never moved him there, so show
    # his last real club outside them instead.
    last_external = {}
    for ver in range(15, 16):
        for pid, club in by_ver[ver].club_name.items():
            if club not in game_clubs and by_ver[ver].loc[pid, "league_id"] != EPL:
                last_external[int(pid)] = club

    players = {}
    season_rows = {}
    for season, ver in SEASONS.items():
        d = by_ver[ver]
        d = d[d.index.isin(universe)]
        rows = {}
        for pid, r in d.iterrows():
            pid = int(pid)
            club = r.club_name
            if club in game_clubs:
                ext = last_external.get(pid, "Free agent")
            else:
                ext = club
                last_external[pid] = club
            rows[pid] = [
                int(r.overall), int(r.potential), int(r.age),
                int(round(r.value_eur / 1000)), int(round(r.wage_eur / 1000)),
                r.player_positions.replace(" ", ""), club_id(ext),
            ]
            players[pid] = [r.short_name, r.nationality_name]
        season_rows[season] = rows

    # --- academy graduates ---------------------------------------------------
    # Youngsters who first appear in the data at one of the 20 clubs (e.g.
    # Rashford, FIFA 17 at Manchester United) join that club in the game.
    seen = set(by_ver[15].index) | set(by_ver[16].index)
    youth = {}
    for season, ver in list(SEASONS.items())[1:]:
        d = by_ver[ver]
        new = d[~d.index.isin(seen) & d.club_name.isin(game_clubs) & (d.age <= 21)
                & (d.league_id == EPL) & d.index.isin(universe)]
        youth[season] = {}
        for pid, r in new.iterrows():
            youth[season].setdefault(r.club_name, []).append(int(pid))
        seen |= set(d.index)

    # --- value model: log(value) ~ quadratic(overall), age, headroom --------
    fit = pd.concat([by_ver[v] for v in SEASONS.values()])
    fit = fit[(fit.value_eur > 0) & (fit.overall >= 55)]
    o = fit.overall.to_numpy(float) - 70
    a = fit.age.to_numpy(float) - 25
    h = (fit.potential - fit.overall).to_numpy(float)
    X = np.column_stack([np.ones_like(o), o, o * o, a, a * a, h])
    y = np.log(fit.value_eur.to_numpy(float) / 1000)
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ coef
    value_model = {
        "coef": [round(float(c), 6) for c in coef],
        "features": ["1", "ovr-70", "(ovr-70)^2", "age-25", "(age-25)^2", "pot-ovr"],
        "residualSd": round(float(resid.std()), 3),
    }

    # --- development: rating change to the next edition by age --------------
    # Measured on players rated 60+ who appear in consecutive editions.
    deltas = []
    retire = []
    for v in range(15, 21):
        cur, nxt = by_ver[v], by_ver[v + 1]
        cur = cur[cur.overall >= 60]
        both = cur.join(nxt[["overall"]], rsuffix="_next", how="inner")
        deltas.append(pd.DataFrame({"age": both.age, "d": both.overall_next - both.overall,
                                    "head": both.potential - both.overall}))
        retire.append(pd.DataFrame({"age": cur.age, "gone": ~cur.index.isin(nxt.index)}))
    deltas = pd.concat(deltas)
    retire = pd.concat(retire)
    dev = {}
    for age in range(16, 41):
        s = deltas[deltas.age == age]
        if len(s) >= 30:
            dev[age] = [round(float(s.d.mean()), 2), round(float(s.d.std()), 2), int(len(s))]
    gone = {}
    for age in range(16, 41):
        s = retire[retire.age == age]
        if len(s) >= 30:
            gone[age] = round(float(s.gone.mean()), 3)
    # Share of a player's headroom (potential - overall) realised per year.
    young = deltas[(deltas.age <= 24) & (deltas["head"] > 0)]
    head_rate = float((young.d / young["head"]).clip(-1, 1).mean())

    meta = {
        "source": "FIFA 23 complete player dataset (Stefano Leone, Kaggle, CC0), legacy file",
        "seasons": [f"{s}/{str(s + 1)[2:]}" for s in SEASONS],
        "fifaVersions": list(SEASONS.values()),
        "rowFormat": ["overall", "potential", "age", "valueK", "wageK", "positions", "clubIndex"],
        "clubNames": club_names,
        "gameClubs": clubs,
        "valueModel": value_model,
        "devByAge": dev,
        "headroomRate": round(head_rate, 3),
        "missingRateByAge": gone,
    }

    os.makedirs(OUT, exist_ok=True)

    def dump(name, obj):
        path = os.path.join(OUT, name)
        with open(path, "w") as f:
            json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
        return os.path.getsize(path)

    sizes = {
        "players.json": dump("players.json", {str(k): v for k, v in sorted(players.items())}),
        "squads_2015.json": dump("squads_2015.json", squads),
        "youth.json": dump("youth.json", youth),
        "meta.json": dump("meta.json", meta),
    }
    for season, rows in season_rows.items():
        sizes[f"season_{season}.json"] = dump(
            f"season_{season}.json", {str(k): v for k, v in sorted(rows.items())})

    total = sum(sizes.values())
    for k, v in sizes.items():
        print(f"{k:20s} {v / 1024:8.1f} KB")
    print(f"{'total':20s} {total / 1024:8.1f} KB, {len(players)} players")


if __name__ == "__main__":
    main()
