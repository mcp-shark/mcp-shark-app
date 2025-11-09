# Quick Fix - Rebuild Required

## The Error You're Seeing

```
CRITICAL: mcp-shark is in ASAR archive (read-only)!
server.js cannot execute from ASAR. Rebuild required.
```

**This is EXPECTED** - it's a safety check preventing the app from trying to execute code from a read-only archive.

## The Solution

You **MUST rebuild** the app. The current build has `mcp-shark` in the ASAR (read-only), but it needs to be unpacked.

## Rebuild Steps

```bash
# 1. Clean the old build
rm -rf dist/

# 2. Rebuild (this will unpack mcp-shark)
npm run build:mac

# 3. Verify it worked
ls -la "dist/mac-arm64/MCP Shark.app/Contents/Resources/app/node_modules/mcp-shark"

# 4. Run the app
open "dist/mac-arm64/MCP Shark.app"
```

## What Should Happen

After rebuilding, when you run the app, you should see in the logs:
- ✅ "Unpacked path exists: **true**" (not false)
- ✅ "Found mcp-shark in unpacked node_modules: ..."
- ✅ "Server script exists: true"
- ✅ "UI server process spawned with PID: ..."

Instead of:
- ❌ "Unpacked path exists: false"
- ❌ "Found mcp-shark in app.asar (read-only)"

## If Rebuild Doesn't Work

If after rebuilding you still see "Unpacked path exists: false", check:

1. **Verify asarUnpack in package.json:**
   ```json
   "asarUnpack": [
     "**/node_modules/mcp-shark/**/*"
   ]
   ```

2. **Check build output** for any warnings about asarUnpack

3. **Try a more explicit pattern:**
   ```json
   "asarUnpack": [
     "**/node_modules/mcp-shark/**/*",
     "node_modules/mcp-shark/**/*"
   ]
   ```

4. **Clean everything and rebuild:**
   ```bash
   rm -rf dist/ node_modules/.cache
   npm run build:mac
   ```

## One-Line Rebuild

```bash
rm -rf dist/ && npm run build:mac && open "dist/mac-arm64/MCP Shark.app"
```

