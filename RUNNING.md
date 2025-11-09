# Running the Bundled App

## macOS

After building with `npm run build:mac`, you'll find the following files in the `dist/` directory:

### Option 1: Run the .app Bundle (Recommended)
```
dist/mac/MCP Shark.app
```

**To run:**
1. Navigate to `dist/mac/` folder
2. Double-click `MCP Shark.app`
3. Or from terminal: `open "dist/mac/MCP Shark.app"`

### Option 2: Install from DMG
```
dist/MCP Shark-1.0.0.dmg
```

**To install:**
1. Double-click the `.dmg` file
2. Drag `MCP Shark.app` to Applications folder
3. Open from Applications

### Option 3: Use the ZIP Archive
```
dist/mac/MCP Shark-1.0.0-mac.zip
```

**To use:**
1. Extract the ZIP file
2. Double-click `MCP Shark.app` inside

## File Structure

After building, your `dist/` directory will look like:

```
dist/
├── mac/
│   ├── MCP Shark.app          ← Run this!
│   └── MCP Shark-1.0.0-mac.zip
└── MCP Shark-1.0.0.dmg         ← Or install this
```

## First Time Running

**Important:** If you get a security warning on macOS:

1. **Right-click** (or Control+Click) on `MCP Shark.app`
2. Select **"Open"**
3. Click **"Open"** in the security dialog

This is because the app isn't code-signed. For distribution, you'll need to code-sign the app.

## Troubleshooting

### "App is damaged" error
- Right-click → Open (bypasses Gatekeeper)
- Or: `xattr -cr "dist/mac/MCP Shark.app"` in terminal

### App won't start
- Check the debug logs (should appear automatically if there's an error)
- Open Console.app to see system logs
- Check if ports 9851 and 9853 are available

### White screen
- The debug log viewer should appear automatically
- Check the logs for errors

## Quick Start

```bash
# Build the app
npm run build:mac

# Run the app
open "dist/mac/MCP Shark.app"

# Or from terminal
./dist/mac/MCP\ Shark.app/Contents/MacOS/MCP\ Shark
```

