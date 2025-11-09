# Assets

This directory contains application assets for the Electron app, such as icons and other resources.

## Application Icon

Place your application icon here. The app will work without an icon, but adding one provides a better user experience.

### Recommended Formats and Sizes

- **macOS**: 
  - ICNS format (multi-resolution)
  - Or 512x512 PNG (will be converted)
- **Windows**: 
  - ICO format (multi-resolution)
  - Or 256x256 PNG (will be converted)
- **Linux**: 
  - 512x512 PNG format

### Icon Naming

You can name your icon file:
- `icon.png` - Will be automatically converted to platform-specific formats
- `icon.icns` - macOS format
- `icon.ico` - Windows format

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

