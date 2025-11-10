#!/usr/bin/env node

/**
 * Generate platform-specific icons from og-image.png
 * This script creates square icons for macOS, Windows, and Linux
 */

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceImage = path.join(__dirname, 'assets', 'og-image-source.png');
const outputDir = path.join(__dirname, 'assets');

// Check if ImageMagick is available
function hasImageMagick() {
  try {
    execSync('which convert', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if sips is available (macOS)
function hasSips() {
  try {
    execSync('which sips', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateIcon(size, outputFile) {
  if (!fs.existsSync(sourceImage)) {
    console.error(`Source image not found: ${sourceImage}`);
    return false;
  }

  try {
    if (hasImageMagick()) {
      // Use ImageMagick to create square icon with transparent background
      execSync(
        `convert "${sourceImage}" -resize ${size}x${size}^ -gravity center -extent ${size}x${size} -background transparent "${outputFile}"`,
        { stdio: 'inherit' }
      );
      console.log(`✓ Generated ${outputFile} (${size}x${size}) using ImageMagick`);
      return true;
    } else if (hasSips()) {
      // Use sips (macOS) - note: sips doesn't support extent, so we'll resize
      execSync(`sips -z ${size} ${size} "${sourceImage}" --out "${outputFile}"`, { stdio: 'inherit' });
      console.log(`✓ Generated ${outputFile} (${size}x${size}) using sips`);
      return true;
    } else {
      console.warn('Neither ImageMagick nor sips found. Please install ImageMagick: brew install imagemagick');
      console.warn('Or manually create icon.png (512x512) from og-image-source.png');
      return false;
    }
  } catch (error) {
    console.error(`Failed to generate ${outputFile}:`, error.message);
    return false;
  }
}

// Generate icons
console.log('Generating platform icons from og-image.png...\n');

// Main icon for all platforms (512x512)
const mainIcon = path.join(outputDir, 'icon.png');
generateIcon(512, mainIcon);

// Windows-specific (256x256) - electron-builder will convert to ICO
const winIcon = path.join(outputDir, 'icon-256.png');
generateIcon(256, winIcon);

// macOS-specific (1024x1024 for better quality) - electron-builder will convert to ICNS
const macIcon = path.join(outputDir, 'icon-1024.png');
generateIcon(1024, macIcon);

console.log('\n✓ Icon generation complete!');
console.log('\nNote: electron-builder will automatically convert PNG to platform-specific formats:');
console.log('  - macOS: PNG → ICNS');
console.log('  - Windows: PNG → ICO');
console.log('  - Linux: PNG (as-is)');

