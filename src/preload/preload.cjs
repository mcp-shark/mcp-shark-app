const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // MCP Server controls
  startMCPServer: (configPath) => ipcRenderer.invoke('start-mcp-server', configPath),
  stopMCPServer: () => ipcRenderer.invoke('stop-mcp-server'),
  isMCPServerRunning: () => ipcRenderer.invoke('is-mcp-server-running'),
  isUIServerRunning: () => ipcRenderer.invoke('is-ui-server-running'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getMCPSharkVersion: () => ipcRenderer.invoke('get-mcp-shark-version'),

  // Debug logs
  getDebugLogs: () => ipcRenderer.invoke('get-debug-logs'),
  onDebugLog: (callback) => {
    ipcRenderer.on('debug-log', (event, log) => callback(log));
  },

  // Listen for errors
  onError: (callback) => {
    ipcRenderer.on('error', (event, error) => callback(error));
  },
});

