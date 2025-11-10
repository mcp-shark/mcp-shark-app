#!/bin/bash

# Fix macOS Gatekeeper "App is Damaged" Error
# This script removes quarantine attributes from downloaded MCP Shark files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}MCP Shark - macOS Gatekeeper Fix${NC}"
echo "=================================="
echo ""

# Function to remove quarantine attribute
remove_quarantine() {
    local file_path="$1"
    
    if [ ! -e "$file_path" ]; then
        echo -e "${RED}✗ File not found: $file_path${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Removing quarantine from: $file_path${NC}"
    xattr -cr "$file_path"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully removed quarantine attribute${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to remove quarantine attribute${NC}"
        return 1
    fi
}

# Check if file path provided as argument
if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-file>"
    echo ""
    echo "Examples:"
    echo "  $0 ~/Downloads/MCP\\ Shark-1.0.0-arm64.dmg"
    echo "  $0 ~/Downloads/MCP\\ Shark-1.0.0-arm64-mac.zip"
    echo "  $0 /Applications/MCP\\ Shark.app"
    echo ""
    echo "Or drag and drop the file onto this script in Terminal."
    exit 1
fi

# Process each file provided
for file_path in "$@"; do
    # Expand ~ and resolve relative paths
    file_path=$(eval echo "$file_path")
    
    if [ -d "$file_path" ] && [[ "$file_path" == *.app ]]; then
        # It's an .app bundle
        remove_quarantine "$file_path"
    elif [ -f "$file_path" ]; then
        # It's a file (DMG, ZIP, etc.)
        remove_quarantine "$file_path"
    else
        echo -e "${RED}✗ Invalid path: $file_path${NC}"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
echo "You can now open the app by:"
echo "  1. Right-click → Open"
echo "  2. Or double-click (should work now)"
echo ""

