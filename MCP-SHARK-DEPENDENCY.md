# mcp-shark Dependency in Bundled App

## Question: Does mcp-shark require Node.js when used as a dependency?

**Answer: ❌ NO - mcp-shark does NOT require system Node.js in the bundled app.**

## How It Works

### 1. mcp-shark is Bundled

When you build the Electron app, `mcp-shark` and all its dependencies are bundled:

```json
{
  "dependencies": {
    "mcp-shark": "github:mcp-shark/mcp-shark"
  }
}
```

During `npm install` and `npm run build`:
- ✅ `mcp-shark` is installed in `node_modules/mcp-shark`
- ✅ All of mcp-shark's dependencies are installed (including nested ones)
- ✅ Everything is bundled into the Electron app package

### 2. mcp-shark Code Execution

When the bundled app runs, it executes mcp-shark's code using **Electron's bundled Node.js**, not system Node.js:

**UI Server (from mcp-shark/ui/server.js):**
```javascript
// In packaged app
const nodeExecutable = process.execPath; // Electron's Node.js
spawn(process.execPath, [serverScript], {
  env: {
    ELECTRON_RUN_AS_NODE: '1' // Run as Node.js
  }
});
```

**MCP Server (from mcp-shark/mcp-server/mcp-shark.js):**
```javascript
// In packaged app
const nodeExecutable = process.execPath; // Electron's Node.js
spawn(process.execPath, [serverScript], {
  env: {
    ELECTRON_RUN_AS_NODE: '1' // Run as Node.js
  }
});
```

### 3. mcp-shark's Dependencies

mcp-shark has these dependencies:

**mcp-server:**
- `@modelcontextprotocol/sdk` - Pure JavaScript ✅
- `better-sqlite3` - Native module (handled via asarUnpack) ✅
- `commander`, `consola`, `express`, etc. - Pure JavaScript ✅

**ui:**
- `react`, `react-dom` - Pure JavaScript ✅
- `express`, `ws` - Pure JavaScript ✅
- `better-sqlite3` - Native module (handled via asarUnpack) ✅

All dependencies are:
1. **Bundled** in the app package
2. **Executed** using Electron's Node.js runtime
3. **Native modules** (better-sqlite3) are unpacked and work with Electron's Node.js

### 4. Native Module Handling

The `better-sqlite3` native module is handled correctly:

```json
{
  "asarUnpack": [
    "**/node_modules/better-sqlite3/**/*",
    "**/node_modules/*/*.node"
  ]
}
```

This ensures:
- Native modules are unpacked from ASAR (they can't run from inside)
- They work with Electron's bundled Node.js
- No system Node.js compilation needed

## Execution Flow

```
Bundled App Starts
    ↓
Finds mcp-shark in node_modules (bundled)
    ↓
Uses process.execPath (Electron's Node.js)
    ↓
Sets ELECTRON_RUN_AS_NODE=1
    ↓
Runs mcp-shark/server.js or mcp-shark.js
    ↓
mcp-shark code executes using Electron's Node.js
    ↓
All mcp-shark dependencies work (bundled + native modules)
    ↓
✅ Everything works without system Node.js!
```

## Verification

### What's Bundled

1. **mcp-shark source code** - In `node_modules/mcp-shark/`
2. **mcp-shark's dependencies** - All nested in `node_modules/`
3. **Native modules** - Unpacked and ready to use
4. **Electron's Node.js** - Bundled with Electron

### What's NOT Needed

- ❌ System Node.js installation
- ❌ System npm installation
- ❌ Any build tools (Vite, etc. - UI is pre-built)
- ❌ Any external dependencies

## Summary

| Component | Requires System Node.js? |
|-----------|-------------------------|
| **mcp-shark dependency** | ❌ NO - Runs via Electron's Node.js |
| **mcp-shark's dependencies** | ❌ NO - All bundled |
| **Native modules (better-sqlite3)** | ❌ NO - Unpacked, work with Electron's Node.js |
| **UI server (server.js)** | ❌ NO - Runs via Electron's Node.js |
| **MCP server (mcp-shark.js)** | ❌ NO - Runs via Electron's Node.js |

## Conclusion

**mcp-shark as a dependency does NOT require system Node.js** because:

1. ✅ It's bundled in the app package
2. ✅ It's executed using Electron's bundled Node.js (`process.execPath` + `ELECTRON_RUN_AS_NODE`)
3. ✅ All its dependencies are bundled
4. ✅ Native modules are properly unpacked and work with Electron's Node.js

The bundled app is **completely self-contained** - end users don't need Node.js, npm, or any other dependencies installed.

