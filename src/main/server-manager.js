import { spawn } from 'child_process';
import * as path from 'path';
import { createConnection } from 'net';

let mcpServerProcess = null;
let serverPort = 9851;

/**
 * Check if MCP server is running by attempting to connect to the port
 */
export function isServerRunning() {
  return new Promise((resolve) => {
    const client = createConnection({ port: serverPort }, () => {
      client.end();
      resolve(true);
    });

    client.on('error', () => {
      resolve(false);
    });

    // Timeout after 100ms
    setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 100);
  });
}

/**
 * Start the MCP server
 */
export async function startMCPServer(mcpSharkPath, configPath, onProcess) {
  return new Promise(async (resolve, reject) => {
    if (mcpServerProcess) {
      resolve({ success: true, message: 'Server already running' });
      return;
    }

    const serverPath = path.join(mcpSharkPath, 'mcp-server');
    const serverScript = path.join(serverPath, 'mcp-shark.js');

    // Check if server script exists
    const fs = await import('fs');
    if (!fs.existsSync(serverScript)) {
      reject(new Error('MCP server script not found'));
      return;
    }

    // Prepare arguments
    const args = [];
    if (configPath) {
      args.push(configPath);
    }

    // Spawn the server process
    // In packaged apps, use Electron's bundled node
    const isPackaged = !!process.resourcesPath;
    const nodeExecutable = isPackaged ? process.execPath : 'node';
    
    if (isPackaged) {
      console.log('Using Electron bundled node for MCP server:', nodeExecutable);
    }
    
    // Set detached: false to ensure we can kill it and its children
    mcpServerProcess = spawn(nodeExecutable, [serverScript, ...args], {
      cwd: serverPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // Don't use shell to avoid PATH issues
      detached: false, // Keep attached so we can kill it and its children
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1', // Tell Electron to run as Node.js
      },
    });

    let output = '';
    let errorOutput = '';

    mcpServerProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[MCP Server] ${data.toString()}`);
    });

    mcpServerProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[MCP Server Error] ${data.toString()}`);
    });

    mcpServerProcess.on('error', (error) => {
      console.error('Failed to start MCP server:', error);
      mcpServerProcess = null;
      reject(error);
    });

    mcpServerProcess.on('exit', (code, signal) => {
      console.log(`MCP server exited with code ${code} and signal ${signal}`);
      mcpServerProcess = null;
    });

    // Wait a bit to see if server starts successfully
    setTimeout(() => {
      if (mcpServerProcess && !mcpServerProcess.killed) {
        onProcess(mcpServerProcess);
        resolve({
          success: true,
          message: 'MCP server started successfully',
          pid: mcpServerProcess.pid,
        });
      } else {
        reject(new Error(`Server failed to start: ${errorOutput || output}`));
      }
    }, 2000);
  });
}

/**
 * Stop the MCP server and all its child processes
 */
export async function stopMCPServer(process) {
  return new Promise(async (resolve) => {
    if (!process || process.killed) {
      resolve({ success: true });
      return;
    }

    try {
      const pid = process.pid;
      
      // Kill the process and all its children
      if (process.platform !== 'win32' && pid) {
        try {
          // Kill the entire process group
          process.kill('SIGTERM');
          
          // Also kill any child processes
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          try {
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
            // No children or error, that's fine
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
                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const execAsync = promisify(exec);
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
      console.error('Error stopping MCP server:', error);
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

