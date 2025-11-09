# Generating Icon Files

The shark logo is provided as `icon.svg`. To generate platform-specific icon files:

## Option 1: Using ImageMagick (Recommended)

```bash
# Generate 512x512 PNG (works for all platforms)
convert -background none -resize 512x512 assets/icon.svg assets/icon.png

# For macOS, generate ICNS (requires iconutil or online converter)
# For Windows, generate ICO (requires online converter or ImageMagick with additional tools)
```

## Option 2: Using Online Converters

1. **SVG to PNG**: Use [CloudConvert](https://cloudconvert.com/svg-to-png) or similar
   - Upload `icon.svg`
   - Set size to 512x512
   - Download as `icon.png`

2. **PNG to ICNS (macOS)**: Use [CloudConvert](https://cloudconvert.com/png-to-icns) or [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html)
   ```bash
   # Create iconset directory
   mkdir icon.iconset
   # Generate different sizes
   sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
   sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
   sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
   sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
   sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
   sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
   sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
   sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
   sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
   sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
   # Generate ICNS
   iconutil -c icns icon.iconset
   ```

3. **PNG to ICO (Windows)**: Use [CloudConvert](https://cloudconvert.com/png-to-ico) or [IcoFX](https://icofx.ro/)

## Option 3: Using Node.js Script

Install required packages:
```bash
npm install --save-dev sharp
```

Then run:
```bash
node -e "const sharp = require('sharp'); sharp('assets/icon.svg').resize(512, 512).png().toFile('assets/icon.png').then(() => console.log('Generated icon.png'));"
```

## Current Status

- ✅ `icon.svg` - Source SVG logo (ready)
- ⏳ `icon.png` - Needs to be generated (512x512 recommended)
- ⏳ `icon.icns` - macOS format (optional, electron-builder can generate from PNG)
- ⏳ `icon.ico` - Windows format (optional, electron-builder can generate from PNG)

**Note**: electron-builder can automatically convert PNG to platform-specific formats during build, so `icon.png` is the minimum requirement.

