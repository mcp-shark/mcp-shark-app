import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { createConnection } from 'net';

let mcpServerProcess = null;
let serverPort = 9851;

/**
 * Get system PATH from the host machine's shell environment
 * This works in Electron by executing a shell command to get the actual PATH
 * Includes both system PATH and user's custom PATH from shell config files
 */
function getSystemPath() {
  try {
    if (process.platform === 'win32') {
      // Windows: use cmd to get PATH (includes user PATH)
      const pathOutput = execSync('cmd /c echo %PATH%', {
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return pathOutput.trim();
    } else {
      // Unix-like: use shell to get PATH from user's actual shell environment
      // Try to detect the user's default shell first
      const userShell = process.env.SHELL || '/bin/zsh';
      const shells = [userShell, '/bin/zsh', '/bin/bash', '/bin/sh'];

      for (const shell of shells) {
        if (fs.existsSync(shell)) {
          try {
            // For zsh, we need to load both login and interactive configs
            // zsh -l loads .zprofile/.zlogin, but .zshrc has interactive configs
            // Try interactive mode first (loads .zshrc), then login mode
            const shellName = path.basename(shell);
            let pathOutput;
            
            if (shellName === 'zsh') {
              // For zsh, try interactive mode to get .zshrc PATH additions
              try {
                pathOutput = execSync(`${shell} -i -c 'echo $PATH'`, {
                  encoding: 'utf8',
                  timeout: 2000,
                  stdio: ['ignore', 'pipe', 'ignore'],
                  maxBuffer: 1024 * 1024,
                  env: {
                    ...Object.fromEntries(
                      Object.entries(process.env).filter(([key]) => key !== 'PATH')
                    ),
                  },
                });
              } catch (_e) {
                // Fallback to login shell
                pathOutput = execSync(`${shell} -l -c 'echo $PATH'`, {
                  encoding: 'utf8',
                  timeout: 2000,
                  stdio: ['ignore', 'pipe', 'ignore'],
                  maxBuffer: 1024 * 1024,
                  env: {
                    ...Object.fromEntries(
                      Object.entries(process.env).filter(([key]) => key !== 'PATH')
                    ),
                  },
                });
              }
            } else {
              // For bash/sh, use login shell
              pathOutput = execSync(`${shell} -l -c 'echo $PATH'`, {
                encoding: 'utf8',
                timeout: 2000,
                stdio: ['ignore', 'pipe', 'ignore'],
                maxBuffer: 1024 * 1024,
                env: {
                  ...Object.fromEntries(
                    Object.entries(process.env).filter(([key]) => key !== 'PATH')
                  ),
                },
              });
            }
            
            const systemPath = pathOutput.trim();
            if (systemPath) {
              console.log(`[Server Manager] Got PATH from ${shell} (${shellName})`);
              return systemPath;
            }
          } catch (_e) {
            // Try next shell
            continue;
          }
        }
      }

      // Fallback: try to read from common shell config files
      // For zsh, check .zshrc first (interactive), then .zprofile (login)
      const os = require('os');
      const homeDir = os.homedir();
      const configFiles = [
        { file: path.join(homeDir, '.zshrc'), shell: 'zsh', interactive: true },
        { file: path.join(homeDir, '.zprofile'), shell: 'zsh', interactive: false },
        { file: path.join(homeDir, '.zlogin'), shell: 'zsh', interactive: false },
        { file: path.join(homeDir, '.bashrc'), shell: 'bash', interactive: true },
        { file: path.join(homeDir, '.bash_profile'), shell: 'bash', interactive: false },
        { file: path.join(homeDir, '.profile'), shell: 'sh', interactive: false },
      ];

      for (const { file, shell: shellName, interactive } of configFiles) {
        if (fs.existsSync(file)) {
          try {
            // For zsh interactive configs, use -i flag
            const flag = shellName === 'zsh' && interactive ? '-i' : '';
            const pathOutput = execSync(
              `/bin/${shellName} ${flag} -c 'source ${file} 2>/dev/null; echo $PATH'`,
              {
                encoding: 'utf8',
                timeout: 2000,
                stdio: ['ignore', 'pipe', 'ignore'],
                maxBuffer: 1024 * 1024,
                env: {
                  ...Object.fromEntries(
                    Object.entries(process.env).filter(([key]) => key !== 'PATH')
                  ),
                },
              }
            );
            const systemPath = pathOutput.trim();
            if (systemPath && systemPath.length > 10) {
              // Only use if we got a meaningful PATH
              console.log(`[Server Manager] Got PATH from ${file}`);
              return systemPath;
            }
          } catch (_e) {
            // Try next config file
            continue;
          }
        }
      }
    }
  } catch (error) {
    console.warn('[Server Manager] Could not get system PATH:', error.message);
  }
  return null;
}

/**
 * Enhance PATH environment variable to include system paths and user paths
 * This is especially important in Electron where PATH might not include system executables
 */
function enhancePath(originalPath) {
  const os = require('os');
  const homeDir = os.homedir();
  const pathSeparator = process.platform === 'win32' ? ';' : ':';

  // Try to get the actual system PATH from the host (includes user's custom PATH)
  const systemPath = getSystemPath();
  if (systemPath) {
    console.log('[Server Manager] Using system PATH from host machine');
    // Combine system PATH with original PATH, prioritizing system PATH
    // Also add user-specific paths that might not be in system PATH
    const userPaths = [
      // Common user-specific binary locations
      path.join(homeDir, '.local', 'bin'),
      path.join(homeDir, '.npm-global', 'bin'),
      path.join(homeDir, '.cargo', 'bin'),
      path.join(homeDir, 'bin'),
      // Node version managers
      path.join(homeDir, '.nvm', 'current', 'bin'),
      // Try to find actual nvm node version (check common versions)
      ...(function () {
        try {
          const nvmVersionsPath = path.join(homeDir, '.nvm', 'versions', 'node');
          if (fs.existsSync(nvmVersionsPath)) {
            return fs
              .readdirSync(nvmVersionsPath, { withFileTypes: true })
              .filter((dirent) => dirent.isDirectory())
              .map((dirent) =>
                path.join(nvmVersionsPath, dirent.name, 'bin')
              );
          }
        } catch (_e) {
          // Ignore errors reading nvm directory
        }
        return [];
      })(),
      path.join(homeDir, '.fnm', 'node-versions', 'v20.0.0', 'install', 'bin'), // fnm
      // Python version managers
      path.join(homeDir, '.pyenv', 'shims'),
      path.join(homeDir, '.pyenv', 'bin'),
      // Go version managers
      path.join(homeDir, '.gvm', 'bin'),
      path.join(homeDir, '.gvm', 'gos', 'current', 'bin'),
      // Rust/Cargo
      path.join(homeDir, '.cargo', 'bin'),
      // Go
      path.join(homeDir, 'go', 'bin'),
      path.join(homeDir, '.go', 'bin'),
      // iTerm utilities
      '/Applications/iTerm.app/Contents/Resources/utilities',
      // Windows user paths
      ...(process.platform === 'win32'
        ? [
            path.join(homeDir, 'AppData', 'Local', 'Programs'),
            path.join(homeDir, 'AppData', 'Roaming', 'npm'),
            path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
          ]
        : []),
    ].filter((p) => {
      // Filter out paths that don't exist, but allow dynamic version paths
      if (p.includes('v20.0.0') || p.includes('current')) {
        // For version manager paths, check if parent directory exists
        return fs.existsSync(path.dirname(p));
      }
      return fs.existsSync(p);
    });

    // Combine: system PATH (from shell) + user-specific paths + original PATH
    return [
      systemPath,
      ...userPaths,
      originalPath || '',
    ]
      .filter((p) => p)
      .join(pathSeparator);
  }

  // Fallback: add common system and user locations
  console.log('[Server Manager] Could not get system PATH, adding common locations');
  const pathsToAdd = [
    // System binary locations
    '/usr/local/bin',
    '/usr/bin',
    '/opt/homebrew/bin',
    '/usr/local/opt/node/bin',
    '/opt/local/bin',
    '/sbin',
    '/usr/sbin',
    // macOS specific
    ...(process.platform === 'darwin'
      ? [
          '/opt/homebrew/opt/python/bin',
          '/usr/local/opt/python/bin',
          '/Applications/Docker.app/Contents/Resources/bin',
        ]
      : []),
    // Linux specific
    ...(process.platform === 'linux'
      ? ['/snap/bin', path.join(homeDir, '.local', 'bin')]
      : []),
    // Windows specific
    ...(process.platform === 'win32'
      ? [
          path.join(process.env.ProgramFiles || '', 'nodejs'),
          path.join(process.env['ProgramFiles(x86)'] || '', 'nodejs'),
          path.join(homeDir, 'AppData', 'Roaming', 'npm'),
          path.join(
            process.env.ProgramFiles || '',
            'Docker',
            'Docker',
            'resources',
            'bin'
          ),
        ]
      : []),
    // User-specific paths (prioritize these)
    path.join(homeDir, '.local', 'bin'),
    path.join(homeDir, '.npm-global', 'bin'),
    path.join(homeDir, '.cargo', 'bin'),
    path.join(homeDir, 'bin'),
    path.join(homeDir, '.nvm', 'current', 'bin'),
    // Try to find actual nvm node version (check common versions)
    ...(function () {
      try {
        const nvmVersionsPath = path.join(homeDir, '.nvm', 'versions', 'node');
        if (fs.existsSync(nvmVersionsPath)) {
          return fs
            .readdirSync(nvmVersionsPath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => path.join(nvmVersionsPath, dirent.name, 'bin'));
        }
      } catch (_e) {
        // Ignore errors reading nvm directory
      }
      return [];
    })(),
    path.join(homeDir, '.pyenv', 'shims'),
    path.join(homeDir, '.pyenv', 'bin'),
    path.join(homeDir, '.gvm', 'bin'),
    path.join(homeDir, '.gvm', 'gos', 'current', 'bin'),
    path.join(homeDir, 'go', 'bin'),
    path.join(homeDir, '.go', 'bin'),
    // iTerm utilities
    '/Applications/iTerm.app/Contents/Resources/utilities',
    // Windows user paths
    ...(process.platform === 'win32'
      ? [
          path.join(homeDir, 'AppData', 'Local', 'Programs'),
          path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
        ]
      : []),
  ].filter((p) => p && fs.existsSync(p));

  return [...pathsToAdd, originalPath || ''].filter((p) => p).join(pathSeparator);
}

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

    // Enhance PATH to include system paths so spawned process can find npx, uv, docker, etc.
    const enhancedPath = enhancePath(process.env.PATH);
    env.PATH = enhancedPath;
    console.log(`[Server Manager] Enhanced PATH: ${enhancedPath.substring(0, 200)}...`);

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

