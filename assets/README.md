# Assets

This directory contains application assets for the Electron app, such as icons and other resources.

## Application Icon

The application uses the MCP Shark logo (`icon.svg`) which is automatically converted to platform-specific formats during the build process.

### Icon Files

- `icon.svg` - Source SVG logo (512x512 viewBox)
- `icon.png` - PNG version (512x512) - can be generated from SVG
- `icon.icns` - macOS format (multi-resolution) - generated during build
- `icon.ico` - Windows format (multi-resolution) - generated during build

### Recommended Formats and Sizes

- **macOS**: 
  - ICNS format (multi-resolution)
  - Or 512x512 PNG (will be converted)
- **Windows**: 
  - ICO format (multi-resolution)
  - Or 256x256 PNG (will be converted)
- **Linux**: 
  - 512x512 PNG format

### electron-builder Configuration

The icon is automatically detected by electron-builder. To specify a custom icon path, update the `build` section in `package.json`:

```json
{
  "build": {
    "mac": {
      "icon": "assets/icon.icns"
    },
    "win": {
      "icon": "assets/icon.ico"
    },
    "linux": {
      "icon": "assets/icon.png"
    }
  }
}
```

## Other Assets

You can also place other assets here that need to be bundled with the application, such as:
- Splash screens
- License files
- Documentation files
- Other static resources
