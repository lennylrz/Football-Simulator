#!/usr/bin/env bash
# Downloads the "FIFA 23 Complete Player Dataset" (Stefano Leone) from Kaggle
# into data/raw/. Only the legacy male players file is needed: it holds one
# snapshot per FIFA edition (15-23), which is what scripts/process_data.py reads.
#
# Credentials: either ~/.kaggle/kaggle.json, or KAGGLE_USERNAME + KAGGLE_KEY.
# In a Claude Code cloud session the egress proxy injects Kaggle auth, so
# placeholder values are used when nothing is set.
set -euo pipefail

DATASET="stefanoleone992/fifa-23-complete-player-dataset"
FILE="male_players (legacy).csv"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw"
VENV="$ROOT/.venv-kaggle"
# Kaggle CLI 1.6.x talks to www.kaggle.com; 1.7+ uses api.kaggle.com, which
# some sandboxed networks do not allow.
KAGGLE_VERSION="1.6.17"

mkdir -p "$RAW"
if [[ -f "$RAW/$FILE" ]]; then
  echo "Already downloaded: data/raw/$FILE"
  exit 0
fi

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

"$VENV/bin/kaggle" datasets download "$DATASET" -f "$FILE" -p "$RAW"
cd "$RAW"
for z in *.zip; do unzip -o -q "$z" && rm "$z"; done
ls -la "$RAW"
