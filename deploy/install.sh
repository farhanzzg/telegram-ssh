#!/bin/bash
set -e

# Installation script for Telegram SSH Bot systemd user service

INSTALL_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/telegram-ssh-bot"
SERVICE_DIR="$HOME/.config/systemd/user"

echo "Installing Telegram SSH Bot..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$SERVICE_DIR"

# Copy binary
cp build/telegram-ssh-bot "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/telegram-ssh-bot"

# Copy service file
cp deploy/telegram-ssh-bot.service "$SERVICE_DIR/"

# Create default .env if not exists
if [ ! -f "$CONFIG_DIR/.env" ]; then
    cp deploy/.env.example "$CONFIG_DIR/.env"
    echo "Created default configuration at $CONFIG_DIR/.env"
    echo "Please edit this file with your credentials!"
fi

# Reload systemd
systemctl --user daemon-reload

echo ""
echo "Installation complete!"
echo ""
echo "To enable the service:"
echo "  systemctl --user enable telegram-ssh-bot"
echo ""
echo "To start the service:"
echo "  systemctl --user start telegram-ssh-bot"
echo ""
echo "To view logs:"
echo "  journalctl --user -u telegram-ssh-bot -f"
echo ""
echo "Don't forget to edit $CONFIG_DIR/.env with your credentials!"
