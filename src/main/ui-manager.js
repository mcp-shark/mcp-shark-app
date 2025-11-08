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
    } else {
      // Unix-like: use lsof to find and kill
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
    if (!fs.existsSync(distPath)) {
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

function startUIServerAfterBuild(mcpSharkPath, onProcess, resolve, reject) {
  const uiPath = path.join(mcpSharkPath, 'ui');

  // Use npm start which will run prestart (build) automatically
  // Set detached: false and create a new process group to ensure we can kill children
  uiServerProcess = spawn('npm', ['start'], {
    cwd: uiPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: false, // Keep attached so we can kill it and its children
  });

  let output = '';
  let errorOutput = '';

  uiServerProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log(`[UI Server] ${data.toString()}`);
  });

  uiServerProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.error(`[UI Server Error] ${data.toString()}`);
  });

  uiServerProcess.on('error', (error) => {
    console.error('Failed to start UI server:', error);
    uiServerProcess = null;
    reject(error);
  });

  uiServerProcess.on('exit', (code, signal) => {
    console.log(`UI server exited with code ${code} and signal ${signal}`);
    uiServerProcess = null;
  });

  // Wait a bit to see if server starts successfully
  setTimeout(() => {
    if (uiServerProcess && !uiServerProcess.killed) {
      onProcess(uiServerProcess);
      resolve({
        success: true,
        message: 'UI server started successfully',
        pid: uiServerProcess.pid,
      });
    } else {
      reject(new Error(`UI server failed to start: ${errorOutput || output}`));
    }
  }, 3000);
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

