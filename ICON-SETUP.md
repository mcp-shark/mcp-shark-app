# Icon Setup for MCP Shark App

This guide explains how to set up the app icons for Windows, macOS, and Linux using the og-image.png logo.

## Quick Start

1. **Copy the source image:**
   ```bash
   cp /Users/ruwan/dev/mcp-shark-site/public/og-image.png assets/og-image-source.png
   ```

2. **Generate the icon:**
   ```bash
   npm run generate-icon
   ```
   
   Or manually:
   ```bash
   ./generate-icon.sh
   ```

## What Gets Generated

The script creates `assets/icon.png` (512x512) which electron-builder will automatically convert to:
- **macOS**: ICNS format (multi-resolution icon set)
- **Windows**: ICO format (multi-resolution icon)
- **Linux**: PNG format (used as-is)

## Manual Generation

If the automated script doesn't work, you can generate the icon manually:

### Using ImageMagick (v7)
```bash
magick assets/og-image-source.png -resize 512x512^ -gravity center -extent 512x512 -background transparent assets/icon.png
```

### Using ImageMagick (v6)
```bash
convert assets/og-image-source.png -resize 512x512^ -gravity center -extent 512x512 -background transparent assets/icon.png
```

### Using sips (macOS only)
```bash
sips -z 512 512 assets/og-image-source.png --out assets/icon.png
```

### Using Online Tools
1. Open `assets/og-image-source.png` in an image editor
2. Crop/resize to 512x512 (square, centered)
3. Save as `assets/icon.png`

## Current Configuration

The `package.json` is already configured to use `assets/icon.png` for all platforms:

```json
{
  "build": {
    "mac": {
      "icon": "assets/icon.png"  // Converts to ICNS
    },
    "win": {
      "icon": "assets/icon.png"  // Converts to ICO
    },
    "linux": {
      "icon": "assets/icon.png"  // Uses PNG directly
    }
  }
}
```

## Verification

After generating the icon, verify it exists:
```bash
ls -lh assets/icon.png
```

The file should be approximately 512x512 pixels. electron-builder will handle the platform-specific conversions during the build process.

## Troubleshooting

If icon generation fails:
1. Ensure ImageMagick or sips is installed
2. Check that `og-image-source.png` exists in the `assets/` directory
3. Try the manual methods listed above
4. Use an online image editor to create a 512x512 square version

## Notes

- The og-image.png is typically 1200x630 (Open Graph standard), so it needs to be cropped/resized to square
- electron-builder automatically creates multi-resolution icons (ICNS/ICO) from a single PNG
- The icon is also used in the app window (see `src/main/main.js`)

