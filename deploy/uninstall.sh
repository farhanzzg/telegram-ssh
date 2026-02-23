#!/bin/bash
set -e

# Parse arguments
FORCE=false
REMOVE_BINARY=false
REMOVE_CONFIG=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        --remove-binary)
            REMOVE_BINARY=true
            shift
            ;;
        --remove-config)
            REMOVE_CONFIG=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --force         Non-interactive mode (skip prompts)"
            echo "  --remove-binary     Remove binary in force mode"
            echo "  --remove-config     Remove configuration in force mode"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "Uninstalling Telegram SSH Bot..."

# Stop and disable service
systemctl --user stop telegram-ssh-bot 2>/dev/null || true
systemctl --user disable telegram-ssh-bot 2>/dev/null || true

# Remove service file
rm -f "$HOME/.config/systemd/user/telegram-ssh-bot.service"

# Reload systemd
systemctl --user daemon-reload

# Handle binary removal
if [ "$FORCE" = true ]; then
    if [ "$REMOVE_BINARY" = true ]; then
        rm -f "$HOME/.local/bin/telegram-ssh-bot"
        echo "Binary removed."
    fi
else
    read -p "Remove binary? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$HOME/.local/bin/telegram-ssh-bot"
    fi
fi

# Handle config removal
if [ "$FORCE" = true ]; then
    if [ "$REMOVE_CONFIG" = true ]; then
        rm -rf "$HOME/.config/telegram-ssh-bot"
        echo "Configuration and data removed."
    fi
else
    read -p "Remove configuration and data? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$HOME/.config/telegram-ssh-bot"
    fi
fi

echo "Uninstallation complete!"
