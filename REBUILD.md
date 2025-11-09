# Rebuilding the App - Important!

## The Problem

The app is currently built with `mcp-shark` inside the ASAR archive (read-only). This means `server.js` cannot execute because ASAR files are read-only archives.

## The Solution

You **MUST rebuild** the app after adding `mcp-shark` to `asarUnpack` in `package.json`.

## Steps to Fix

1. **Clean the old build:**
   ```bash
   rm -rf dist/
   ```

2. **Rebuild the app:**
   ```bash
   npm run build:mac
   ```

3. **Verify the unpack:**
   After building, check that `mcp-shark` is unpacked:
   ```bash
   ls -la "dist/mac-arm64/MCP Shark.app/Contents/Resources/app/node_modules/mcp-shark"
   ```
   
   If this directory exists, the unpack worked!

4. **Run the app:**
   ```bash
   open "dist/mac-arm64/MCP Shark.app"
   ```

## Why This Happens

- `electron-builder` packages everything into an ASAR archive by default
- ASAR archives are **read-only** - you can read files but cannot execute scripts
- The `asarUnpack` configuration tells electron-builder to extract certain files outside the ASAR
- We need `mcp-shark` unpacked so `server.js` can execute

## Configuration

The `package.json` should have:
```json
"asarUnpack": [
  "**/node_modules/better-sqlite3/**/*",
  "**/node_modules/@swc/core*/**/*",
  "**/node_modules/*/build/**/*",
  "**/node_modules/*/*.node",
  "**/node_modules/mcp-shark/**/*"  // ← This line unpacks mcp-shark
]
```

## Troubleshooting

If after rebuilding you still see "Unpacked path exists: false":

1. **Check the build output** - look for any warnings about asarUnpack
2. **Verify the pattern** - make sure `**/node_modules/mcp-shark/**/*` matches your structure
3. **Try a more specific pattern:**
   ```json
   "asarUnpack": [
     "**/node_modules/mcp-shark/**/*",
     "**/node_modules/mcp-shark/ui/**/*",
     "**/node_modules/mcp-shark/mcp-server/**/*"
   ]
   ```
4. **Check electron-builder version** - ensure you're using a recent version that supports asarUnpack

## Quick Rebuild Command

```bash
rm -rf dist/ && npm run build:mac && open "dist/mac-arm64/MCP Shark.app"
```

