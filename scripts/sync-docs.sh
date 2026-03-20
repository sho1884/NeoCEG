#!/bin/bash
# Sync NeoCEG documentation to public-files repository for MkDocs deployment.
# Usage: ./scripts/sync-docs.sh [--push]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NEOCEG_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_FILES_DIR="$(dirname "$NEOCEG_DIR")/public-files"

if [ ! -d "$PUBLIC_FILES_DIR" ]; then
  echo "Error: public-files repo not found at $PUBLIC_FILES_DIR"
  echo "Clone it: git clone https://github.com/sho1884/public-files.git"
  exit 1
fi

DEST="$PUBLIC_FILES_DIR/NeoCEG/docs"
mkdir -p "$DEST"

echo "Copying Doc/*.md -> $DEST/"
cp "$NEOCEG_DIR"/Doc/*.md "$DEST/"
cp -r "$NEOCEG_DIR"/Doc/requirements "$DEST/"

echo "Done. Files copied to $DEST"

if [ "$1" = "--push" ]; then
  cd "$PUBLIC_FILES_DIR"
  git add -A
  git commit -m "Update NeoCEG documentation"
  git push
  echo "Pushed to public-files."
fi
