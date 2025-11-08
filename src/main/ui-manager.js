import { spawn, exec } from 'child_process';
import * as path from 'path';
import { createConnection } from 'net';
import { promisify } from 'util';

const execAsync = promisify(exec);

let uiServerProcess = null;
let uiPort = 9853;

/**
 * Check if UI server is running or if port is in use
 */
export function isUIServerRunning() {
  return new Promise((resolve) => {
    const client = createConnection({ port: uiPort }, () => {
      client.end();
      resolve(true);
    });

    client.on('error', (error) => {
      // If port is in use, consider it as server running
      if (error.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 100);
  });
}

/**
 * Kill any process using the UI server port
 */
export async function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      // Windows: find and kill process on port
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
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
            // Process might not exist, ignore
          }
        }
      } catch (e) {
        // No process found on port, that's fine
      }
    } else {
      // Unix-like (macOS, Linux): use lsof to find and kill
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(pid => pid);
        for (const pid of pids) {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
          } catch (e) {
            // Process might not exist
          }
        }
        // Wait a bit, then force kill
        await new Promise(resolve => setTimeout(resolve, 1000));
        for (const pid of pids) {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
          } catch (e) {
            // Ignore
          }
        }
      } catch (e) {
        // No process found on port, that's fine
      }
    }
  } catch (error) {
    // Ignore errors - port might not be in use
    console.log(`Note: Could not check/kill processes on port ${port}:`, error.message);
  }
}

/**
 * Start the UI server
 */
export async function startUIServer(mcpSharkPath, onProcess) {
  return new Promise(async (resolve, reject) => {
    if (uiServerProcess) {
      resolve({ success: true, message: 'UI server already running' });
      return;
    }

    // Check if port is in use and kill any existing processes
    const isRunning = await isUIServerRunning();
    if (isRunning) {
      console.log('Port 9853 is in use, attempting to free it...');
      await killProcessOnPort(uiPort);
      // Wait a bit for port to be freed
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const uiPath = path.join(mcpSharkPath, 'ui');
    const distPath = path.join(uiPath, 'dist', 'index.html');

    // Check if dist is built, if not build it first
    const fs = await import('fs');
    const isPackaged = !!process.resourcesPath;
    
    if (!fs.existsSync(distPath)) {
      if (isPackaged) {
        // In packaged app, dist should already be built
        reject(new Error(`UI dist not found at ${distPath}. The app may not have been built correctly.`));
        return;
      }
      
      // In development, build it
      console.log('UI not built, building...');
      try {
        await buildUI(uiPath);
        console.log('UI build completed');
      } catch (error) {
        console.error('Failed to build UI:', error);
        reject(new Error(`Failed to build UI: ${error.message}`));
        return;
      }
    }

    startUIServerAfterBuild(mcpSharkPath, onProcess, resolve, reject);
  });
}

async function buildUI(uiPath) {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    
    console.log(`Building UI in ${uiPath}...`);
    
    // Use npx to ensure we get the right vite
    const buildProcess = spawn('npx', ['--yes', 'vite', 'build'], {
      cwd: uiPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, NODE_ENV: 'production' },
    });

    buildProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(`[UI Build] ${text.trim()}`);
    });

    buildProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error(`[UI Build Error] ${text.trim()}`);
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('UI build completed successfully');
        resolve();
      } else {
        const errorMsg = `Build failed with code ${code}.\nOutput: ${output}\nErrors: ${errorOutput}`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
      }
    });

    buildProcess.on('error', (error) => {
      const errorMsg = `Build process error: ${error.message}`;
      console.error(errorMsg);
      reject(new Error(errorMsg));
    });
  });
}

async function startUIServerAfterBuild(mcpSharkPath, onProcess, resolve, reject) {
  const uiPath = path.join(mcpSharkPath, 'ui');
  
  // Verify UI path exists
  const fs = await import('fs');
  if (!fs.existsSync(uiPath)) {
    reject(new Error(`UI path does not exist: ${uiPath}`));
    return;
  }
  
  const serverScript = path.join(uiPath, 'server.js');
  if (!fs.existsSync(serverScript)) {
    reject(new Error(`Server script does not exist: ${serverScript}`));
    return;
  }
  
  console.log(`Starting UI server from: ${uiPath}`);
  console.log(`Server script: ${serverScript}`);
  console.log(`Server script exists: ${fs.existsSync(serverScript)}`);
  
  // Check if dist folder exists
  const distPath = path.join(uiPath, 'dist');
  const distExists = fs.existsSync(distPath);
  console.log(`Dist folder exists: ${distExists} at ${distPath}`);
  
  if (!distExists) {
    const errorMsg = `UI dist folder not found at ${distPath}. The UI must be built before packaging.`;
    console.error(errorMsg);
    reject(new Error(errorMsg));
    return;
  }

  // In packaged apps, use process.execPath (Electron's node) instead of system node
  // This ensures we use the correct Node.js version bundled with Electron
  // Works on all platforms: macOS, Windows, Linux
  const isPackaged = !!process.resourcesPath;
  const nodeExecutable = isPackaged ? process.execPath : 'node';
  
  if (isPackaged) {
    console.log('Using Electron bundled node:', nodeExecutable);
    console.log('Platform:', process.platform);
    console.log('Resources path:', process.resourcesPath);
  }

  // Use node to run server.js directly
  // In packaged app: use Electron's node (process.execPath) with ELECTRON_RUN_AS_NODE
  // In development: use system node
  // ELECTRON_RUN_AS_NODE works on all platforms
  uiServerProcess = spawn(nodeExecutable, [serverScript], {
    cwd: uiPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false, // Don't use shell to avoid PATH issues (works on all platforms)
    detached: false,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1', // Tell Electron to run as Node.js (cross-platform)
    },
  });

  let output = '';
  let errorOutput = '';
  let checkCount = 0;
  const maxChecks = 20; // Increased to 10 seconds
  const checkInterval = 500;
  let checkServer = null;
  let serverStarted = false;

  uiServerProcess.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(`[UI Server] ${text.trim()}`);
  });

  uiServerProcess.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    console.error(`[UI Server Error] ${text.trim()}`);
    // Log immediately so we can see errors as they happen
    if (text.includes('Error') || text.includes('error') || text.includes('Error:')) {
      console.error('CRITICAL UI Server Error detected:', text);
    }
  });

  uiServerProcess.on('error', (error) => {
    const errorMsg = `Failed to start UI server: ${error.message}\nPath: ${serverScript}\nNode: ${nodeExecutable}\nCWD: ${uiPath}`;
    console.error(errorMsg);
    console.error('Full error:', error);
    uiServerProcess = null;
    if (checkServer) clearInterval(checkServer);
    reject(new Error(errorMsg));
  });

  uiServerProcess.on('exit', (code, signal) => {
    console.log(`UI server exited with code ${code} and signal ${signal}`);
    if (code !== 0 && code !== null && !serverStarted) {
      console.error(`UI server exited with error code ${code}`);
      console.error('Output:', output);
      console.error('Error output:', errorOutput);
      // If server exits with error before starting, reject the promise
      if (checkServer) {
        clearInterval(checkServer);
      }
      const errorMsg = `UI server exited with code ${code}.\nOutput: ${output}\nErrors: ${errorOutput}`;
      console.error(errorMsg);
      reject(new Error(errorMsg));
    }
    uiServerProcess = null;
  });

  // Wait a bit to see if server starts successfully
  // Check multiple times to catch early exits
  
  // Set a timeout to ensure we don't wait forever
  const timeout = setTimeout(() => {
    if (checkServer) {
      clearInterval(checkServer);
    }
    if (!uiServerProcess || uiServerProcess.killed) {
      const errorMsg = `UI server did not start after ${maxChecks * checkInterval}ms.\nOutput: ${output}\nErrors: ${errorOutput}`;
      console.error(errorMsg);
      reject(new Error(errorMsg));
    }
  }, maxChecks * checkInterval);
  
  checkServer = setInterval(() => {
    checkCount++;
    
    if (!uiServerProcess || uiServerProcess.killed) {
      clearInterval(checkServer);
      clearTimeout(timeout);
      const errorMsg = `UI server process died before starting.\nOutput: ${output}\nErrors: ${errorOutput}`;
      console.error(errorMsg);
      reject(new Error(errorMsg));
      return;
    }
    
    // Check if server is actually running on the port
    isUIServerRunning().then((isRunning) => {
      if (isRunning) {
        serverStarted = true;
        clearInterval(checkServer);
        clearTimeout(timeout);
        onProcess(uiServerProcess);
        console.log('UI server started successfully on port 9853');
        resolve({
          success: true,
          message: 'UI server started successfully',
          pid: uiServerProcess.pid,
        });
      } else if (checkCount >= maxChecks) {
        clearInterval(checkServer);
        clearTimeout(timeout);
        const errorMsg = `UI server did not start after ${maxChecks * checkInterval}ms.\nOutput: ${output}\nErrors: ${errorOutput}`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
      }
    }).catch((err) => {
      console.error('Error checking if UI server is running:', err);
    });
  }, checkInterval);
}

/**
 * Stop the UI server and all its child processes
 */
export async function stopUIServer(process) {
  return new Promise(async (resolve) => {
    if (!process || process.killed) {
      resolve({ success: true });
      return;
    }

    try {
      // Kill the process and all its children
      const pid = process.pid;
      
      // On Unix-like systems, kill the process group
      if (process.platform !== 'win32' && pid) {
        try {
          // Kill the entire process group
          process.kill('SIGTERM');
          
          // Also kill any child processes
          const { stdout } = await execAsync(`pgrep -P ${pid}`);
          const childPids = stdout.trim().split('\n').filter(p => p);
          for (const childPid of childPids) {
            try {
              process.kill(parseInt(childPid), 'SIGTERM');
            } catch (e) {
              // Ignore
            }
          }
        } catch (e) {
          // Fallback to direct kill
          process.kill('SIGTERM');
        }
      } else {
        // Windows: just kill the process
        process.kill('SIGTERM');
      }

      // Force kill after 2 seconds if still running
      const forceKillTimeout = setTimeout(async () => {
        if (!process.killed && pid) {
          try {
            process.kill('SIGKILL');
            
            // Also force kill children
            if (process.platform !== 'win32') {
              try {
                const { stdout } = await execAsync(`pgrep -P ${pid}`);
                const childPids = stdout.trim().split('\n').filter(p => p);
                for (const childPid of childPids) {
                  try {
                    process.kill(parseInt(childPid), 'SIGKILL');
                  } catch (e) {
                    // Ignore
                  }
                }
              } catch (e) {
                // No children or error, that's fine
              }
            }
          } catch (e) {
            // Process already dead
          }
        }
        resolve({ success: true });
      }, 2000);

      process.on('exit', () => {
        clearTimeout(forceKillTimeout);
        resolve({ success: true });
      });
    } catch (error) {
      console.error('Error stopping UI server:', error);
      // Force kill as last resort
      try {
        process.kill('SIGKILL');
      } catch (e) {
        // Ignore
      }
      resolve({ success: true });
    }
  });
}

