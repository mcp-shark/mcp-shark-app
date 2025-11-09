# Building the App

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** (comes with Node.js)
3. **Git** (for GitHub dependencies)

## Step-by-Step Build Instructions

### 1. Install Dependencies

```bash
npm install
```

This will:
- Install Electron and electron-builder
- Install mcp-shark from GitHub
- Install mcp-shark's dependencies
- Rebuild native modules for Electron
- Build the mcp-shark UI

**Note:** If you get authentication errors for GitHub, you may need to:
- Set up a GitHub Personal Access Token
- Or use SSH: `git config --global url."git@github.com:".insteadOf "https://github.com/"`

### 2. Build for macOS

```bash
npm run build:mac
```

This creates:
- `dist/mac/MCP Shark.app` - The app bundle (run this!)
- `dist/mac/MCP Shark-1.0.0-mac.zip` - ZIP archive
- `dist/MCP Shark-1.0.0.dmg` - DMG installer

### 3. Run the App

```bash
open "dist/mac/MCP Shark.app"
```

Or double-click `MCP Shark.app` in Finder.

## Troubleshooting

### npm install fails

**GitHub authentication:**
```bash
# Option 1: Use SSH
git config --global url."git@github.com:".insteadOf "https://github.com/"

# Option 2: Use GitHub token
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

**Network issues:**
- Check your internet connection
- Try: `npm install --verbose` to see detailed errors

### Build fails

**Native module errors:**
```bash
# Rebuild native modules manually
npm run rebuild:native
npm run build:mac
```

**Missing UI build:**
```bash
# Build UI manually
npm run build:mcp-shark-ui
npm run build:mac
```

### App won't start

- Check debug logs (should appear automatically)
- Verify ports 9851 and 9853 are available
- Check Console.app for system errors

## Quick Build Command

```bash
# Full build from scratch
npm install && npm run build:mac && open "dist/mac/MCP Shark.app"
```

