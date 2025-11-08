# MCP Shark App

> **Electron desktop application for MCP Shark - Aggregate multiple Model Context Protocol (MCP) servers into a single unified interface**

MCP Shark App is a cross-platform Electron application that provides a desktop interface for MCP Shark. It uses mcp-shark as an npm dependency, providing a seamless experience for aggregating and monitoring multiple MCP servers.

## 🎯 Features

- **🖥️ Desktop Application**: Native Electron app for Windows, macOS, and Linux
- **📦 NPM Dependency**: Uses mcp-shark as an npm package (from GitHub)
- **🔧 Easy Setup**: Simple npm install to get everything set up
- **🔄 Process Management**: Automatically manages MCP server and UI server processes
- **🌐 Integrated UI**: Built-in browser window for the MCP Shark monitoring interface

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
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

3. Run the app:
```bash
npm start
```

The app will:
- Install mcp-shark and all its dependencies (via npm)
- Start the UI server
- Open the Electron window with the MCP Shark interface

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This runs the app with developer tools enabled and will re-download the release if needed.

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

Built applications will be in the `dist/` directory.

## 📁 Project Structure

```
mcp-shark-app/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.js        # Main entry point
│   │   ├── release-manager.js  # Handles GitHub release download
│   │   ├── server-manager.js   # Manages MCP server process
│   │   └── ui-manager.js       # Manages UI server process
│   └── preload/           # Preload scripts
│       └── preload.js     # Exposes safe APIs to renderer
├── assets/                # App assets (icons, etc.)
├── package.json
└── README.md
```

## 🔧 How It Works

1. **Installation**: 
   - `npm install` downloads mcp-shark from GitHub and installs it as a dependency
   - Post-install script runs `npm run install:all` in mcp-shark to install sub-dependencies

2. **Launch**:
   - App locates mcp-shark in `node_modules/mcp-shark`
   - Starts the UI server from the npm package
   - Opens the Electron window

3. **Process Management**:
   - Electron main process manages both MCP server and UI server
   - Automatically cleans up processes on app quit
   - Provides IPC APIs for the renderer to control servers

## 📝 Configuration

The app uses mcp-shark directly from `node_modules/mcp-shark`. To update to a newer version:

```bash
npm update mcp-shark
npm run install:mcp-shark
```

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
- Check that Node.js 18+ is installed
- Ensure you have internet connection (for first-time download)
- Check console output for errors

### Package installation fails
- Verify internet connection
- Check that you have access to GitHub (for git-based npm install)
- Try deleting `node_modules` and running `npm install` again

### Server won't start
- Check that npm dependencies were installed correctly
- Verify the release was extracted properly
- Check console logs for specific errors

## 📦 Distribution

The app can be packaged for distribution using electron-builder:

```bash
npm run build
```

This creates platform-specific installers:
- **macOS**: DMG and ZIP
- **Windows**: NSIS installer and portable executable
- **Linux**: AppImage and DEB package

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please ensure your code follows the project's style guidelines.

---

**Built with ❤️ using Electron and MCP Shark**

