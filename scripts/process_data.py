"""Turns the raw Kaggle data into the compact JSON the game ships with.

Each era gets its own folder, public/data/<era>/ (era = first season's year):
  players.json       static player info: id -> [short name, nationality]
  season_YYYY.json   one per season: id -> rating row
  squads.json        the 20 Premier League squads at the start of the era
  youth.json         academy graduates joining one of the 20 clubs, by season
  teams.json         cup opponents by season: English lower-league clubs and
                     the strongest European clubs, rated from real squads
  meta.json          clubs list, value model, development and retirement curves

Sources (see docs/DATA.md):
  2010  European Soccer Database (FIFA 11-14 ratings, 2008-2016 lineups) for
        2010/11-2013/14, and FIFA 15 from the FC 24 dataset for 2014/15
  2015  FIFA 23 complete player dataset, legacy file: FIFA 16-20
  2020  EA Sports FC 24 complete player dataset: FIFA 21-FC 24, plus an
        EA FC 25 ratings dataset for 2024/25

Run scripts/fetch_data.sh first. Usage: python3 scripts/process_data.py [era ...]
"""
import json
import os
import sqlite3
import sys

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
LEGACY = os.path.join(RAW, "male_players (legacy).csv")
FC24 = os.path.join(RAW, "fc24", "male_players.csv")
FC25 = os.path.join(RAW, "fc25", "male_players.csv")
ESD = os.path.join(RAW, "esd", "database.sqlite")
TM = os.path.join(RAW, "tm", "players.csv")
OUT = os.path.join(ROOT, "public", "data")

# FIFA league ids. Names are ambiguous ("Premier League" is also Russia, ...).
EPL = 13
TOP5 = {EPL, 53, 19, 31, 16}  # England, Spain, Germany, Italy, France
ENG_LOWER = {14: 2, 60: 3, 61: 4}  # Championship, League One, League Two
EUROPE = {53, 19, 31, 16, 308, 10, 4, 68, 67, 1, 80, 50, 189, 330, 66, 7, 54}
SQUAD_SIZE = 23
SQUAD_GK = 3

COLS = [
    "player_id", "fifa_version", "short_name", "nationality_name",
    "player_positions", "overall", "potential", "age", "value_eur",
    "wage_eur", "club_name", "league_id", "league_name",
]
FRAME_COLS = COLS[2:]


def pool_mask(d):
    """Market pool filter: decent players in the top 5 leagues, high-potential
    youngsters, and notable players elsewhere."""
    top5 = d.league_id.isin(TOP5)
    good = (d.overall >= 68) | ((d.potential >= 80) & (d.age <= 23))
    elsewhere = (d.overall >= 75) | ((d.potential >= 84) & (d.age <= 21))
    return (top5 & good) | (~top5 & elsewhere)


def read_fifa(path, versions):
    """FIFA editions from one of Stefano Leone's files: version -> frame."""
    df = pd.read_csv(path, usecols=COLS, low_memory=False)
    df = df[df.fifa_version.isin(versions)].copy()
    df["value_eur"] = df.value_eur.fillna(0)
    df["wage_eur"] = df.wage_eur.fillna(0)
    df["club_name"] = df.club_name.fillna("Free agent")
    df["league_id"] = df.league_id.fillna(-1)
    df["league_name"] = df.league_name.fillna("")
    df["player_id"] = df.player_id.astype(int)
    df = df.drop_duplicates(["player_id", "fifa_version"], keep="last")
    return {int(v): df[df.fifa_version == v].set_index("player_id")[FRAME_COLS] for v in versions}


# --- 2015/16-2019/20 -----------------------------------------------------------

def era_2015():
    by_ver = read_fifa(LEGACY, range(15, 22))
    return {
        "source": "FIFA 23 complete player dataset (Stefano Leone, Kaggle, CC0), legacy file",
        "frames": {2015 + i: by_ver[16 + i] for i in range(5)},
        "prev": by_ver[15],
        "fifa": [16, 17, 18, 19, 20],
        "dev": [(by_ver[v], by_ver[v + 1]) for v in range(15, 21)],
        "missing": [(by_ver[v], by_ver[v + 1]) for v in range(15, 21)],
        "value": [by_ver[v] for v in range(16, 21)],
    }


# --- 2020/21-2024/25 -----------------------------------------------------------

def fc25_frame(fc24):
    """EA FC 25 ratings (2024/25) in the same shape. The EA ratings URL ends in
    the player id, which is the id the FIFA datasets use. The file has no
    potential, value or wage: potential carries over from FC 24 (or the
    typical headroom for the age), value is left to the game's value model."""
    d = pd.read_csv(FC25)
    d["player_id"] = d.url.str.extract(r"/(\d+)$")[0].astype(int)
    d = d.drop_duplicates("player_id").set_index("player_id")
    last = fc24[24]
    known = d.index.intersection(last.index)
    # League and club names: map EA's names to the dataset's through the
    # players they share (EA writes "Spurs", the dataset "Tottenham Hotspur").
    both = d.loc[known, ["League", "Team"]].join(last.loc[known, ["league_id", "league_name", "club_name"]])
    league_map = both.groupby("League").league_id.agg(lambda s: s.value_counts().index[0])
    team_map = both.groupby("Team").club_name.agg(lambda s: s.value_counts().index[0])
    league_names = last.drop_duplicates("league_id").set_index("league_id").league_name
    # A club whose players mostly came from elsewhere keeps EA's name.
    share = both.groupby("Team").apply(lambda g: (g.club_name == team_map[g.name]).mean(), include_groups=False)
    team_map = team_map[share >= 0.4]

    head = last.assign(h=last.potential - last.overall).groupby("age").h.median()
    out = pd.DataFrame(index=d.index)
    out["short_name"] = [last.short_name.get(i, n) for i, n in zip(d.index, d.Name)]
    out["nationality_name"] = d.Nation
    alt = d["Alternative positions"].fillna("").str.replace(" ", "")
    out["player_positions"] = (d.Position + "," + alt).str.strip(",").str.replace(",", ", ")
    out["overall"] = d.OVR.astype(int)
    out["age"] = d.Age.astype(int)
    prev_pot = last.potential.reindex(d.index)
    prev_ovr = last.overall.reindex(d.index)
    carried = prev_pot + ((out.overall - prev_ovr) / 2).round()
    typical = out.overall + out.age.map(head).fillna(0)
    out["potential"] = np.maximum(out.overall, carried.fillna(typical)).astype(int)
    out["value_eur"] = 0
    out["wage_eur"] = 0
    out["club_name"] = [team_map.get(t, t) for t in d.Team]
    out["league_id"] = d.League.map(league_map).fillna(-1).astype(int)
    out["league_name"] = [league_names.get(i, l) for i, l in zip(out.league_id, d.League)]
    return out[FRAME_COLS]


def era_2020():
    by_ver = read_fifa(FC24, range(20, 25))
    fc25 = fc25_frame(by_ver)
    frames = {2020: by_ver[21], 2021: by_ver[22], 2022: by_ver[23], 2023: by_ver[24], 2024: fc25}
    return {
        "source": "EA Sports FC 24 complete player dataset (Stefano Leone, Kaggle, CC0) "
                  "and EA Sports FC 25 database (nyagami, Kaggle)",
        "frames": frames,
        "prev": by_ver[20],
        "fifa": [21, 22, 23, 24, 25],
        "dev": [(by_ver[v], by_ver[v + 1]) for v in range(20, 24)] + [(by_ver[24], fc25)],
        "missing": [(by_ver[v], by_ver[v + 1]) for v in range(20, 24)],
        "value": [by_ver[v] for v in range(21, 25)],
    }


# --- 2010/11-2014/15 -----------------------------------------------------------

# European Soccer Database league -> FIFA league id
ESD_LEAGUES = {1: 4, 1729: 13, 4769: 16, 7809: 19, 10257: 31, 13274: 10,
               15722: 66, 17642: 308, 19694: 50, 21518: 53, 24558: 189}


def lineup_position(x, y):
    """A lineup slot on the database's grid (x 1-9 with 9 on the left, y 1-11
    from goal to attack) as a FIFA position."""
    if y == 1:
        return "GK"
    left, right = x >= 8, x <= 2
    if y <= 4:
        return "LB" if left else "RB" if right else "CB"
    if y <= 6:
        return "LM" if left else "RM" if right else "CDM"
    if y == 7:
        return "LM" if left else "RM" if right else "CM"
    if y == 8:
        return "LM" if left else "RM" if right else "CAM"
    if y == 9:
        return "LW" if x >= 7 else "RW" if x <= 3 else "CAM"
    return "LW" if left else "RW" if right else "ST"


def fold(name):
    """Lower-case ASCII, for matching names across datasets."""
    import unicodedata
    s = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode()
    return "".join(ch if ch.isalpha() else " " for ch in s.lower()).split()


def tm_nationality(players, info):
    """Nationality from Transfermarkt for players who left the FIFA data before
    FIFA 15: same birthday and a shared surname. Transfermarkt's country names
    are mapped to FIFA's through the players both datasets know."""
    tm = pd.read_csv(TM, usecols=["name", "date_of_birth", "country_of_citizenship"]).dropna()
    tm["dob"] = tm.date_of_birth.str[:10]
    by_dob = {}
    for r in tm.itertuples():
        by_dob.setdefault(r.dob, []).append((set(fold(r.name)), r.country_of_citizenship))
    found = {}
    for r in players.itertuples():
        words = set(fold(r.player_name))
        hits = {c for w, c in by_dob.get(str(r.birthday)[:10], []) if words & w}
        if len(hits) == 1:
            found[int(r.player_fifa_api_id)] = hits.pop()
    pairs = pd.DataFrame([(c, info[i][1]) for i, c in found.items() if i in info], columns=["tm", "fifa"])
    names = pairs.groupby("tm").fifa.agg(lambda s: s.value_counts().index[0]).to_dict()
    return {i: names.get(c, c) for i, c in found.items() if i not in info}


def esd_frames(leone):
    """Season frames 2009/10-2015/16 from the European Soccer Database: the
    rating snapshot taken when that season's FIFA came out, the club of the
    player's first league start, and positions from the lineup grid. Names
    and nationalities come from the FIFA 15+ data where the player is in it."""
    con = sqlite3.connect(ESD)
    players = pd.read_sql("select player_api_id, player_fifa_api_id, player_name, birthday from Player", con)
    attrs = pd.read_sql(
        "select player_api_id, date, overall_rating, potential, gk_diving, gk_handling, gk_reflexes"
        " from Player_Attributes where overall_rating is not null order by date", con)
    teams = pd.read_sql("select team_api_id, team_fifa_api_id, team_long_name from Team", con)
    m = pd.read_sql("select * from Match", con)
    con.close()

    fid = players.set_index("player_api_id").player_fifa_api_id
    # Club names as the FIFA datasets write them, through the FIFA team id.
    raw = pd.read_csv(FC24, usecols=["club_team_id", "club_name", "fifa_version"], low_memory=False).dropna()
    fifa_club = raw.groupby("club_team_id").club_name.agg(lambda s: s.iloc[-1])
    team_name = {r.team_api_id: fifa_club.get(r.team_fifa_api_id, r.team_long_name) for r in teams.itertuples()}

    # Every league start: player, season, date, club, league, position.
    starts = []
    for side in ("home", "away"):
        for i in range(1, 12):
            starts.append(pd.DataFrame({
                "pid": m[f"{side}_player_{i}"], "x": m[f"{side}_player_X{i}"], "y": m[f"{side}_player_Y{i}"],
                "season": m.season.str[:4].astype(int), "date": m.date,
                "club": m[f"{side}_team_api_id"], "league": m.league_id,
            }))
    starts = pd.concat(starts).dropna(subset=["pid"])
    starts["pid"] = starts.pid.astype(int).map(fid)
    starts = starts.dropna(subset=["pid"])
    starts["pid"] = starts.pid.astype(int)
    starts = starts.sort_values("date")
    grid = starts.dropna(subset=["x", "y"])
    grid = grid.assign(pos=[lineup_position(int(x), int(y)) for x, y in zip(grid.x, grid.y)])

    first_club = starts.groupby(["pid", "season"]).first()[["club", "league"]]
    pos_counts = grid.groupby(["pid", "season", "pos"]).size()
    pos_all = grid.groupby(["pid", "pos"]).size()

    def positions(counts):
        counts = counts.sort_values(ascending=False)
        keep = [p for p, n in counts.items() if n >= 0.2 * counts.iloc[0]][:3]
        return ", ".join(keep)

    season_pos = {k: positions(g.droplevel([0, 1])) for k, g in pos_counts.groupby(level=[0, 1])}
    career_pos = {k: positions(g.droplevel(0)) for k, g in pos_all.groupby(level=0)}

    info = {}
    for f in leone.values():
        for pid, r in f.iterrows():
            info.setdefault(int(pid), (r.short_name, r.nationality_name, r.player_positions))
    nationality = tm_nationality(players, info)

    attrs["pid"] = attrs.player_api_id.map(fid)
    attrs = attrs.dropna(subset=["pid"])
    attrs["pid"] = attrs.pid.astype(int)
    attrs["gk"] = attrs[["gk_diving", "gk_handling", "gk_reflexes"]].mean(axis=1)
    birth = pd.to_datetime(players.set_index("player_fifa_api_id").birthday)
    birth = birth[~birth.index.duplicated()]
    full_name = players.drop_duplicates("player_fifa_api_id").set_index("player_fifa_api_id").player_name

    league_name = {13: "Premier League", 53: "La Liga", 19: "Bundesliga", 31: "Serie A", 16: "Ligue 1",
                   10: "Eredivisie", 4: "Jupiler Pro League", 50: "Premiership", 189: "Super League",
                   308: "Liga Portugal", 66: "Ekstraklasa"}

    def short(name):
        parts = name.split()
        return name if len(parts) == 1 else f"{parts[0][0]}. {' '.join(parts[1:])}"

    frames = {}
    for year in range(2009, 2016):
        # The snapshot taken when that season's FIFA came out (late August or
        # September), or the first one after it.
        lo, hi = f"{year}-08-25", f"{year + 1}-08-25"
        snap = attrs[(attrs.date >= lo) & (attrs.date < hi)].groupby("pid").first()
        rows = {}
        for pid, a in snap.iterrows():
            pid = int(pid)
            club = league = None
            for y in (year, year - 1, year + 1, year - 2):
                if (pid, y) in first_club.index:
                    c = first_club.loc[(pid, y)]
                    club, league = team_name[int(c.club)], ESD_LEAGUES[int(c.league)]
                    break
            pos = season_pos.get((pid, year)) or season_pos.get((pid, year - 1)) or career_pos.get(pid)
            name, nat, fifa_pos = info.get(pid, (short(full_name.get(pid, str(pid))), nationality.get(pid, ""), None))
            if not pos:
                pos = fifa_pos or ("GK" if a.gk > 40 else "CM")
            if a.gk > 40:
                pos = "GK"
            elif pos.startswith("GK"):
                pos = (fifa_pos or "CM").replace("GK, ", "").replace("GK", "") or "CM"
            age = int((pd.Timestamp(f"{year}-09-01") - birth[pid]).days // 365.25) if pid in birth.index else 25
            rows[pid] = {
                "short_name": name, "nationality_name": nat, "player_positions": pos,
                "overall": int(a.overall_rating), "potential": int(max(a.potential, a.overall_rating)), "age": age,
                "value_eur": 0, "wage_eur": 0, "club_name": club or "Free agent",
                "league_id": league if league is not None else -1,
                "league_name": league_name.get(league, ""),
            }
        frames[year] = pd.DataFrame.from_dict(rows, orient="index")[FRAME_COLS]
    started = {y: set(g) for y, g in starts.groupby("season").pid}
    return frames, started


def era_2010():
    leone = read_fifa(FC24, range(15, 25))
    esd, started = esd_frames(leone)
    f15 = leone[15]
    frames = {2010: esd[2010], 2011: esd[2011], 2012: esd[2012], 2013: esd[2013], 2014: f15}
    return {
        "source": "European Soccer Database (Hugo Mathien, Kaggle, ODbL) for FIFA 11-14, "
                  "EA Sports FC 24 complete player dataset (Stefano Leone, Kaggle, CC0) for FIFA 15",
        "frames": frames,
        # Squads: only players who started a league match for the club.
        "squad_pool": esd[2010][esd[2010].index.isin(started[2010])],
        "prev": esd[2009],
        "fifa": [11, 12, 13, 14, 15],
        "dev": [(esd[y], esd[y + 1]) for y in range(2009, 2015)],
        "missing": [(esd[y], esd[y + 1]) for y in range(2009, 2015)],
        "value": [f15],
        # The database has no English lower leagues: every season's cup draws
        # its lower-league clubs from FIFA 15.
        "lower": f15,
    }


ERAS = {2010: era_2010, 2015: era_2015, 2020: era_2020}


def build(era, src):
    frames = src["frames"]
    years = sorted(frames)
    first = frames[years[0]]

    # --- squads at the start of the era ------------------------------------
    pool = src.get("squad_pool", first)
    epl = pool[pool.league_id == EPL]
    clubs = sorted(epl.club_name.unique())
    assert len(clubs) == 20, clubs
    squads = {}
    for club in clubs:
        c = epl[epl.club_name == club].sort_values("overall", ascending=False)
        gk = c[c.player_positions.str.startswith("GK")].head(SQUAD_GK)
        out = c[~c.player_positions.str.startswith("GK")].head(SQUAD_SIZE - len(gk))
        if pool is not first:
            # Players who started a league match, topped up with the club's
            # others: goalkeepers first, then the best outfielders.
            rest = first[(first.club_name == club) & ~first.index.isin(c.index)].sort_values("overall", ascending=False)
            extra = rest[rest.player_positions.str.startswith("GK")].head(max(0, SQUAD_GK - len(gk)))
            gk = pd.concat([gk, extra])
            others = pd.concat([c, rest.drop(extra.index)]).sort_values("overall", ascending=False)
            out = others[~others.player_positions.str.startswith("GK")].head(SQUAD_SIZE - len(gk))
        ids = [int(i) for i in list(gk.index) + list(out.index)]
        squads[club] = ids

    # --- player universe ----------------------------------------------------
    universe = {i for ids in squads.values() for i in ids}
    for year in years:
        d = frames[year]
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
    prev = src["prev"]
    for pid, club in prev.club_name.items():
        if club not in game_clubs and prev.loc[pid, "league_id"] != EPL:
            last_external[int(pid)] = club

    players = {}
    season_rows = {}
    for year in years:
        d = frames[year]
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
        season_rows[year] = rows

    # --- academy graduates ---------------------------------------------------
    # Youngsters who first appear in the data at one of the 20 clubs (e.g.
    # Rashford, FIFA 17 at Manchester United) join that club in the game.
    seen = set(prev.index) | set(first.index)
    youth = {}
    for year in years[1:]:
        d = frames[year]
        new = d[~d.index.isin(seen) & d.club_name.isin(game_clubs) & (d.age <= 21)
                & (d.league_id == EPL) & d.index.isin(universe)]
        youth[year] = {}
        for pid, r in new.iterrows():
            youth[year].setdefault(r.club_name, []).append(int(pid))
        seen |= set(d.index)

    # --- teams outside the 20: cup opponents ---------------------------------
    # Rated from their real squads: best goalkeeper plus best ten outfielders.
    def rate(d):
        d = d[d.club_name != "Free agent"]
        rated = []
        for (club, league), g in d.groupby(["club_name", "league_id"]):
            league = int(league)
            if league not in ENG_LOWER and league not in EUROPE:
                continue
            gk = g[g.player_positions.str.startswith("GK")].overall.nlargest(1)
            out = g[~g.player_positions.str.startswith("GK")].overall.nlargest(10)
            if len(gk) == 0 or len(out) < 10:
                continue
            rated.append((club, league, round(float((gk.sum() + out.sum()) / 11), 1)))
        return rated, d.drop_duplicates("league_id").set_index("league_id").league_name

    teams = {}
    lower_src = rate(src["lower"])[0] if "lower" in src else None
    for year in years:
        rated, league_names = rate(frames[year])
        lower = [t for t in (lower_src or rated) if t[1] in ENG_LOWER]
        lower = sorted(lower, key=lambda t: -t[2])
        europe = sorted([t for t in rated if t[1] in EUROPE], key=lambda t: -t[2])[:40]
        teams[year] = {
            "english": [[c, ENG_LOWER[l], r] for c, l, r in lower],
            "europe": [[c, str(league_names.get(l, "")), r] for c, l, r in europe],
        }

    # --- value model: log(value) ~ quadratic(overall), age, headroom --------
    fit = pd.concat(src["value"])
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
    for cur, nxt in src["dev"]:
        cur = cur[cur.overall >= 60]
        both = cur.join(nxt[["overall"]], rsuffix="_next", how="inner")
        deltas.append(pd.DataFrame({"age": both.age, "d": both.overall_next - both.overall,
                                    "head": both.potential - both.overall}))
    retire = []
    for cur, nxt in src["missing"]:
        cur = cur[cur.overall >= 60]
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
        "source": src["source"],
        "era": era,
        "years": years,
        "seasons": [f"{s}/{str(s + 1)[2:]}" for s in years],
        "fifaVersions": src["fifa"],
        "rowFormat": ["overall", "potential", "age", "valueK", "wageK", "positions", "clubIndex"],
        "clubNames": club_names,
        "gameClubs": clubs,
        "valueModel": value_model,
        "devByAge": dev,
        "headroomRate": round(head_rate, 3),
        "missingRateByAge": gone,
    }

    out_dir = os.path.join(OUT, str(era))
    os.makedirs(out_dir, exist_ok=True)

    def dump(name, obj):
        path = os.path.join(out_dir, name)
        with open(path, "w") as f:
            json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
        return os.path.getsize(path)

    sizes = {
        "players.json": dump("players.json", {str(k): v for k, v in sorted(players.items())}),
        "squads.json": dump("squads.json", squads),
        "youth.json": dump("youth.json", youth),
        "teams.json": dump("teams.json", teams),
        "meta.json": dump("meta.json", meta),
    }
    for year, rows in season_rows.items():
        sizes[f"season_{year}.json"] = dump(
            f"season_{year}.json", {str(k): v for k, v in sorted(rows.items())})

    total = sum(sizes.values())
    print(f"== {era}")
    for k, v in sizes.items():
        print(f"{k:20s} {v / 1024:8.1f} KB")
    print(f"{'total':20s} {total / 1024:8.1f} KB, {len(players)} players")


def main():
    eras = [int(a) for a in sys.argv[1:]] or list(ERAS)
    for era in eras:
        build(era, ERAS[era]())


if __name__ == "__main__":
    main()
