#!/bin/bash
# Double-click after downloading a new distress-finder zip from Claude.
# Finds the NEWEST download (distress-finder.zip, "distress-finder (2).zip",
# or a folder Safari already unzipped), installs it over this app, and
# restarts the app. Your data in ~/DistressFinder is never touched.
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
DL="$HOME/Downloads"

# Newest matching zip or already-extracted folder in Downloads (ignoring ones we've installed).
SRC_ZIP="$(ls -t "$DL"/distress-finder*.zip 2>/dev/null | grep -v installed | head -1)"
SRC_DIR="$(ls -td "$DL"/distress-finder*/ 2>/dev/null | head -1)"
TMP=""
if [ -n "$SRC_ZIP" ] && { [ -z "$SRC_DIR" ] || [ "$SRC_ZIP" -nt "$SRC_DIR" ]; }; then
  echo "Unpacking $(basename "$SRC_ZIP")..."
  TMP="$(mktemp -d)"
  unzip -q "$SRC_ZIP" -d "$TMP" || { read -r -p "Unzip failed. Press Enter to close."; exit 1; }
  SRC="$(find "$TMP" -maxdepth 2 -name package.json -exec dirname {} \; | head -1)"
elif [ -n "$SRC_DIR" ] && [ -f "$SRC_DIR/package.json" ]; then
  echo "Using unzipped folder $(basename "$SRC_DIR")..."
  SRC="${SRC_DIR%/}"
else
  echo "Couldn't find a new distress-finder zip (or folder) in $DL."
  echo "Download the new one from Claude first, then run this again."
  read -r -p "Press Enter to close."; exit 1
fi

NEWVER="$(cat "$SRC/VERSION" 2>/dev/null || echo unknown)"
OLDVER="$(cat VERSION 2>/dev/null || echo unknown)"
echo "Installing version $NEWVER (replacing $OLDVER)..."

# Stop a running copy so files aren't swapped under it.
lsof -ti tcp:3000 | xargs kill 2>/dev/null; sleep 1

rsync -a --delete --exclude node_modules --exclude .env.local --exclude .next --exclude data/db.json "$SRC/" "./" \
  || { read -r -p "Copy failed. Press Enter to close."; exit 1; }
rm -rf .next
rm -f node_modules/.installed          # forces a dependency refresh on next start
[ -n "$TMP" ] && rm -rf "$TMP"
[ -n "$SRC_ZIP" ] && mv "$SRC_ZIP" "$DL/distress-finder-installed-$NEWVER.zip" 2>/dev/null
[ -z "$SRC_ZIP" ] && [ -n "$SRC_DIR" ] && mv "${SRC_DIR%/}" "$DL/distress-finder-installed-$NEWVER" 2>/dev/null

echo "Installed $NEWVER. Starting the app..."
open "$(pwd)/Start Distress Finder.command"
