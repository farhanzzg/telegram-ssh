#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")
echo "Creating release v${VERSION}..."

# Clean
rm -rf dist build

# Install dependencies
npm ci

# Build all targets
make release

# Create tarballs
cd build
tar -czvf telegram-ssh-bot-${VERSION}-linux-x64.tar.gz telegram-ssh-bot-linux
tar -czvf telegram-ssh-bot-${VERSION}-macos-x64.tar.gz telegram-ssh-bot-macos
zip telegram-ssh-bot-${VERSION}-win-x64.zip telegram-ssh-bot.exe

echo "Release packages created in build/"
