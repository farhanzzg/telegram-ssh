#!/bin/bash
set -e

# Installation script for Telegram SSH Bot systemd user service

INSTALL_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/telegram-ssh-bot"
SERVICE_DIR="$HOME/.config/systemd/user"
ENV_FILE="$CONFIG_DIR/.env"
ENV_EXAMPLE="$(dirname "$0")/.env.example"

echo "Installing Telegram SSH Bot..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$SERVICE_DIR"

# Check if binary exists
if [ ! -f "build/telegram-ssh-bot" ]; then
    echo "Error: Binary not found. Run 'npm run build:binary' first."
    exit 1
fi

# Copy binary
cp build/telegram-ssh-bot "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/telegram-ssh-bot"

# Copy service file
cp deploy/telegram-ssh-bot.service "$SERVICE_DIR/"

# Generate a secure random encryption key (64 hex characters = 32 bytes)
generate_encryption_key() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    elif [ -f /dev/urandom ]; then
        head -c 32 /dev/urandom | xxd -p -c 64
    else
        # Fallback using /dev/random
        head -c 32 /dev/random | xxd -p -c 64
    fi
}

# Create default .env if not exists
if [ ! -f "$ENV_FILE" ]; then
    # Check if .env.example exists
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo "Created configuration file from template: $ENV_FILE"
    else
        # Create a minimal .env file
        cat > "$ENV_FILE" << 'EOF'
# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
BOT_CHAT_ID=your_chat_id_here
BOT_OWNER_IDS=123456789,987654321

# Security
ENCRYPTION_KEY=

# SSH Configuration
SSH_DEFAULT_PORT=22
SSH_CONNECTION_TIMEOUT=30000
SSH_COMMAND_TIMEOUT=30000
SSH_DEFAULT_PRIVATE_KEY_PATH=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Backup
BACKUP_ENABLED=true
BACKUP_INTERVAL_MS=3600000
BACKUP_MAX_COUNT=10

# Monitoring
MONITORING_ENABLED=true
MONITORING_INTERVAL_MS=300000
EOF
        echo "Created minimal configuration file: $ENV_FILE"
    fi

    # Generate and set encryption key
    ENCRYPTION_KEY=$(generate_encryption_key)
    if [ -n "$ENCRYPTION_KEY" ]; then
        # Replace the ENCRYPTION_KEY line with the generated key
        if grep -q "^ENCRYPTION_KEY=" "$ENV_FILE"; then
            sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" "$ENV_FILE"
        else
            # If the line doesn't exist, add it
            echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$ENV_FILE"
        fi
        echo "Generated secure encryption key"
    else
        echo "Warning: Could not generate encryption key. Please set it manually."
    fi

    echo ""
    echo "============================================================"
    echo "IMPORTANT: Configuration file created at: $ENV_FILE"
    echo "Please edit this file and fill in the required values:"
    echo "  - BOT_TOKEN: Your Telegram bot token"
    echo "  - BOT_CHAT_ID: Your Telegram chat ID"
    echo "  - BOT_OWNER_IDS: Comma-separated list of owner user IDs"
    echo ""
    echo "A secure ENCRYPTION_KEY has been generated for you."
    echo "============================================================"
else
    echo "Configuration file already exists: $ENV_FILE"
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
if [ -f "$ENV_FILE" ]; then
    echo "Configuration file: $ENV_FILE"
    echo "Don't forget to edit it with your credentials!"
fi
