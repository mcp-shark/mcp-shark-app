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
let debugLogs = [];
const MAX_DEBUG_LOGS = 1000;

const isDev = process.argv.includes('--dev');

// Debug logging function
function addDebugLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, data };
  debugLogs.push(logEntry);
  
  // Keep only last MAX_DEBUG_LOGS entries
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.shift();
  }
  
  // Also log to console
  if (level === 'error') {
    console.error(`[${timestamp}] ${message}`, data || '');
  } else if (level === 'warn') {
    console.warn(`[${timestamp}] ${message}`, data || '');
  } else {
    console.log(`[${timestamp}] ${message}`, data || '');
  }
  
  // Send to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('debug-log', logEntry);
  }
}

// Show error page with debug logs
function showErrorPageWithLogs(errorMessage, errorCode = null, errorStack = null) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  const errorHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>MCP Shark - Error</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            background: #f5f5f5; 
            padding: 20px;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .header { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          h1 { color: #d32f2f; margin-bottom: 10px; }
          .error { color: #666; font-size: 14px; margin: 10px 0; }
          .logs-container {
            flex: 1;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .logs-header {
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logs-content {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            line-height: 1.5;
          }
          .log-entry {
            padding: 4px 8px;
            margin: 2px 0;
            border-left: 3px solid transparent;
            word-wrap: break-word;
          }
          .log-entry.error { background: #fff5f5; border-left-color: #d32f2f; }
          .log-entry.warn { background: #fffbf0; border-left-color: #f57c00; }
          .log-entry.info { background: #f5f5f5; border-left-color: #1976d2; }
          .log-timestamp { color: #999; margin-right: 10px; }
          .log-level { 
            font-weight: bold; 
            margin-right: 10px;
            display: inline-block;
            min-width: 50px;
          }
          .log-level.error { color: #d32f2f; }
          .log-level.warn { color: #f57c00; }
          .log-level.info { color: #1976d2; }
          .log-message { color: #333; }
          .log-data { 
            color: #666; 
            margin-left: 70px; 
            font-size: 11px;
            white-space: pre-wrap;
            max-width: 100%;
            overflow-x: auto;
          }
          button { 
            padding: 10px 20px; 
            font-size: 14px; 
            background: #1976d2; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;
            margin-right: 10px;
          }
          button:hover { background: #1565c0; }
          .button-group { margin-top: 15px; }
          .auto-scroll { margin-left: auto; }
          input[type="checkbox"] { margin-right: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${errorCode ? 'Failed to Load UI' : 'Failed to Initialize App'}</h1>
          ${errorMessage ? `<p class="error"><strong>Error:</strong> ${errorMessage}</p>` : ''}
          ${errorCode ? `<p class="error"><strong>Error Code:</strong> ${errorCode}</p>` : ''}
          <div class="button-group">
            <button onclick="location.reload()">🔄 Retry</button>
            <button onclick="clearLogs()">🗑️ Clear Logs</button>
            <button onclick="copyLogs()">📋 Copy Logs</button>
          </div>
        </div>
        <div class="logs-container">
          <div class="logs-header">
            <strong>Debug Logs</strong>
            <label class="auto-scroll">
              <input type="checkbox" id="autoScroll" checked> Auto-scroll
            </label>
          </div>
          <div class="logs-content" id="logsContent"></div>
        </div>
        <script>
          const logsContent = document.getElementById('logsContent');
          const autoScrollCheckbox = document.getElementById('autoScroll');
          let logs = [];
          
          function addLogEntry(log) {
            logs.push(log);
            renderLogs();
          }
          
          function renderLogs() {
            logsContent.innerHTML = logs.map(log => {
              const timestamp = new Date(log.timestamp).toLocaleTimeString();
              const dataStr = log.data ? '\\n' + JSON.stringify(log.data, null, 2) : '';
              return '<div class="log-entry ' + log.level + '">' +
                '<span class="log-timestamp">' + timestamp + '</span>' +
                '<span class="log-level ' + log.level + '">' + log.level.toUpperCase() + '</span>' +
                '<span class="log-message">' + escapeHtml(log.message) + '</span>' +
                (dataStr ? '<div class="log-data">' + escapeHtml(dataStr) + '</div>' : '') +
                '</div>';
            }).join('');
            
            if (autoScrollCheckbox.checked) {
              logsContent.scrollTop = logsContent.scrollHeight;
            }
          }
          
          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }
          
          function clearLogs() {
            logs = [];
            renderLogs();
          }
          
          function copyLogs() {
            const text = logs.map(log => {
              const timestamp = new Date(log.timestamp).toISOString();
              const dataStr = log.data ? '\\n' + JSON.stringify(log.data, null, 2) : '';
              return '[' + timestamp + '] [' + log.level.toUpperCase() + '] ' + log.message + dataStr;
            }).join('\\n');
            navigator.clipboard.writeText(text).then(() => {
              alert('Logs copied to clipboard!');
            });
          }
          
          // Load existing logs
          if (window.electronAPI) {
            window.electronAPI.getDebugLogs().then(existingLogs => {
              logs = existingLogs || [];
              renderLogs();
            });
            
            // Listen for new logs
            window.electronAPI.onDebugLog((log) => {
              addLogEntry(log);
            });
          } else {
            // Fallback: show error message
            addLogEntry({
              timestamp: new Date().toISOString(),
              level: 'error',
              message: 'Electron API not available. Check console for logs.',
              data: ${errorStack ? JSON.stringify({ stack: errorStack }).replace(/`/g, '\\`').replace(/\$/g, '\\$') : 'null'}
            });
          }
        </script>
      </body>
    </html>
  `;
  
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
}

// Get mcp-shark path from node_modules
function getMCPSharkPath() {
  // In packaged Electron app, try unpacked path first (mcp-shark MUST be unpacked to execute)
  if (process.resourcesPath) {
    addDebugLog('info', `Resources path: ${process.resourcesPath}`);
    
    // Try unpacked path (from asarUnpack or extraResources)
    // Works on all platforms: macOS, Windows, Linux
    const unpackedPath = path.join(process.resourcesPath, 'app', 'node_modules', 'mcp-shark');
    addDebugLog('info', `Checking unpacked path: ${unpackedPath}`);
    addDebugLog('info', `Unpacked path exists: ${fs.existsSync(unpackedPath)}`);
    
    if (fs.existsSync(unpackedPath)) {
      // Verify it's actually unpacked (check if server.js exists and is executable)
      const serverScript = path.join(unpackedPath, 'ui', 'server.js');
      const serverExists = fs.existsSync(serverScript);
      addDebugLog('info', `Found mcp-shark in unpacked node_modules: ${unpackedPath}`);
      addDebugLog('info', `Server script exists: ${serverExists} at ${serverScript}`);
      if (serverExists) {
        return unpackedPath;
      } else {
        addDebugLog('warn', `Unpacked path found but server.js missing - may not be fully unpacked`);
      }
    }
    
    // Try app.asar path (fallback - but server.js CANNOT execute from here!)
    // Note: ASAR is read-only, so we can't execute server.js from here
    const asarPath = path.join(process.resourcesPath, 'app.asar', 'node_modules', 'mcp-shark');
    addDebugLog('info', `Checking ASAR path: ${asarPath}`);
    addDebugLog('info', `ASAR path exists: ${fs.existsSync(asarPath)}`);
    if (fs.existsSync(asarPath)) {
      addDebugLog('error', `Found mcp-shark in app.asar (read-only - server.js CANNOT execute from here!)`);
      addDebugLog('error', `This means mcp-shark was not unpacked during build.`);
      addDebugLog('error', `Please rebuild with: npm run build:mac`);
      addDebugLog('error', `Make sure package.json has: "asarUnpack": ["**/node_modules/mcp-shark/**/*"]`);
      // DO NOT return ASAR path - it won't work for execution
      // Throw an error to force rebuild
      throw new Error('mcp-shark is in ASAR archive and must be unpacked. Please rebuild with: npm run build:mac');
    }
    
    // Windows-specific: sometimes resources are in different location
    if (process.platform === 'win32') {
      const winUnpacked = path.join(process.resourcesPath, '..', 'resources', 'app', 'node_modules', 'mcp-shark');
      if (fs.existsSync(winUnpacked)) {
        addDebugLog('info', `Found mcp-shark in Windows unpacked path: ${winUnpacked}`);
        return winUnpacked;
      }
    }
  }
  
  // In development, node_modules is relative to the project root
  // But only if we're NOT in a packaged app
  if (!process.resourcesPath) {
    const projectRoot = path.resolve(__dirname, '../..');
    const mcpSharkModulePath = path.join(projectRoot, 'node_modules', 'mcp-shark');
    
    if (fs.existsSync(mcpSharkModulePath)) {
      addDebugLog('info', `Found mcp-shark in development node_modules: ${mcpSharkModulePath}`);
      return mcpSharkModulePath;
    }
  }
  
  // Last resort: try current working directory
  const cwdPath = path.join(process.cwd(), 'node_modules', 'mcp-shark');
  if (fs.existsSync(cwdPath)) {
    addDebugLog('info', `Found mcp-shark in cwd node_modules: ${cwdPath}`);
    return cwdPath;
  }
  
  const errorMsg = 'mcp-shark package not found in unpacked location. The package must be unpacked to execute server.js. Please rebuild with: npm run build:mac';
  addDebugLog('error', errorMsg);
  addDebugLog('error', `Checked paths:`);
  if (process.resourcesPath) {
    addDebugLog('error', `  - Unpacked: ${path.join(process.resourcesPath, 'app', 'node_modules', 'mcp-shark')}`);
    addDebugLog('error', `  - ASAR: ${path.join(process.resourcesPath, 'app.asar', 'node_modules', 'mcp-shark')}`);
  }
  throw new Error(errorMsg);
}

async function createWindow() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  
  // Get preload script path - works in both development and packaged app
  // Use .cjs extension to ensure it's treated as CommonJS (not ES module)
  const preloadPath = path.join(__dirname, '../preload/preload.cjs');
  addDebugLog('info', `Preload script path: ${preloadPath}`);
  addDebugLog('info', `Preload script exists: ${fs.existsSync(preloadPath)}`);
  
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

  // Send existing logs to renderer when window is ready
  mainWindow.webContents.once('did-finish-load', () => {
    // Send all existing logs
    debugLogs.forEach(log => {
      mainWindow.webContents.send('debug-log', log);
    });
  });

  // Add error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    addDebugLog('error', `Failed to load URL: ${validatedURL}`);
    addDebugLog('error', `Error code: ${errorCode}`);
    addDebugLog('error', `Error description: ${errorDescription}`);
    addDebugLog('info', 'Checking if UI server is running...');
    
    // Check if UI server is actually running
    isUIServerRunning().then((isRunning) => {
      addDebugLog('info', `UI server running status: ${isRunning}`);
      
      if (!isRunning && (errorCode === -105 || errorCode === -106 || errorCode === -102)) {
        // ERR_NAME_NOT_RESOLVED, ERR_INTERNET_DISCONNECTED, or ERR_CONNECTION_REFUSED
        // Server might not be ready yet, retry after a delay
        addDebugLog('info', 'UI server not ready, retrying in 2 seconds...');
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            addDebugLog('info', 'Retrying to load UI...');
            mainWindow.loadURL('http://localhost:9853');
          }
        }, 2000);
      } else {
        // Show error page with debug logs
        showErrorPageWithLogs(errorDescription, errorCode);
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
    // Check if server is ready, if not show error page with logs
    try {
      const isRunning = await isUIServerRunning();
      if (!isRunning) {
        addDebugLog('warn', 'UI server not ready when creating window, showing error page');
        showErrorPageWithLogs('UI server not ready - Connection Refused', -102, null);
      } else {
        addDebugLog('info', 'UI server is ready, loading UI...');
        mainWindow.loadURL('http://localhost:9853');
      }
    } catch (error) {
      addDebugLog('error', `Error checking UI server: ${error.message}`);
      showErrorPageWithLogs('Error checking UI server status', null, error.stack);
    }
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
    addDebugLog('info', '='.repeat(80));
    addDebugLog('info', 'Starting UI server...');
    addDebugLog('info', `MCP Shark path: ${mcpSharkPath}`);
    
    // Verify the path is NOT in ASAR (can't execute from ASAR)
    if (mcpSharkPath.includes('.asar')) {
      addDebugLog('error', '='.repeat(80));
      addDebugLog('error', 'CRITICAL: mcp-shark is in ASAR archive (read-only)!');
      addDebugLog('error', 'server.js cannot execute from ASAR. Rebuild required.');
      addDebugLog('error', '='.repeat(80));
      throw new Error('mcp-shark is in ASAR archive. Please rebuild with: npm run build:mac');
    }
    
    addDebugLog('info', '='.repeat(80));
    try {
      const result = await startUIServer(mcpSharkPath, (process) => {
        uiServerProcess = process;
        addDebugLog('info', `UI server process assigned: PID ${process?.pid}`);
      }, addDebugLog);
      addDebugLog('info', `UI server start result: ${JSON.stringify(result)}`);
      addDebugLog('info', `UI server process PID: ${uiServerProcess?.pid}`);
    } catch (error) {
      addDebugLog('error', '='.repeat(80));
      addDebugLog('error', 'FAILED TO START UI SERVER');
      addDebugLog('error', `Error message: ${error.message}`);
      addDebugLog('error', `Error stack: ${error.stack}`);
      addDebugLog('error', '='.repeat(80));
      throw error; // Re-throw to be caught by outer try-catch
    }

    // Wait for UI server to be actually ready
    addDebugLog('info', 'Waiting for UI server to be ready...');
    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      const isRunning = await isUIServerRunning();
      if (isRunning) {
        serverReady = true;
        addDebugLog('info', '✅ UI server is ready!');
        break;
      }
      addDebugLog('info', `Waiting for UI server... (${i + 1}/30)`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!serverReady) {
      addDebugLog('error', '❌ UI server is NOT ready after 15 seconds!');
      addDebugLog('error', 'This will likely cause connection refused errors.');
      throw new Error('UI server failed to start - connection will be refused');
    }

    // Create window - but show error page immediately if server isn't ready
    await createWindow();
    
    // Double-check server is ready after window is created
    const finalCheck = await isUIServerRunning();
    if (!finalCheck) {
      addDebugLog('error', 'UI server still not ready after window creation!');
      if (mainWindow && !mainWindow.isDestroyed()) {
        showErrorPageWithLogs('UI server failed to start - Connection Refused', -102, null);
      }
    }
  } catch (error) {
    addDebugLog('error', 'Failed to initialize app', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    
    // Create window to show error even if initialization failed
    if (!mainWindow) {
      await createWindow();
    }
    
    // Show error page with debug logs
    if (mainWindow && !mainWindow.isDestroyed()) {
      showErrorPageWithLogs(error.message, null, error.stack);
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
    addDebugLog('error', 'Failed to get mcp-shark version', error);
    return null;
  }
});

// IPC handler for getting debug logs
ipcMain.handle('get-debug-logs', () => {
  return debugLogs;
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

