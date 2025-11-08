# Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the app:**
   ```bash
   npm start
   ```

   On first run, the app will:
   - Use mcp-shark from node_modules (installed via npm)
   - Start the UI server
   - Open the Electron window

3. **Development mode:**
   ```bash
   npm run dev
   ```
   This enables developer tools and will re-download the release if needed.

## Building for Distribution

### Before Building

**Important**: Ensure native modules are rebuilt for Electron before bundling:

```bash
# If you just ran npm install, this already happened automatically
# But to be safe, especially if you had errors:
npm run rebuild:native
```

### Build for current platform:
```bash
npm run build
```

### Build for specific platforms:
```bash
# macOS
npm run build:mac

# Windows  
npm run build:win

# Linux
npm run build:linux
```

### Build for ALL platforms at once:
```bash
npm run build:all
```

This will create installers for macOS, Windows, and Linux in the `dist/` directory.

**Note**: 
- Building for all platforms has limitations:
  - You can only build macOS on a Mac
  - You can only build Windows on Windows
  - You can build Linux on Linux or Mac
  - For true cross-platform building, use CI/CD (GitHub Actions, etc.)
- **Native modules must be rebuilt for Electron** before bundling (runs automatically in `postinstall`, or run `npm run rebuild:native` manually)

Built applications will be in the `dist/` directory.

## Troubleshooting

### First-time installation is slow
This is normal - npm installs mcp-shark from GitHub and all its dependencies. Subsequent launches are much faster.

### Port conflicts
If ports 9851 (MCP server) or 9853 (UI server) are already in use, the app will fail to start. Close other instances or change the ports in the code.

### Package installation fails
- Check your internet connection
- Verify GitHub is accessible (for git-based npm install)
- Try deleting `node_modules` and running `npm install` again

### Dependencies fail to install
- Ensure Node.js 18+ is installed
- Check that npm is working: `npm --version`
- Try manually installing: `cd node_modules/mcp-shark && npm run install:all`

## Package Location

The app uses mcp-shark from:
- **Development**: `node_modules/mcp-shark/`
- **Packaged App**: Included in the app bundle

To update mcp-shark, run:
```bash
npm update mcp-shark
npm run install:mcp-shark
```

