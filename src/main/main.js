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
  // In packaged Electron app, try app.asar path first
  if (process.resourcesPath) {
    // Try unpacked node_modules (native modules are unpacked)
    // Works on all platforms: macOS, Windows, Linux
    const unpackedPath = path.join(process.resourcesPath, 'app', 'node_modules', 'mcp-shark');
    if (fs.existsSync(unpackedPath)) {
      console.log('Found mcp-shark in unpacked node_modules:', unpackedPath);
      return unpackedPath;
    }
    
    // Try app.asar path (for non-native modules)
    // Note: ASAR is read-only, but we can read from it
    const asarPath = path.join(process.resourcesPath, 'app.asar', 'node_modules', 'mcp-shark');
    if (fs.existsSync(asarPath)) {
      console.log('Found mcp-shark in app.asar:', asarPath);
      return asarPath;
    }
    
    // Windows-specific: sometimes resources are in different location
    if (process.platform === 'win32') {
      const winUnpacked = path.join(process.resourcesPath, '..', 'resources', 'app', 'node_modules', 'mcp-shark');
      if (fs.existsSync(winUnpacked)) {
        console.log('Found mcp-shark in Windows unpacked path:', winUnpacked);
        return winUnpacked;
      }
    }
  }
  
  // In development, node_modules is relative to the project root
  const projectRoot = path.resolve(__dirname, '../..');
  const mcpSharkModulePath = path.join(projectRoot, 'node_modules', 'mcp-shark');
  
  if (fs.existsSync(mcpSharkModulePath)) {
    console.log('Found mcp-shark in development node_modules:', mcpSharkModulePath);
    return mcpSharkModulePath;
  }
  
  // Last resort: try current working directory
  const cwdPath = path.join(process.cwd(), 'node_modules', 'mcp-shark');
  if (fs.existsSync(cwdPath)) {
    console.log('Found mcp-shark in cwd node_modules:', cwdPath);
    return cwdPath;
  }
  
  throw new Error('mcp-shark package not found. Please run: npm install');
}

function createWindow() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  
  // Get preload script path - works in both development and packaged app
  // Use .cjs extension to ensure it's treated as CommonJS (not ES module)
  const preloadPath = path.join(__dirname, '../preload/preload.cjs');
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));
  
  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Preload scripts need sandbox: false when using require()
    },
  };

  // Add icon only if it exists
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Add error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load URL:', validatedURL);
    console.error('Error code:', errorCode);
    console.error('Error description:', errorDescription);
    console.error('Is UI server running? Checking...');
    
    // Check if UI server is actually running
    isUIServerRunning().then((isRunning) => {
      console.log('UI server running status:', isRunning);
      
      if (!isRunning && (errorCode === -105 || errorCode === -106 || errorCode === -102)) {
        // ERR_NAME_NOT_RESOLVED, ERR_INTERNET_DISCONNECTED, or ERR_CONNECTION_REFUSED
        // Server might not be ready yet, retry after a delay
        console.log('UI server not ready, retrying in 2 seconds...');
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            console.log('Retrying to load UI...');
            mainWindow.loadURL('http://localhost:9853');
          }
        }, 2000);
      } else {
        // Show error page with more details
        const errorHtml = `
          <html>
            <head>
              <title>MCP Shark - Connection Error</title>
              <meta charset="utf-8">
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
                h1 { color: #d32f2f; margin-top: 0; }
                .error { color: #666; font-size: 14px; margin: 20px 0; }
                button { padding: 12px 24px; font-size: 16px; margin-top: 20px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; }
                button:hover { background: #1565c0; }
                .info { color: #999; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Failed to Load UI</h1>
                <p class="error">Error: ${errorDescription || errorCode}</p>
                <p>The UI server might not be running.</p>
                <p class="info">Please check the console (View → Toggle Developer Tools) for details.</p>
                <button onclick="location.reload()">Retry</button>
              </div>
            </body>
          </html>
        `;
        mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
      }
    });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer ${level}]:`, message);
  });

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
    console.log('Starting UI server...');
    try {
      const result = await startUIServer(mcpSharkPath, (process) => {
        uiServerProcess = process;
      });
      console.log('UI server start result:', result);
    } catch (error) {
      console.error('Failed to start UI server:', error);
      console.error('Error stack:', error.stack);
      throw error; // Re-throw to be caught by outer try-catch
    }

    // Wait for UI server to be actually ready
    console.log('Waiting for UI server to be ready...');
    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      const isRunning = await isUIServerRunning();
      if (isRunning) {
        serverReady = true;
        console.log('UI server is ready!');
        break;
      }
      console.log(`Waiting for UI server... (${i + 1}/30)`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!serverReady) {
      console.error('UI server is NOT ready after 15 seconds!');
      console.error('This will likely cause connection refused errors.');
      throw new Error('UI server failed to start - connection will be refused');
    }

    // Create window
    createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    console.error('Stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    
    // Create window to show error even if initialization failed
    if (!mainWindow) {
      createWindow();
    }
    
    // Show error page with more details
    if (mainWindow && !mainWindow.isDestroyed()) {
      const errorDetails = error.stack || error.message;
      const errorHtml = `
        <html>
          <head>
            <title>MCP Shark - Initialization Error</title>
            <meta charset="utf-8">
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; background: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              h1 { color: #d32f2f; margin-top: 0; }
              .error { color: #666; font-size: 14px; background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0; font-family: monospace; white-space: pre-wrap; overflow-x: auto; }
              button { padding: 12px 24px; font-size: 16px; margin-top: 20px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; }
              button:hover { background: #1565c0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Failed to Initialize App</h1>
              <p style="color: #666; font-size: 16px;">${error.message}</p>
              <details style="margin-top: 20px;">
                <summary style="cursor: pointer; color: #1976d2;">Show error details</summary>
                <div class="error">${errorDetails}</div>
              </details>
              <p style="color: #999; font-size: 14px; margin-top: 20px;">Please check the console (View → Toggle Developer Tools) for more details.</p>
              <button onclick="location.reload()">Retry</button>
            </div>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
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
    
    // Kill processes on port 9853 (UI server) - cross-platform
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :9853`);
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        lines.forEach(line => {
          const match = line.match(/\s+(\d+)$/);
          if (match) pids.add(match[1]);
        });
        for (const pid of pids) {
          try {
            await execAsync(`taskkill /F /PID ${pid}`);
          } catch (e) {
            // Ignore
          }
        }
      } catch (e) {
        // No process on port, that's fine
      }
    } else {
      // macOS and Linux
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
    }
    
    // Kill processes on port 9851 (MCP server) - cross-platform
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :9851`);
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        lines.forEach(line => {
          const match = line.match(/\s+(\d+)$/);
          if (match) pids.add(match[1]);
        });
        for (const pid of pids) {
          try {
            await execAsync(`taskkill /F /PID ${pid}`);
          } catch (e) {
            // Ignore
          }
        }
      } catch (e) {
        // No process on port, that's fine
      }
    } else {
      // macOS and Linux
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

