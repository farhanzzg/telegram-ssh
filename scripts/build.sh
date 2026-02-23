#!/bin/bash
set -e

echo "Building Telegram SSH Bot..."

# Clean previous builds
rm -rf dist build

# Compile TypeScript
echo "Compiling TypeScript..."
npm run build

# Create build directory
mkdir -p build

# Build binaries for current platform
echo "Creating binary executable..."
npx pkg . --targets node18-linux-x64 --output build/telegram-ssh-bot

echo "Build complete! Binary available at: build/telegram-ssh-bot"
