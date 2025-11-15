# 🦈 MCP Shark App v1.2.0 - Alpha Release

> ⚠️ **ALPHA VERSION** - This is an alpha release. The software is under active development and testing. Features may change, and there may be bugs. Use at your own risk.

## 🎉 What is MCP Shark App?

MCP Shark App is a **cross-platform desktop application** for MCP Shark. It provides a native Electron interface for aggregating and monitoring multiple Model Context Protocol (MCP) servers.

## ✨ Features

- 🖥️ **Desktop Application** - Native Electron app for Windows, macOS, and Linux
- 🔌 **Universal IDE Support** - Works with Cursor, Windsurf, Claude Code, and any MCP-compatible IDE
- 🎮 **Bundled MCP Playground** - Test and interact with MCP servers directly
- 📊 **Real-Time Traffic Monitoring** - Live web interface showing all MCP traffic
- 🔗 **Multi-Server Aggregation** - Connect multiple MCP servers (HTTP and stdio)
- 📝 **Comprehensive Audit Logging** - SQLite-based logging with performance metrics
- 🔧 **Easy Setup** - No Node.js needed - everything is bundled

## 📦 Downloads

### macOS (ARM64)

- **[MCP.Shark-1.2.0-arm64.dmg](https://github.com/mcp-shark/mcp-shark-app/releases/download/v1.2.0/MCP.Shark-1.2.0-arm64.dmg)** - DMG installer
- **[MCP.Shark-1.2.0-arm64-mac.zip](https://github.com/mcp-shark/mcp-shark-app/releases/download/v1.2.0/MCP.Shark-1.2.0-arm64-mac.zip)** - ZIP archive

**⚠️ macOS Gatekeeper Warning**: If you see "MCP Shark is damaged", right-click the app → Select "Open" → Click "Open" in the dialog. See [MACOS-GATEKEEPER-FIX.md](./MACOS-GATEKEEPER-FIX.md) for details.

### Windows (ARM64)

- **[MCP.Shark.Setup.1.2.0.exe](https://github.com/mcp-shark/mcp-shark-app/releases/download/v1.2.0/MCP.Shark.Setup.1.2.0.exe)** - NSIS installer
- **[MCP.Shark.1.2.0.exe](https://github.com/mcp-shark/mcp-shark-app/releases/download/v1.2.0/MCP.Shark.1.2.0.exe)** - Portable executable

### Linux (ARM64)

- **[MCP.Shark-1.2.0-arm64.AppImage](https://github.com/mcp-shark/mcp-shark-app/releases/download/v1.2.0/MCP.Shark-1.2.0-arm64.AppImage)** - AppImage (make executable: `chmod +x`)
- **[mcp-shark-app_1.2.0_arm64.deb](https://github.com/mcp-shark/mcp-shark-app/releases/download/v1.2.0/mcp-shark-app_1.2.0_arm64.deb)** - Debian package

## 🚀 Quick Start

1. **Download** the installer for your platform
2. **Install** (or extract for portable versions)
3. **Launch** MCP Shark
4. The app will automatically:
   - Start the UI server on port 9853
   - Open the MCP Shark interface in a window
   - Guide you through setup with an interactive tour

## 📋 What's Included

- MCP Shark server and UI (bundled)
- MCP Playground for testing servers
- SQLite audit logging
- Configuration management
- Automatic IDE config detection

## 🔧 System Requirements

- **macOS**: macOS 10.13+ (ARM64)
- **Windows**: Windows 10+ (ARM64)
- **Linux**: Modern Linux distribution (ARM64)

**Note**: These are ARM64 builds. x64 builds coming soon.

## ⚠️ Important Notes

- **Alpha version** - features may change
- Report issues: [GitHub Issues](https://github.com/mcp-shark/mcp-shark-app/issues)
- Database location: `~/.mcp-shark/db/mcp-shark.sqlite` (or `%APPDATA%/.mcp-shark/db/` on Windows)
- Configs are automatically backed up before changes

## 🔗 Related Projects

- **[mcp-shark](https://github.com/mcp-shark/mcp-shark)** - Core MCP Shark server and UI
- **[mcp-shark-site](https://github.com/mcp-shark/mcp-shark-site)** - Official website

## 📚 Documentation

- [Full README](./README.md)
- [Build Instructions](./BUILD.md)
- [macOS Gatekeeper Fix](./MACOS-GATEKEEPER-FIX.md)

---

**Built with ❤️ using Electron and MCP Shark**

