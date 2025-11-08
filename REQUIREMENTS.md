# Requirements

## For Developers (Building the App)

**You MUST have Node.js installed** to build and develop this app:

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Git**: For installing `mcp-shark` from GitHub

### Why Developers Need Node.js

1. **Installing dependencies**: `npm install` requires Node.js
2. **Building the app**: `npm run build` uses Node.js tools
3. **Development mode**: `npm start` runs Electron with Node.js
4. **Building UI**: The UI build process uses Vite (Node.js tool)

### Installation

```bash
# Install Node.js from https://nodejs.org/
# Then install dependencies
npm install

# Run in development
npm start

# Build for production
npm run build
```

## For End Users (Running the Packaged App)

**✅ You do NOT need Node.js installed** to run the packaged app!

The packaged Electron app is **completely self-contained** and includes:
- ✅ **Electron runtime** (includes bundled Node.js)
- ✅ **All dependencies** (bundled in the app, including mcp-shark)
- ✅ **mcp-shark dependency** (runs via Electron's Node.js, not system Node.js)
- ✅ **Pre-built UI** (built during packaging, never rebuilt at runtime)

### How It Works

When you run the packaged app:

1. **Electron provides Node.js**: The app uses `process.execPath` with `ELECTRON_RUN_AS_NODE=1` to run Node.js scripts using Electron's bundled Node.js
2. **No system Node.js needed**: All Node.js execution happens through Electron's runtime
3. **No npm/npx calls**: The UI is pre-built during packaging, so no build tools are needed at runtime
4. **Self-contained**: Everything needed is bundled in the app package

### Code Verification

The app detects if it's packaged and uses different execution paths:

**Packaged App (No Node.js needed):**
```javascript
const isPackaged = !!process.resourcesPath;
const nodeExecutable = isPackaged ? process.execPath : 'node';
// Uses Electron's bundled Node.js via process.execPath
```

**Development (Node.js required):**
```javascript
const nodeExecutable = 'node'; // Uses system Node.js
```

The UI build function (`buildUI`) is **never called** in packaged apps - it only runs in development mode.

### Platform Requirements

- **macOS**: 10.13 or later
- **Windows**: Windows 7 or later
- **Linux**: Most modern distributions

No additional software installation required!

## Summary

| Scenario | Node.js Required? |
|----------|------------------|
| **Developer building the app** | ✅ **YES** - Required for npm, build tools |
| **Developer running `npm start`** | ✅ **YES** - Uses system Node.js |
| **End user running packaged app** | ❌ **NO** - Uses Electron's bundled Node.js |
| **End user installing the app** | ❌ **NO** - Just install and run |

## Technical Details

### Development Mode
```javascript
// Uses system Node.js
const nodeExecutable = 'node';
spawn('node', [serverScript], ...);
```

### Packaged App Mode
```javascript
// Uses Electron's bundled Node.js
const nodeExecutable = process.execPath; // Electron executable
spawn(process.execPath, [serverScript], {
  env: {
    ELECTRON_RUN_AS_NODE: '1' // Tells Electron to run as Node.js
  }
});
```

The `ELECTRON_RUN_AS_NODE=1` environment variable tells Electron to execute the script as a Node.js process instead of launching the Electron GUI. This is the standard way to run Node.js scripts from within Electron apps.

## Verification

To verify the packaged app doesn't need Node.js:

1. **Build the app**: `npm run build:mac` (or win/linux)
2. **Install on a clean system** without Node.js
3. **Run the app** - it should work perfectly!

The app will use Electron's bundled Node.js runtime, which is included in every Electron app package.

