# Deployment Guide

## Installation Methods

### Option 1: npm/pnpm Global Installation (Recommended)

The easiest way to install and run the bot:

```bash
# Install globally with npm
npm install -g telegram-ssh-bot

# Or with pnpm
pnpm add -g telegram-ssh-bot
```

During installation, the post-install script automatically:

- Creates the configuration directory at `~/.config/telegram-ssh-bot/`
- Generates a `.env` configuration file
- Generates a secure encryption key

After installation:

```bash
# Edit configuration with your credentials
nano ~/.config/telegram-ssh-bot/.env

# Run the bot
telegram-ssh-bot
```

### Option 2: Binary Installation with Systemd

For production deployments with systemd service management:

```bash
# Quick install
./deploy/install.sh
```

The installation script automatically:

- Copies the binary to `~/.local/bin/telegram-ssh-bot`
- Creates the configuration directory
- Generates a `.env` file with a secure encryption key
- Installs the systemd user service

After installation:

```bash
# Edit configuration
nano ~/.config/telegram-ssh-bot/.env

# Enable and start the service
systemctl --user enable telegram-ssh-bot
systemctl --user start telegram-ssh-bot
```

## Prerequisites

- **For npm/pnpm installation**: Node.js 18+
- **For binary installation**: Linux system with systemd

## Manual Installation

If you prefer manual installation:

1. Copy binary:

   ```bash
   mkdir -p ~/.local/bin
   cp build/telegram-ssh-bot ~/.local/bin/
   chmod +x ~/.local/bin/telegram-ssh-bot
   ```

2. Create config directory and configuration:

   ```bash
   mkdir -p ~/.config/telegram-ssh-bot

   # Copy example config (encryption key will need manual generation)
   cp deploy/.env.example ~/.config/telegram-ssh-bot/.env

   # Generate encryption key
   echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> ~/.config/telegram-ssh-bot/.env

   # Edit .env with your credentials
   nano ~/.config/telegram-ssh-bot/.env
   ```

3. Install systemd service:

   ```bash
   mkdir -p ~/.config/systemd/user
   cp deploy/telegram-ssh-bot.service ~/.config/systemd/user/
   systemctl --user daemon-reload
   ```

4. Enable and start:

   ```bash
   systemctl --user enable telegram-ssh-bot
   systemctl --user start telegram-ssh-bot
   ```

## Service Management

| Command                      | Description        |
| ---------------------------- | ------------------ |
| `./deploy/manage.sh start`   | Start service      |
| `./deploy/manage.sh stop`    | Stop service       |
| `./deploy/manage.sh restart` | Restart service    |
| `./deploy/manage.sh status`  | Show status        |
| `./deploy/manage.sh logs`    | Follow logs        |
| `./deploy/manage.sh enable`  | Enable auto-start  |
| `./deploy/manage.sh disable` | Disable auto-start |

## Uninstallation

### Interactive Uninstall

```bash
./deploy/uninstall.sh
```

This will prompt you to confirm:

- Whether to remove the binary
- Whether to remove configuration and data

### Non-Interactive (Force) Uninstall

For scripts or automated environments:

```bash
# Remove everything (binary and config)
./deploy/uninstall.sh -f --remove-binary --remove-config

# Remove only the binary
./deploy/uninstall.sh -f --remove-binary

# Remove only the configuration
./deploy/uninstall.sh -f --remove-config

# Stop service only (keep everything)
./deploy/uninstall.sh -f
```

### Uninstall Options

| Option            | Description                                 |
| ----------------- | ------------------------------------------- |
| `-f, --force`     | Non-interactive mode (skip prompts)         |
| `--remove-binary` | Remove binary in force mode                 |
| `--remove-config` | Remove configuration and data in force mode |
| `-h, --help`      | Show help message                           |

## Configuration

The configuration file is located at `~/.config/telegram-ssh-bot/.env`.

### Required Configuration

Edit the following required values:

- `BOT_TOKEN` - Telegram bot token from @BotFather
- `BOT_CHAT_ID` - Primary chat ID for notifications
- `BOT_OWNER_IDS` - Comma-separated list of authorized user IDs

### Auto-Generated Values

The following are automatically generated during installation:

- `ENCRYPTION_KEY` - 64-character hex key for credential encryption

### Optional Configuration

See the `.env.example` file or [README.md](../README.md) for all available configuration options including:

- SSH settings (`SSH_DEFAULT_PORT`, `SSH_CONNECTION_TIMEOUT`, etc.)
- Rate limiting (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`)
- Backup settings (`BACKUP_ENABLED`, `BACKUP_INTERVAL_MS`, `BACKUP_MAX_COUNT`)
- Monitoring settings (`MONITORING_ENABLED`, `MONITORING_INTERVAL_MS`)
