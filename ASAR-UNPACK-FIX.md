# Fixing ASAR Unpack Issue

## Problem

The `asarUnpack` pattern `**/node_modules/mcp-shark/**/*` might not be matching correctly. 

## Solution: Try Multiple Patterns

I've updated `package.json` to include both patterns:
- `**/node_modules/mcp-shark/**/*` (glob pattern)
- `node_modules/mcp-shark/**/*` (explicit pattern)

## Rebuild Steps

```bash
# 1. Clean old build
rm -rf dist/

# 2. Rebuild
npm run build:mac

# 3. Verify unpack worked
ls -la "dist/mac-arm64/MCP Shark.app/Contents/Resources/app/node_modules/mcp-shark"
```

## If Still Not Working

If `mcp-shark` is still not unpacked after rebuild, try:

### Option 1: Use extraResources instead

Add to `package.json`:
```json
"extraResources": [
  {
    "from": "node_modules/mcp-shark",
    "to": "node_modules/mcp-shark",
    "filter": ["**/*"]
  }
]
```

### Option 2: Disable ASAR for mcp-shark

Temporarily disable ASAR to test:
```json
"asar": false
```

### Option 3: Check electron-builder version

```bash
npm list electron-builder
```

Update if needed:
```bash
npm install --save-dev electron-builder@latest
```

### Option 4: Manual unpack after build

As a workaround, you could manually copy mcp-shark after build, but this is not ideal.

## Debug Build Output

Run build with verbose output:
```bash
DEBUG=electron-builder npm run build:mac
```

Look for messages about asarUnpack in the output.

