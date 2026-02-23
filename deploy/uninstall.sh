#!/bin/bash
set -e

echo "Uninstalling Telegram SSH Bot..."

# Stop and disable service
systemctl --user stop telegram-ssh-bot 2>/dev/null || true
systemctl --user disable telegram-ssh-bot 2>/dev/null || true

# Remove service file
rm -f "$HOME/.config/systemd/user/telegram-ssh-bot.service"

# Reload systemd
systemctl --user daemon-reload

# Ask about binary removal
read -p "Remove binary? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f "$HOME/.local/bin/telegram-ssh-bot"
fi

# Ask about config removal
read -p "Remove configuration and data? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$HOME/.config/telegram-ssh-bot"
fi

echo "Uninstallation complete!"
