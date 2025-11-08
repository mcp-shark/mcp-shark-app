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

