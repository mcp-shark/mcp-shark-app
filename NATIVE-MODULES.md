# Native Module Rebuild Guide

## When to Use `rebuild:native`

The `rebuild:native` script rebuilds native modules (like `better-sqlite3`) for Electron's Node.js version instead of your system Node.js.

### Automatic (Runs Automatically)

The script runs automatically in these cases:

1. **After `npm install`** - The `postinstall` script runs:
   ```bash
   npm install
   # Automatically runs: electron-builder install-app-deps → install:mcp-shark → rebuild:native → build:mcp-shark-ui
   ```

2. **When building the app** - If you run `npm run build`, it will use the already-rebuilt modules from `postinstall`

### Manual (When You Need to Run It)

Run `npm run rebuild:native` manually in these situations:

#### 1. **After updating Electron version**
```bash
npm install electron@latest
npm run rebuild:native
```

#### 2. **After updating mcp-shark dependency**
```bash
npm update mcp-shark
npm run rebuild:native
```

#### 3. **If you get NODE_MODULE_VERSION errors**
If you see errors like:
```
The module was compiled against a different Node.js version using NODE_MODULE_VERSION 115. 
This version of Node.js requires NODE_MODULE_VERSION 128.
```

**Fix:**
```bash
npm run rebuild:native
```

#### 4. **After switching Node.js versions**
If you switch your system Node.js version, you may need to rebuild:
```bash
npm run rebuild:native
```

#### 5. **When native modules fail in the bundled app**
If the packaged app shows errors about native modules:
```bash
npm run rebuild:native
npm run build:mac  # or build:win, build:linux
```

#### 6. **After manually modifying node_modules**
If you manually edit files in `node_modules/mcp-shark`:
```bash
npm run rebuild:native
```

### Before Bundling/Building

**IMPORTANT**: Before building the packaged app, ensure native modules are rebuilt:

```bash
# Option 1: Run rebuild explicitly (recommended)
npm run rebuild:native
npm run build:mac  # or build:win, build:linux

# Option 2: Full clean rebuild (if unsure)
rm -rf node_modules
npm install  # This runs rebuild:native automatically
npm run build:mac
```

**Why?** The bundled app uses Electron's Node.js, so native modules must be compiled for Electron's NODE_MODULE_VERSION, not system Node.js.

### When You DON'T Need It

You don't need to run it manually if:

- ✅ You just ran `npm install` (it runs automatically)
- ✅ You're running in development mode (`npm start`) - uses system Node.js
- ✅ The app is working correctly
- ✅ You haven't changed Electron or mcp-shark versions
- ✅ You're building immediately after `npm install` (already rebuilt)

### What It Does

The script rebuilds `better-sqlite3` native module for Electron:

1. **Finds Electron version** - Gets the Electron version from `package.json`
2. **Rebuilds in mcp-shark/ui** - Rebuilds `better-sqlite3` in `node_modules/mcp-shark/ui/node_modules/better-sqlite3`
3. **Rebuilds in mcp-shark/mcp-server** - Rebuilds `better-sqlite3` in `node_modules/mcp-shark/mcp-server/node_modules/better-sqlite3` (if exists)
4. **Uses electron-rebuild** - Compiles the native module for Electron's NODE_MODULE_VERSION

### Quick Reference

```bash
# Automatic (runs on npm install)
npm install

# Manual (when needed)
npm run rebuild:native

# Full rebuild (if things are broken)
rm -rf node_modules
npm install  # This will run rebuild:native automatically
```

### Troubleshooting

**If rebuild fails:**
```bash
# Try installing electron-rebuild globally
npm install -g electron-rebuild

# Then run manually
cd node_modules/mcp-shark/ui/node_modules/better-sqlite3
npx electron-rebuild -f -w better-sqlite3
```

**If you get permission errors:**
```bash
# Make sure the script is executable
chmod +x rebuild-native.sh
```

### Summary

| Scenario | Action |
|----------|--------|
| First time setup | `npm install` (automatic) |
| After updating Electron | `npm run rebuild:native` |
| After updating mcp-shark | `npm run rebuild:native` |
| NODE_MODULE_VERSION error | `npm run rebuild:native` |
| Native module errors in app | `npm run rebuild:native` |
| Normal development | Not needed |
| Just installed dependencies | Already done automatically |

