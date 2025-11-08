import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { startMCPServer, stopMCPServer, isServerRunning } from './server-manager.js';
import { startUIServer, stopUIServer, isUIServerRunning } from './ui-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let mcpServerProcess = null;
let uiServerProcess = null;
let mcpSharkPath = null;

const isDev = process.argv.includes('--dev');

// Get mcp-shark path from node_modules
function getMCPSharkPath() {
  // In development and production, node_modules is relative to the project root
  const projectRoot = path.resolve(__dirname, '../..');
  const mcpSharkModulePath = path.join(projectRoot, 'node_modules', 'mcp-shark');
  
  if (fs.existsSync(mcpSharkModulePath)) {
    return mcpSharkModulePath;
  }
  
  // In packaged Electron app, try app.asar path
  if (process.resourcesPath) {
    const asarPath = path.join(process.resourcesPath, 'app.asar', 'node_modules', 'mcp-shark');
    if (fs.existsSync(asarPath)) {
      return asarPath;
    }
    
    // Try unpacked node_modules
    const unpackedPath = path.join(process.resourcesPath, 'app', 'node_modules', 'mcp-shark');
    if (fs.existsSync(unpackedPath)) {
      return unpackedPath;
    }
  }
  
  throw new Error('mcp-shark package not found. Please run: npm install');
}

function createWindow() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  // Add icon only if it exists
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the UI
  if (isDev) {
    mainWindow.loadURL('http://localhost:9853');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, we'll load from the UI server
    mainWindow.loadURL('http://localhost:9853');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeApp() {
  try {
    // Get mcp-shark path from node_modules
    mcpSharkPath = getMCPSharkPath();
    console.log(`MCP Shark found at: ${mcpSharkPath}`);

    // Verify the package structure
    const mcpServerPath = path.join(mcpSharkPath, 'mcp-server');
    const uiPath = path.join(mcpSharkPath, 'ui');
    
    if (!fs.existsSync(mcpServerPath) || !fs.existsSync(uiPath)) {
      throw new Error('Invalid mcp-shark package structure. Missing mcp-server or ui directories.');
    }

    // Start UI server
    await startUIServer(mcpSharkPath, (process) => {
      uiServerProcess = process;
    });

    // Wait a bit for UI server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create window
    createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    if (mainWindow) {
      mainWindow.webContents.send('error', {
        message: 'Failed to initialize app',
        error: error.message,
      });
    }
  }
}

// IPC handlers
ipcMain.handle('start-mcp-server', async (event, configPath) => {
  try {
    if (isServerRunning()) {
      return { success: true, message: 'Server already running' };
    }

    const result = await startMCPServer(mcpSharkPath, configPath, (process) => {
      mcpServerProcess = process;
    });

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-mcp-server', async () => {
  try {
    await stopMCPServer(mcpServerProcess);
    mcpServerProcess = null;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('is-mcp-server-running', () => {
  return isServerRunning();
});

ipcMain.handle('is-ui-server-running', () => {
  return isUIServerRunning();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-mcp-shark-version', async () => {
  try {
    const packageJsonPath = path.join(mcpSharkPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get mcp-shark version:', error);
    return null;
  }
});

// App lifecycle
app.whenReady().then(() => {
  initializeApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

async function cleanupProcesses() {
  console.log('Cleaning up processes...');
  
  // Stop UI server
  if (uiServerProcess) {
    try {
      await stopUIServer(uiServerProcess);
      uiServerProcess = null;
    } catch (error) {
      console.error('Error stopping UI server:', error);
      // Force kill if graceful shutdown failed
      if (uiServerProcess && !uiServerProcess.killed) {
        uiServerProcess.kill('SIGKILL');
        uiServerProcess = null;
      }
    }
  }
  
  // Stop MCP server
  if (mcpServerProcess) {
    try {
      await stopMCPServer(mcpServerProcess);
      mcpServerProcess = null;
    } catch (error) {
      console.error('Error stopping MCP server:', error);
      // Force kill if graceful shutdown failed
      if (mcpServerProcess && !mcpServerProcess.killed) {
        mcpServerProcess.kill('SIGKILL');
        mcpServerProcess = null;
      }
    }
  }
  
  // Also kill any remaining processes on the ports
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Kill processes on port 9853 (UI server)
    try {
      const { stdout } = await execAsync(`lsof -ti:9853`);
      const pids = stdout.trim().split('\n').filter(pid => pid);
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
        } catch (e) {
          // Ignore if process doesn't exist
        }
      }
    } catch (e) {
      // No process on port, that's fine
    }
    
    // Kill processes on port 9851 (MCP server)
    try {
      const { stdout } = await execAsync(`lsof -ti:9851`);
      const pids = stdout.trim().split('\n').filter(pid => pid);
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGKILL');
        } catch (e) {
          // Ignore if process doesn't exist
        }
      }
    } catch (e) {
      // No process on port, that's fine
    }
  } catch (error) {
    console.error('Error cleaning up ports:', error);
  }
  
  console.log('Process cleanup completed');
}

app.on('window-all-closed', async () => {
  await cleanupProcesses();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  // Prevent default quit to allow cleanup
  event.preventDefault();
  await cleanupProcesses();
  app.exit(0);
});

// Handle app termination
process.on('SIGINT', async () => {
  await cleanupProcesses();
  app.quit();
});

process.on('SIGTERM', async () => {
  await cleanupProcesses();
  app.quit();
});

