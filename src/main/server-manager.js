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
    // Always prefer Electron's executable if available (works in both dev and packaged)
    // In packaged apps, we MUST use process.execPath
    // In development, process.execPath is still the Electron executable, which works fine
    const isPackaged = !!process.resourcesPath;
    
    // Always use process.execPath - it's the Electron executable in both dev and packaged
    // This ensures we use the correct Node.js version that Electron bundles
    const nodeExecutable = process.execPath;
    
    console.log('MCP Server Startup Debug:');
    console.log(`  process.resourcesPath: ${process.resourcesPath || 'undefined'}`);
    console.log(`  process.defaultApp: ${process.defaultApp}`);
    console.log(`  process.execPath: ${process.execPath}`);
    console.log(`  isPackaged: ${isPackaged}`);
    console.log(`  nodeExecutable: ${nodeExecutable}`);
    console.log(`  Executable exists: ${fs.existsSync(nodeExecutable)}`);
    
    // Verify executable exists
    if (!fs.existsSync(nodeExecutable)) {
      const error = `Electron executable not found at: ${nodeExecutable}\nResources path: ${process.resourcesPath || 'N/A'}\nThis should never happen - Electron executable should always exist.`;
      console.error('='.repeat(80));
      console.error('CRITICAL ERROR:', error);
      console.error('='.repeat(80));
      reject(new Error(error));
      return;
    }
    
    if (isPackaged) {
      console.log('Using Electron bundled node for MCP server:', nodeExecutable);
      console.log('Platform:', process.platform);
      console.log('Resources path:', process.resourcesPath);
      console.log('Executable exists:', fs.existsSync(nodeExecutable));
    }
    
    // Prepare environment - ensure NODE_PATH includes the server directory's node_modules
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1', // Tell Electron to run as Node.js
    };
    
    // Add node_modules paths to NODE_PATH for module resolution
    const serverNodeModules = path.join(serverPath, 'node_modules');
    const parentNodeModules = path.join(mcpSharkPath, 'node_modules');
    const rootNodeModules = isPackaged 
      ? path.join(process.resourcesPath, 'app', 'node_modules')
      : path.join(path.dirname(mcpSharkPath), 'node_modules');
    
    const nodePaths = [
      serverNodeModules,
      parentNodeModules,
      rootNodeModules,
    ].filter(p => {
      const exists = fs.existsSync(p);
      if (!exists && isPackaged) {
        console.log(`NODE_PATH candidate does not exist: ${p}`);
      }
      return exists;
    });
    
    if (nodePaths.length > 0) {
      env.NODE_PATH = nodePaths.join(path.delimiter);
      console.log(`NODE_PATH set to: ${env.NODE_PATH}`);
    } else {
      console.warn('WARNING: No valid NODE_PATH found! Module resolution may fail.');
    }
    
    // Set PWD to serverPath to help with relative imports
    env.PWD = serverPath;
    
    // Set a writable data directory for the database
    // Use user's home directory (always writable, has execution permission)
    const os = require('os');
    env.MCP_SHARK_DATA_DIR = path.join(os.homedir(), '.mcp-shark');
    console.log(`MCP Shark data directory (home): ${env.MCP_SHARK_DATA_DIR}`);

    console.log('Spawning MCP server process...');
    console.log(`Executable: ${nodeExecutable}`);
    console.log(`Script: ${serverScript}`);
    console.log(`CWD: ${serverPath}`);
    console.log(`NODE_ENV: ${env.NODE_ENV}`);
    console.log(`ELECTRON_RUN_AS_NODE: ${env.ELECTRON_RUN_AS_NODE}`);

    // Set detached: false to ensure we can kill it and its children
    mcpServerProcess = spawn(nodeExecutable, [serverScript, ...args], {
      cwd: serverPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // Don't use shell to avoid PATH issues
      detached: false, // Keep attached so we can kill it and its children
      env: env,
    });
    
    console.log(`MCP server process spawned with PID: ${mcpServerProcess.pid}`);

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
      const errorMsg = `Failed to spawn MCP server process: ${error.message}\nPath: ${serverScript}\nNode: ${nodeExecutable}\nCWD: ${serverPath}\nError code: ${error.code}\nIs Packaged: ${isPackaged}\nResources Path: ${process.resourcesPath || 'N/A'}`;
      console.error('='.repeat(80));
      console.error('MCP SERVER SPAWN ERROR:');
      console.error(errorMsg);
      console.error(`Full error: ${JSON.stringify(error)}`);
      console.error(`Error stack: ${error.stack}`);
      console.error('='.repeat(80));
      mcpServerProcess = null;
      reject(new Error(errorMsg));
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

