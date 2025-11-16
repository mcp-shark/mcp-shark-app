# macOS Code Signing Guide

This guide explains how to sign your macOS app for distribution. Code signing is required for:
- ✅ Distribution outside the Mac App Store
- ✅ Notarization (required for macOS 10.15+)
- ✅ Avoiding Gatekeeper warnings
- ✅ Professional distribution

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/
   - You need a paid membership (not just a free Apple ID)

2. **Developer ID Application Certificate**
   - Used for apps distributed outside the Mac App Store
   - Different from Mac App Store certificates

## Step 1: Get Your Developer ID Certificate

### Option A: Using Xcode (Easiest)

1. Open **Xcode**
2. Go to **Xcode → Settings → Accounts** (or **Preferences → Accounts**)
3. Click **+** and sign in with your Apple Developer account
4. Select your team
5. Click **Manage Certificates...**
6. Click **+** → **Developer ID Application**
7. The certificate will be automatically created and added to your Keychain

### Option B: Using Apple Developer Website

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click **+** to create a new certificate
3. Select **Developer ID Application** (under "Software")
4. Follow the instructions to:
   - Create a Certificate Signing Request (CSR) in Keychain Access
   - Upload the CSR
   - Download and install the certificate

### Verify Your Certificate

```bash
# List all Developer ID certificates
security find-identity -v -p codesigning | grep "Developer ID Application"
```

You should see something like:
```
1) ABC123DEF456 "Developer ID Application: Your Name (TEAM_ID)"
```

## Step 2: Configure electron-builder

Update your `package.json` to use your certificate:

```json
{
  "build": {
    "mac": {
      "category": "public.app-category.developer-tools",
      "icon": "assets/icon.png",
      "target": ["dmg", "zip"],
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "assets/entitlements.mac.plist",
      "entitlementsInherit": "assets/entitlements.mac.plist",
      "identity": "Developer ID Application: Your Name (TEAM_ID)"
    }
  }
}
```

### Finding Your Certificate Identity

Run this command to find the exact identity string:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Copy the full string (including the part in quotes) and use it as the `identity` value.

### Alternative: Use Certificate Common Name

You can also use just the common name (the part after "Developer ID Application:"):

```json
"identity": "Your Name (TEAM_ID)"
```

Or use the certificate SHA-1 hash:

```json
"identity": "ABC123DEF456..."
```

## Step 3: Set Up Notarization (Required for macOS 10.15+)

Notarization is required for apps distributed outside the Mac App Store on macOS 10.15 (Catalina) and later.

### Create an App-Specific Password

1. Go to https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Under **Security**, click **Generate Password...**
4. Label it "Notarization" or "macOS Notarization"
5. Copy the generated password (you'll need it)

### Configure Notarization

Add to your `package.json`:

```json
{
  "build": {
    "mac": {
      // ... existing config ...
      "notarize": {
        "teamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### Set Environment Variables

Create a `.env` file (and add it to `.gitignore`):

```bash
APPLE_ID=your-email@example.com
APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop
APPLE_TEAM_ID=YOUR_TEAM_ID
```

Or export them in your shell:

```bash
export APPLE_ID="your-email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

**Important:** Never commit your app-specific password to git!

## Step 4: Build and Sign

### Build with Signing

```bash
npm run build:mac
```

electron-builder will:
1. Build your app
2. Sign the app bundle with your Developer ID certificate
3. Sign all nested binaries and frameworks
4. Optionally notarize the app (if configured)

### Verify Signing

After building, verify the app is signed:

```bash
# Check the app signature
codesign -dv --verbose=4 "dist/mac-arm64/MCP Shark.app"

# Verify the signature
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/MCP Shark.app"

# Check entitlements
codesign -d --entitlements - "dist/mac-arm64/MCP Shark.app"
```

### Check Notarization Status

If you configured notarization:

```bash
spctl --assess --verbose --type install "dist/mac-arm64/MCP Shark.app"
```

Or check the notarization ticket:

```bash
spctl --assess --type execute --verbose --ignore-cache --no-cache "dist/mac-arm64/MCP Shark.app"
```

## Step 5: Test the Signed App

1. **Copy the app to a different location** (to test as a user would):
   ```bash
   cp -R "dist/mac-arm64/MCP Shark.app" ~/Desktop/
   ```

2. **Try to run it**:
   ```bash
   open ~/Desktop/MCP\ Shark.app
   ```

3. **Check Gatekeeper**:
   - The app should open without warnings
   - No "App is damaged" errors
   - No need to right-click → Open

## Troubleshooting

### "No identity found" Error

**Problem:** electron-builder can't find your certificate

**Solutions:**
1. Verify the certificate is in your Keychain:
   ```bash
   security find-identity -v -p codesigning
   ```

2. Make sure you're using the exact identity string:
   ```bash
   # Get the exact string
   security find-identity -v -p codesigning | grep "Developer ID Application"
   ```

3. Try using just the common name or SHA-1 hash

### "User interaction is not allowed" Error

**Problem:** Keychain is asking for permission

**Solution:** Unlock your keychain or allow access:
```bash
# Unlock keychain (you'll be prompted for password)
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

### Notarization Fails

**Common issues:**
1. **Invalid credentials**: Double-check your Apple ID and app-specific password
2. **Team ID mismatch**: Ensure `APPLE_TEAM_ID` matches your certificate's team ID
3. **Entitlements issues**: Make sure your entitlements file is correct
4. **Hardened Runtime**: Required for notarization (already enabled in your config)

**Check notarization logs:**
```bash
# Find the log file
xcrun altool --notarization-history 0 -u YOUR_APPLE_ID -p YOUR_APP_SPECIFIC_PASSWORD
```

### App Still Shows Warnings

If the app still shows Gatekeeper warnings:
1. Make sure notarization completed successfully
2. Wait a few minutes (notarization can take time to propagate)
3. Clear Gatekeeper cache:
   ```bash
   sudo spctl --master-disable
   sudo spctl --master-enable
   ```

## Quick Reference

### Minimal Configuration

For basic signing (without notarization):

```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)"
    }
  }
}
```

### Full Configuration (with Notarization)

```json
{
  "build": {
    "mac": {
      "category": "public.app-category.developer-tools",
      "icon": "assets/icon.png",
      "target": ["dmg", "zip"],
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "assets/entitlements.mac.plist",
      "entitlementsInherit": "assets/entitlements.mac.plist",
      "identity": "Developer ID Application: Your Name (TEAM_ID)",
      "notarize": {
        "teamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### Environment Variables

```bash
export APPLE_ID="your-email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"
```

## Resources

- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Apple Developer Portal](https://developer.apple.com/account/)

## Notes

- **Development builds** don't need to be signed (you can keep `"identity": null` for local testing)
- **Distribution builds** should always be signed
- Notarization can take 5-30 minutes
- Signed apps work on all macOS versions
- Notarized apps work seamlessly on macOS 10.15+

