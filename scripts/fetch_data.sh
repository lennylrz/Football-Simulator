#!/usr/bin/env bash
# Downloads the raw Kaggle data scripts/process_data.py reads into data/raw/:
#   male_players (legacy).csv  FIFA 23 complete player dataset (FIFA 15-23)
#   fc24/male_players.csv      EA Sports FC 24 complete player dataset (15-24)
#   fc25/male_players.csv      EA Sports FC 25 database, ratings and stats
#   esd/database.sqlite        European Soccer Database (FIFA ratings 2007-2016)
#   tm/players.csv             Transfermarkt players (nationalities)
#
# Credentials: either ~/.kaggle/kaggle.json, or KAGGLE_USERNAME + KAGGLE_KEY.
# In a Claude Code cloud session the egress proxy injects Kaggle auth, so
# placeholder values are used when nothing is set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw"
VENV="$ROOT/.venv-kaggle"
# Kaggle CLI 1.6.x talks to www.kaggle.com; 1.7+ uses api.kaggle.com, which
# some sandboxed networks do not allow.
KAGGLE_VERSION="1.6.17"

if [[ ! -x "$VENV/bin/kaggle" ]]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q "kaggle==$KAGGLE_VERSION"
fi

if [[ -z "${KAGGLE_USERNAME:-}" && ! -f "$HOME/.kaggle/kaggle.json" ]]; then
  export KAGGLE_USERNAME=proxy KAGGLE_KEY=proxy
fi
# Behind a TLS-intercepting proxy the CLI needs the proxy's CA bundle.
CA="${SSL_CERT_FILE:-${REQUESTS_CA_BUNDLE:-}}"
if [[ -n "$CA" ]]; then export KAGGLE_SSL_CA_CERT="$CA"; fi
if [[ -n "${HTTPS_PROXY:-}" ]]; then export KAGGLE_PROXY="$HTTPS_PROXY"; fi

# fetch <dataset> <file> <dir under data/raw>
fetch() {
  local dir="$RAW/$3"
  mkdir -p "$dir"
  if [[ -f "$dir/$(basename "$2")" ]]; then
    echo "Already downloaded: data/raw/$3/$(basename "$2")"
    return
  fi
  "$VENV/bin/kaggle" datasets download "$1" -f "$2" -p "$dir"
  (cd "$dir" && for z in *.zip; do [[ -e "$z" ]] && unzip -o -q "$z" && rm "$z"; done; true)
}

fetch stefanoleone992/fifa-23-complete-player-dataset "male_players (legacy).csv" .
fetch stefanoleone992/ea-sports-fc-24-complete-player-dataset male_players.csv fc24
fetch nyagami/ea-sports-fc-25-database-ratings-and-stats male_players.csv fc25
fetch hugomathien/soccer database.sqlite esd
fetch davidcariboo/player-scores players.csv tm
ls -laR "$RAW"
