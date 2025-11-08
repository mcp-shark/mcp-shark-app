# How Electron App Bundling Works

## Why Bundle Dependencies?

**Electron apps MUST bundle all dependencies** because:

1. **Users don't have Node.js/npm installed** - Most end users don't have Node.js, npm, or development tools
2. **Self-contained requirement** - Electron apps are meant to be standalone applications
3. **Offline functionality** - The app should work without internet connection
4. **Performance** - Installing dependencies at runtime would be slow and error-prone
5. **Security** - Users shouldn't need to run `npm install` with potential security risks

## Build Commands

### Development
```bash
npm start        # Run app in development mode
npm run dev      # Run with DevTools enabled
```

### Production Builds
```bash
npm run build        # Build for current platform
npm run build:mac    # Build for macOS (DMG and ZIP)
npm run build:win    # Build for Windows (NSIS and portable)
npm run build:linux  # Build for Linux (AppImage and DEB)
npm run build:all    # Build for ALL platforms at once
```

**Note**: `build:all` will build for all platforms that are possible on your current OS:
- On macOS: builds macOS + Linux (Windows skipped)
- On Windows: builds Windows only
- On Linux: builds Linux only

For true cross-platform builds, use CI/CD services like GitHub Actions.

## How It Works

### Development Mode (`npm start`)
- Uses `node_modules` from your project directory
- Dependencies are installed via `npm install`
- Code runs directly from source

### Production Build (`npm run build`)
- **electron-builder packages everything**:
  - Your source code (`src/**/*`)
  - All `node_modules` (including nested ones from mcp-shark)
  - Everything is bundled into `app.asar` (a single archive file)
  - Native modules are unpacked outside ASAR (they can't run from inside)

### Running the Packaged App
- When users run the installed app:
  1. Code looks for dependencies in `app.asar/node_modules/`
  2. Falls back to unpacked `node_modules/` for native modules
  3. Everything is already there - **no installation needed**

## Current Configuration

```json
"files": [
  "src/**/*",
  "package.json",
  "node_modules/**/*"  // ← This bundles ALL dependencies
],
"asar": true,
"asarUnpack": [
  "**/node_modules/better-sqlite3/**/*",
  "**/node_modules/@swc/core*/**/*",
  "**/node_modules/*/build/**/*",
  "**/node_modules/*/*.node"
]
```

This ensures:
- ✅ All direct dependencies are included
- ✅ All nested dependencies from `mcp-shark` are included
- ✅ All nested dependencies from `mcp-shark/mcp-server` are included
- ✅ All nested dependencies from `mcp-shark/ui` are included
- ✅ Native modules are unpacked (can't run from ASAR)
- ✅ The app is completely self-contained

## What Gets Bundled

When you run `npm run build` (or `build:mac`, `build:win`, `build:linux`, `build:all`), electron-builder:

1. **Reads your `package.json` dependencies**
2. **Includes all `node_modules` recursively** (because of `node_modules/**/*`)
3. **Packages into ASAR archive** (faster, smaller, single file)
4. **Unpacks native modules** (better-sqlite3, .node files, etc.) - they can't run from inside ASAR
5. **Creates platform-specific installers**:
   - **macOS**: DMG and ZIP
   - **Windows**: NSIS installer and portable executable
   - **Linux**: AppImage and DEB package

All outputs are placed in the `dist/` directory.

## Alternative (NOT Recommended)

If you **don't bundle** dependencies, the app would need to:
- ❌ Require users to have Node.js installed
- ❌ Run `npm install` at first launch (slow, error-prone)
- ❌ Require internet connection
- ❌ Handle installation errors
- ❌ Defeat the purpose of a desktop app

**This is why bundling is the standard approach for Electron apps.**

## Package Size

Including all `node_modules` increases package size, but:
- Modern apps are typically 100-500MB (acceptable)
- Users download once, install once
- Much better UX than requiring npm installation
- Standard practice for all Electron apps (VS Code, Slack, Discord, etc.)

### Size Breakdown
- **App code**: ~1-5MB
- **Electron runtime**: ~50-100MB
- **Dependencies**: ~50-200MB (including mcp-shark and all nested deps)
- **Native modules**: ~10-50MB (unpacked outside ASAR)
- **Total**: ~150-400MB (varies by platform)

## Build Output Structure

After building, the `dist/` directory contains:

```
dist/
├── mac/
│   ├── MCP Shark-1.0.0.dmg          # macOS installer
│   └── MCP Shark-1.0.0-mac.zip      # macOS ZIP
├── win-unpacked/                     # Windows portable
├── MCP Shark Setup 1.0.0.exe         # Windows installer
├── linux-unpacked/                   # Linux AppImage contents
├── MCP Shark-1.0.0.AppImage          # Linux AppImage
└── mcp-shark-app_1.0.0_amd64.deb    # Linux DEB package
```

## Summary

**The current configuration is correct** - bundling all dependencies ensures:
- ✅ App works out of the box
- ✅ No user setup required
- ✅ Works offline
- ✅ Professional user experience
- ✅ Standard Electron app practice

