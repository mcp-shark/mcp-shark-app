import { spawn, exec, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { createConnection } from 'net';
import { promisify } from 'util';
import { ipcMain } from 'electron';

const execAsync = promisify(exec);

let uiServerProcess = null;
let uiPort = 9853;

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
        timeout: 1000, // Reduced timeout to avoid blocking
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 1024 * 1024, // 1MB buffer for PATH
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
              console.log(`[UI Manager] Got PATH from ${shell} (${shellName})`);
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
              console.log(`[UI Manager] Got PATH from ${file}`);
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
    console.warn('[UI Manager] Could not get system PATH:', error.message);
  }
  return null;
}

/**
 * Enhance PATH environment variable to include system paths and user paths
 * This is especially important in Electron where PATH might not include system executables
 * Returns null if enhancement fails (caller should use original PATH)
 */
function enhancePath(originalPath) {
  try {
    const os = require('os');
    const homeDir = os.homedir();
    const pathSeparator = process.platform === 'win32' ? ';' : ':';

    // Try to get the actual system PATH from the host (includes user's custom PATH)
    // Use a quick timeout to avoid blocking
    const systemPath = getSystemPath();
    if (systemPath) {
      console.log('[UI Manager] Using system PATH from host machine');
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
    console.log('[UI Manager] Could not get system PATH, adding common locations');
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
  } catch (error) {
    console.warn('[UI Manager] PATH enhancement failed:', error.message);
    // Return original PATH if enhancement fails
    return originalPath || process.env.PATH || '';
  }
}

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
export async function startUIServer(mcpSharkPath, onProcess, debugLog = null) {
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

    startUIServerAfterBuild(mcpSharkPath, onProcess, resolve, reject, debugLog);
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

async function startUIServerAfterBuild(mcpSharkPath, onProcess, resolve, reject, debugLog = null) {
  const uiPath = path.join(mcpSharkPath, 'ui');
  
  // Define log function to use debugLog callback or console as fallback
  const log = debugLog || ((level, message) => {
    if (level === 'error') {
      console.error(`[UI Manager] ${message}`);
    } else if (level === 'warn') {
      console.warn(`[UI Manager] ${message}`);
    } else {
      console.log(`[UI Manager] ${message}`);
    }
  });
  
  // Verify UI path exists
  const fs = await import('fs');
  if (!fs.existsSync(uiPath)) {
    const error = `UI path does not exist: ${uiPath}`;
    log('error', error);
    reject(new Error(error));
    return;
  }
  
  const serverScript = path.join(uiPath, 'server.js');
  if (!fs.existsSync(serverScript)) {
    const error = `Server script does not exist: ${serverScript}`;
    log('error', error);
    reject(new Error(error));
    return;
  }
  
  log('info', `Starting UI server from: ${uiPath}`);
  log('info', `Server script: ${serverScript}`);
  log('info', `Server script exists: ${fs.existsSync(serverScript)}`);
  
  // Check if dist folder exists
  const distPath = path.join(uiPath, 'dist');
  const distExists = fs.existsSync(distPath);
  log('info', `Dist folder exists: ${distExists} at ${distPath}`);
  
  if (!distExists) {
    const errorMsg = `UI dist folder not found at ${distPath}. The UI must be built before packaging.`;
    log('error', errorMsg);
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
  
  // Prepare environment - ensure NODE_PATH includes the ui directory's node_modules
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1', // Tell Electron to run as Node.js (cross-platform)
  };
  
  // Add node_modules paths to NODE_PATH for module resolution
  // This helps the server.js find its dependencies in the packaged app
  const uiNodeModules = path.join(uiPath, 'node_modules');
  const parentNodeModules = path.join(mcpSharkPath, 'node_modules');
  const rootNodeModules = isPackaged 
    ? path.join(process.resourcesPath, 'app', 'node_modules')
    : path.join(path.dirname(mcpSharkPath), 'node_modules');
  
  const nodePaths = [
    uiNodeModules,
    parentNodeModules,
    rootNodeModules,
  ].filter(p => {
    const exists = fs.existsSync(p);
    if (!exists) {
      console.log(`NODE_PATH candidate does not exist: ${p}`);
    }
    return exists;
  });
  
  if (nodePaths.length > 0) {
    env.NODE_PATH = nodePaths.join(path.delimiter);
    log('info', `NODE_PATH set to: ${env.NODE_PATH}`);
    log('info', `NODE_PATH components: ${JSON.stringify(nodePaths)}`);
  } else {
    log('warn', 'WARNING: No valid NODE_PATH found! Module resolution may fail.');
  }
  
  // Also set __dirname equivalent for ES modules
  // The server.js uses import.meta.url, so we need to ensure it can resolve modules
  // Set PWD to uiPath to help with relative imports
  env.PWD = uiPath;

  // Enhance PATH to include system paths so spawned process can find npx, uv, docker, etc.
  try {
    const enhancedPath = enhancePath(process.env.PATH);
    env.PATH = enhancedPath;
    log('info', `[UI Manager] Enhanced PATH length: ${enhancedPath.length} chars`);
    log('info', `[UI Manager] Enhanced PATH preview: ${enhancedPath.substring(0, 200)}...`);
  } catch (pathError) {
    log('warn', `[UI Manager] Failed to enhance PATH: ${pathError.message}, using original PATH`);
    // Use original PATH if enhancement fails
    env.PATH = process.env.PATH || '';
  }

  log('info', 'Spawning UI server process...');
  log('info', `Executable: ${nodeExecutable}`);
  log('info', `Script: ${serverScript}`);
  log('info', `CWD: ${uiPath}`);
  log('info', `NODE_ENV: ${env.NODE_ENV}`);
  log('info', `ELECTRON_RUN_AS_NODE: ${env.ELECTRON_RUN_AS_NODE}`);

  uiServerProcess = spawn(nodeExecutable, [serverScript], {
    cwd: uiPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false, // Don't use shell to avoid PATH issues (works on all platforms)
    detached: false,
    env: env,
  });
  
  log('info', `UI server process spawned with PID: ${uiServerProcess.pid}`);
  log('info', `Process spawn args: ${JSON.stringify([nodeExecutable, serverScript])}`);
  log('info', `Process spawn options: cwd=${uiPath}, env keys=${Object.keys(env).length}`);

  let output = '';
  let errorOutput = '';
  let checkCount = 0;
  const maxChecks = 20; // Increased to 10 seconds
  const checkInterval = 500;
  let checkServer = null;
  let serverStarted = false;
  
  // Log immediately when process is created
  log('info', 'UI server process created, setting up event handlers...');

  uiServerProcess.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    const lines = text.trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        log('info', `[UI Server] ${line}`);
        console.log(`[UI Server stdout] ${line}`);
      }
    });
  });

  uiServerProcess.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    const lines = text.trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        log('error', `[UI Server Error] ${line}`);
        console.error(`[UI Server stderr] ${line}`);
      }
    });
    // Log immediately so we can see errors as they happen
    if (text.includes('Error') || text.includes('error') || text.includes('Error:') || text.includes('Cannot find module')) {
      log('error', `CRITICAL UI Server Error detected: ${text}`);
      console.error(`[CRITICAL UI Server Error] ${text}`);
    }
  });

  uiServerProcess.on('error', (error) => {
    const errorMsg = `Failed to spawn UI server process: ${error.message}\nPath: ${serverScript}\nNode: ${nodeExecutable}\nCWD: ${uiPath}\nError code: ${error.code}\nPATH length: ${env.PATH?.length || 0}`;
    log('error', '='.repeat(80));
    log('error', 'UI SERVER SPAWN ERROR:');
    log('error', errorMsg);
    log('error', `Full error: ${JSON.stringify(error)}`);
    log('error', `Error stack: ${error.stack}`);
    log('error', `Executable exists: ${fs.existsSync(nodeExecutable)}`);
    log('error', `Script exists: ${fs.existsSync(serverScript)}`);
    log('error', '='.repeat(80));
    console.error('='.repeat(80));
    console.error('UI SERVER SPAWN ERROR:', errorMsg);
    console.error(`Executable exists: ${fs.existsSync(nodeExecutable)}`);
    console.error(`Script exists: ${fs.existsSync(serverScript)}`);
    console.error('='.repeat(80));
    uiServerProcess = null;
    if (checkServer) clearInterval(checkServer);
    reject(new Error(errorMsg));
  });

  uiServerProcess.on('exit', (code, signal) => {
    log('info', '='.repeat(80));
    log('info', `UI server exited with code ${code} and signal ${signal}`);
    log('info', `Server started flag: ${serverStarted}`);
    log('info', `Check count: ${checkCount}/${maxChecks}`);
    console.log(`[UI Server] Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
    if (code !== 0 && code !== null && !serverStarted) {
      log('error', 'UI SERVER EXIT ERROR:');
      log('error', `Exit code: ${code}`);
      log('error', `Signal: ${signal}`);
      log('error', `Process PID was: ${uiServerProcess?.pid}`);
      log('error', '--- Server Output ---');
      log('error', output || '(no output)');
      log('error', '--- Server Errors ---');
      log('error', errorOutput || '(no errors)');
      log('error', '='.repeat(80));
      console.error('='.repeat(80));
      console.error('UI SERVER EXIT ERROR:');
      console.error(`Exit code: ${code}, Signal: ${signal}`);
      console.error('--- Server Output ---');
      console.error(output || '(no output)');
      console.error('--- Server Errors ---');
      console.error(errorOutput || '(no errors)');
      console.error('='.repeat(80));
      // If server exits with error before starting, reject the promise
      if (checkServer) {
        clearInterval(checkServer);
      }
      const errorMsg = `UI server exited with code ${code}.\nOutput: ${output}\nErrors: ${errorOutput}`;
      log('error', errorMsg);
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
      log('error', errorMsg);
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
        log('info', '✅ UI server started successfully on port 9853');
        resolve({
          success: true,
          message: 'UI server started successfully',
          pid: uiServerProcess.pid,
        });
      } else if (checkCount >= maxChecks) {
        clearInterval(checkServer);
        clearTimeout(timeout);
        const errorMsg = `UI server did not start after ${maxChecks * checkInterval}ms.\nOutput: ${output}\nErrors: ${errorOutput}`;
        log('error', errorMsg);
        reject(new Error(errorMsg));
      }
    }).catch((err) => {
      log('error', `Error checking if UI server is running: ${err.message}`);
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

