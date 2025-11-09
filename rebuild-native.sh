#!/bin/bash
# Rebuild native modules for Electron

echo "Rebuilding native modules for Electron..."

# Find Electron version
ELECTRON_VERSION=$(node -p "require('electron/package.json').version")
echo "Electron version: $ELECTRON_VERSION"

# Rebuild better-sqlite3 in mcp-shark/ui (this is where the error occurs)
if [ -d "node_modules/mcp-shark/ui/node_modules/better-sqlite3" ]; then
  echo "Rebuilding better-sqlite3 in mcp-shark/ui..."
  cd node_modules/mcp-shark/ui/node_modules/better-sqlite3
  npx electron-rebuild -v "$ELECTRON_VERSION" -f -w better-sqlite3 || npm rebuild better-sqlite3 --build-from-source || true
  cd ../../../../..
fi

# Rebuild better-sqlite3 in mcp-shark/mcp-server
if [ -d "node_modules/mcp-shark/mcp-server/node_modules/better-sqlite3" ]; then
  echo "Rebuilding better-sqlite3 in mcp-shark/mcp-server..."
  cd node_modules/mcp-shark/mcp-server/node_modules/better-sqlite3
  npx electron-rebuild -v "$ELECTRON_VERSION" -f -w better-sqlite3 || npm rebuild better-sqlite3 --build-from-source || true
  cd ../../../../..
fi

# Rebuild better-sqlite3 in mcp-shark/mcp-server
if [ -d "node_modules/mcp-shark/mcp-server/node_modules/mcp-shark-common/node_modules/better-sqlite3" ]; then
  echo "Rebuilding better-sqlite3 in mcp-shark/mcp-server/node_modules/mcp-shark-common..."
  cd node_modules/mcp-shark/mcp-server/node_modules/mcp-shark-common/node_modules/better-sqlite3
  npx electron-rebuild -v "$ELECTRON_VERSION" -f -w better-sqlite3 || npm rebuild better-sqlite3 --build-from-source || true
  cd ../../../../..
fi

if [ -d "node_modules/mcp-shark/ui/node_modules/mcp-shark-common/node_modules/better-sqlite3" ]; then
  echo "Rebuilding better-sqlite3 in mcp-shark/ui/node_modules/mcp-shark-common..."
  cd node_modules/mcp-shark/ui/node_modules/mcp-shark-common/node_modules/better-sqlite3
  npx electron-rebuild -v "$ELECTRON_VERSION" -f -w better-sqlite3 || npm rebuild better-sqlite3 --build-from-source || true
  cd ../../../../..
fi


echo "Native module rebuild complete!"

