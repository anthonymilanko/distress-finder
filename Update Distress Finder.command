#!/bin/bash
# Double-click after downloading a new distress-finder.zip from Claude.
# It replaces this app's files with the new version. Your data in
# ~/DistressFinder is not touched.
cd "$(dirname "$0")" || exit 1
ZIP="$HOME/Downloads/distress-finder.zip"
if [ ! -f "$ZIP" ]; then
  echo "Couldn't find $ZIP"
  echo "Download the new distress-finder.zip to your Downloads folder, then run this again."
  read -r -p "Press Enter to close."; exit 1
fi
TMP="$(mktemp -d)"
echo "Unpacking..."
unzip -q "$ZIP" -d "$TMP" || { read -r -p "Unzip failed. Press Enter to close."; exit 1; }
SRC="$TMP/distress-finder"
[ -d "$SRC" ] || SRC="$(find "$TMP" -maxdepth 2 -name package.json -exec dirname {} \; | head -1)"
echo "Updating app files (keeping node_modules and .env.local)..."
rsync -a --delete --exclude node_modules --exclude .env.local --exclude .next --exclude data/db.json "$SRC/" "./"
rm -rf "$TMP"
rm -f node_modules/.installed   # forces a dependency refresh on next start
mv "$ZIP" "$HOME/Downloads/distress-finder-installed-$(date +%Y%m%d-%H%M).zip"
echo "Done. Double-click 'Start Distress Finder' to run the new version."
read -r -p "Press Enter to close."
