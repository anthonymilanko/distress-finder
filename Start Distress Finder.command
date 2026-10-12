#!/bin/bash
# Double-click to start Distress Finder. Installs/updates dependencies when
# needed, opens the app in your browser, and keeps running in this window.
# Close this window (or press Ctrl+C) to stop the app.
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Download the macOS installer at https://nodejs.org and run it, then double-click this again."
  read -r -p "Press Enter to close."; exit 1
fi

# Seamless updates: if this folder is linked to a Git remote, pull the latest.
if [ -d .git ] && git remote get-url origin >/dev/null 2>&1; then
  echo "Checking for updates..."
  git pull --ff-only --quiet && echo "Up to date." || echo "(Couldn't pull updates; running what's here.)"
fi

# Install dependencies the first time, or whenever package.json changed.
if [ ! -d node_modules ] || [ package.json -nt node_modules/.installed ] || [ ! -f node_modules/.installed ]; then
  echo "Installing dependencies (about a minute)..."
  npm install --no-audit --no-fund || { read -r -p "Install failed. Press Enter to close."; exit 1; }
  touch node_modules/.installed
fi

# Stop a previous copy if one is still running on port 3000.
lsof -ti tcp:3000 | xargs kill 2>/dev/null

echo
echo "Distress Finder $(cat VERSION 2>/dev/null) — http://localhost:3000"
echo "Your data is kept in ~/DistressFinder (safe across app updates)."
echo "Keep this window open while you use the app. Close it to stop."
echo
( sleep 4; open "http://localhost:3000" ) &
npm run dev
