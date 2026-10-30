#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/public/icons"
mkdir -p "$DIR"
if command -v convert >/dev/null 2>&1; then
  convert -size 512x512 xc:'#1a2332' \
    -fill '#3b82f6' -draw 'roundrectangle 40,40 472,472 64,64' \
    -fill white -font DejaVu-Sans-Bold -pointsize 220 -gravity center -annotate +0+10 'B' \
    "$DIR/icon-512.png"
  convert "$DIR/icon-512.png" -resize 192x192 "$DIR/icon-192.png"
  convert "$DIR/icon-512.png" -resize 180x180 "$DIR/apple-touch-icon.png"
  convert "$DIR/icon-512.png" -resize 32x32 "$DIR/favicon-32.png"
  echo "Iconos generados en $DIR"
else
  echo "ImageMagick no disponible. Usa el icon.svg incluido."
fi
