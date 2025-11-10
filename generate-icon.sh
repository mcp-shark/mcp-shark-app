#!/bin/bash

# Generate icon.png from og-image-source.png
# This script creates a 512x512 square icon for use with electron-builder

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/assets"
SOURCE="$ASSETS_DIR/og-image-source.png"
OUTPUT="$ASSETS_DIR/icon.png"

if [ ! -f "$SOURCE" ]; then
  echo "Error: Source image not found: $SOURCE"
  echo "Please copy og-image.png to assets/og-image-source.png first"
  exit 1
fi

echo "Generating icon.png from og-image-source.png..."

# Try ImageMagick first (v7 uses 'magick', v6 uses 'convert')
if command -v magick >/dev/null 2>&1; then
  echo "Using ImageMagick (v7)..."
  magick "$SOURCE" -resize 512x512^ -gravity center -extent 512x512 -background transparent "$OUTPUT"
  echo "✓ Generated $OUTPUT (512x512) using ImageMagick"
  exit 0
elif command -v convert >/dev/null 2>&1; then
  echo "Using ImageMagick (v6)..."
  convert "$SOURCE" -resize 512x512^ -gravity center -extent 512x512 -background transparent "$OUTPUT"
  echo "✓ Generated $OUTPUT (512x512) using ImageMagick"
  exit 0
fi

# Try sips (macOS)
if command -v sips >/dev/null 2>&1; then
  echo "Using sips (macOS)..."
  sips -z 512 512 "$SOURCE" --out "$OUTPUT" >/dev/null 2>&1
  echo "✓ Generated $OUTPUT (512x512) using sips"
  exit 0
fi

# Try Python with PIL/Pillow
if command -v python3 >/dev/null 2>&1; then
  python3 -c "
from PIL import Image
import sys

try:
    img = Image.open('$SOURCE')
    # Get square crop from center
    size = min(img.size)
    left = (img.width - size) // 2
    top = (img.height - size) // 2
    right = left + size
    bottom = top + size
    
    img_crop = img.crop((left, top, right, bottom))
    img_resize = img_crop.resize((512, 512), Image.Resampling.LANCZOS)
    img_resize.save('$OUTPUT')
    print('✓ Generated $OUTPUT (512x512) using Python PIL')
    sys.exit(0)
except ImportError:
    print('PIL/Pillow not installed')
    sys.exit(1)
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
" && exit 0
fi

echo "Error: No suitable tool found to generate icon"
echo ""
echo "Please install one of:"
echo "  - ImageMagick: brew install imagemagick"
echo "  - Python PIL: pip3 install Pillow"
echo ""
echo "Or manually create a 512x512 PNG from og-image-source.png and save as assets/icon.png"
exit 1

