# MCP Shark App

> **Electron desktop application for MCP Shark - Aggregate multiple Model Context Protocol (MCP) servers into a single unified interface**

MCP Shark App is a cross-platform Electron application that provides a desktop interface for MCP Shark. It uses mcp-shark as an npm dependency, providing a seamless experience for aggregating and monitoring multiple MCP servers.

## 🎯 Features

- **🖥️ Desktop Application**: Native Electron app for Windows, macOS, and Linux
- **📦 NPM Dependency**: Uses mcp-shark as an npm package directly from GitHub
- **🔧 Easy Setup**: Simple `npm install` to get everything set up automatically
- **🔄 Process Management**: Automatically manages MCP server and UI server processes
- **🌐 Integrated UI**: Built-in browser window for the MCP Shark monitoring interface
- **🔨 Auto-Build**: Automatically builds the UI on first run if needed
- **🔌 Port Management**: Automatically handles port conflicts and cleans up processes
- **🧹 Clean Exit**: Comprehensive cleanup of all child processes on app exit

## 📋 Requirements

### For Developers
- **Node.js** 18+ (required for building and development)
- **npm** (comes with Node.js)
- **Git** (for installing mcp-shark from GitHub)

### For End Users (Packaged App)
- **No Node.js needed!** The packaged app includes everything and uses Electron's bundled Node.js runtime.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for detailed information.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm (for development only)
- Git (for cloning)

### Installation

1. Clone or navigate to this directory:
```bash
cd mcp-shark-app
```

2. Install dependencies:
```bash
npm install
```
This automatically:
- Installs all dependencies
- Installs mcp-shark and its dependencies
- **Rebuilds native modules for Electron** (via `rebuild:native`)
- Builds the UI

3. Run the app:
```bash
npm start
```

### Rebuilding Native Modules

If you encounter `NODE_MODULE_VERSION` errors or update Electron/mcp-shark:

```bash
npm run rebuild:native
```

See [NATIVE-MODULES.md](./NATIVE-MODULES.md) for details.

The app will:
- Install mcp-shark and all its dependencies (via npm)
- Automatically build the UI if not already built
- Start the UI server on port 9853
- Open the Electron window with the MCP Shark interface

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This runs the app with developer tools enabled. The Electron DevTools will be automatically opened for debugging.

### Building for Production

Build for your current platform:
```bash
npm run build
```

Build for specific platforms:
```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

Build for all platforms at once:
```bash
npm run build:all
```

This will create installers for macOS, Windows, and Linux in the `dist/` directory.

## 📁 Project Structure

```
mcp-shark-app/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.js        # Main entry point and window management
│   │   ├── server-manager.js   # Manages MCP server process
│   │   └── ui-manager.js       # Manages UI server process and builds
│   └── preload/           # Preload scripts
│       └── preload.js     # Exposes safe IPC APIs to renderer
├── assets/                # App assets (icons, etc.)
├── package.json           # Dependencies and build config
├── SETUP.md               # Detailed setup instructions
└── README.md              # This file
```

## 🔧 How It Works

1. **Installation**: 
   - `npm install` downloads mcp-shark from GitHub and installs it as a dependency
   - Post-install script automatically:
     - Installs Electron native dependencies
     - Runs `npm run install:all` in mcp-shark to install sub-dependencies
     - Builds the UI (`npm run build` in mcp-shark/ui)

2. **Launch**:
   - App locates mcp-shark in `node_modules/mcp-shark`
   - Checks if UI is built (looks for `dist/index.html`)
   - If not built, automatically builds the UI using Vite
   - Checks for port conflicts and automatically frees ports if needed
   - Starts the UI server on port 9853
   - Opens the Electron window pointing to `http://localhost:9853`

3. **Process Management**:
   - Electron main process manages both MCP server and UI server as child processes
   - Automatically detects and kills child processes (including npm and node processes)
   - Cleans up processes on ports 9851 and 9853 on app exit
   - Provides IPC APIs for the renderer to control servers
   - Handles SIGINT, SIGTERM, and window close events for proper cleanup

## 📝 Configuration

The app uses mcp-shark directly from `node_modules/mcp-shark`. 

### Updating mcp-shark

To update to a newer version:

```bash
npm update mcp-shark
npm run install:mcp-shark
npm run build:mcp-shark-ui
```

Or reinstall everything:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Port Configuration

The app uses fixed ports:
- **UI Server**: Port 9853
- **MCP Server**: Port 9851

These ports are automatically managed - the app will free them if in use. To change ports, modify the port constants in:
- `src/main/ui-manager.js` (UI server port)
- `src/main/server-manager.js` (MCP server port)

## 🔌 API

The preload script exposes the following APIs to the renderer:

```javascript
// Start/stop MCP server
await window.electronAPI.startMCPServer(configPath);
await window.electronAPI.stopMCPServer();
await window.electronAPI.isMCPServerRunning();

// Check UI server status
await window.electronAPI.isUIServerRunning();

// Get version info
await window.electronAPI.getAppVersion();
await window.electronAPI.getMCPSharkVersion();
```

## 🐛 Troubleshooting

### App won't start
- Check that Node.js 18+ is installed: `node --version`
- Ensure you have internet connection (for npm install)
- Check Electron console or terminal output for errors
- Verify mcp-shark was installed: `ls node_modules/mcp-shark`

### Package installation fails
- Verify internet connection
- Check that you have access to GitHub (for git-based npm install)
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again
- If mcp-shark install fails, try manually: `cd node_modules/mcp-shark && npm run install:all`

### UI build fails
- Check that all dependencies are installed: `cd node_modules/mcp-shark/ui && npm list`
- Try building manually: `cd node_modules/mcp-shark/ui && npm run build`
- Check for Vite errors in the console output
- Ensure Node.js version is 18 or higher

### Port conflicts
- The app automatically detects and frees ports 9851 and 9853
- If issues persist, manually kill processes: `lsof -ti:9853 | xargs kill -9`
- Check for other instances: `ps aux | grep -E "(npm|node.*server)"`

### Processes not cleaning up on exit
- The app should automatically clean up all child processes
- If processes remain, they will be killed on next app start (port cleanup)
- Manually clean up: `lsof -ti:9853,9851 | xargs kill -9`

## 📦 Distribution

The app can be packaged for distribution using electron-builder:

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac    # macOS (DMG and ZIP)
npm run build:win    # Windows (NSIS installer and portable)
npm run build:linux  # Linux (AppImage and DEB)

# Build for ALL platforms at once
npm run build:all    # Creates installers for macOS, Windows, and Linux
```

**Before Building**: Ensure native modules are rebuilt for Electron:

```bash
# If you just ran npm install, rebuild:native already ran automatically
# But if you're unsure or had issues, run:
npm run rebuild:native
npm run build:mac
```

Built applications will be in the `dist/` directory.

**Note**: 
- The packaged app includes mcp-shark and all its dependencies, so the final package size will be larger
- The UI is pre-built during the packaging process
- **Native modules must be rebuilt for Electron** (done automatically in `postinstall`, or run `npm run rebuild:native` manually)
- Building for all platforms requires the build tools for each platform (you can only build macOS on Mac, Windows on Windows, etc.)
- For cross-platform building, consider using CI/CD services like GitHub Actions

## 🔗 Related Projects

- **[mcp-shark](../mcp-shark)**: The core MCP Shark server and UI components
- **[mcp-shark-common](../mcp-shark-common)**: Shared utilities for database and configuration management

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please ensure your code follows the project's style guidelines.

---

**Built with ❤️ using Electron and MCP Shark**

