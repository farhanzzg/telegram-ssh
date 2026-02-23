# Migration Guide: v1.x to v2.0

This guide helps you migrate from the JavaScript version (v1.x) to the TypeScript version (v2.0).

## Overview

Version 2.0 is a complete rewrite with:

- TypeScript strict mode
- Encrypted credential storage
- Environment-based configuration
- Modular architecture
- Enhanced security features

## Breaking Changes

### Configuration Method

**v1.x (CLI Arguments)**

```bash
node bot.js \
  --bot_token "your_token" \
  --chat_id "your_chat_id" \
  --owner_ids "123456789" \
  --path_privatekey "/home/user/.ssh/id_rsa" \
  --servers_file "/path/to/servers.json"
```

**v2.0 (Environment Variables)**

```bash
# ~/.config/telegram-ssh-bot/.env
BOT_TOKEN=your_token
BOT_CHAT_ID=your_chat_id
BOT_OWNER_IDS=123456789
ENCRYPTION_KEY=your_64_char_hex_key
```

### Credential Storage

**v1.x**: Credentials stored in plaintext JSON
**v2.0**: Credentials encrypted with AES-256-GCM

### Project Structure

**v1.x**:

```
├── bot.js          # Main file
├── helper.js       # Helper functions
└── test.js         # Test file
```

**v2.0**:

```
├── src/
│   ├── types/      # Type definitions
│   ├── errors/     # Custom errors
│   ├── utils/      # Utilities
│   ├── config/     # Configuration
│   ├── services/   # Services
│   ├── core/       # Core modules
│   ├── handlers/   # Command handlers
│   └── middleware/ # Middleware
├── dist/           # Compiled JS
└── build/          # Binary output
```

## Migration Steps

### Step 1: Backup Your Data

Before migrating, backup your existing configuration:

```bash
# Backup servers file
cp /path/to/servers.json ~/servers.json.backup

# Note your current settings
# - Bot token
# - Chat ID
# - Owner IDs
# - Private key path
```

### Step 2: Install v2.0

#### Option A: From Binary (Recommended)

```bash
# Download the latest release
cd /tmp
wget https://github.com/user/telegram-ssh-bot/releases/download/v2.0.0/telegram-ssh-bot-linux-x64

# Make executable
chmod +x telegram-ssh-bot-linux-x64

# Run installer
./deploy/install.sh
```

#### Option B: From Source

```bash
# Clone repository
git clone https://github.com/user/telegram-ssh-bot.git
cd telegram-ssh-bot

# Install dependencies
npm install

# Build
npm run build:binary

# Install
./deploy/install.sh
```

### Step 3: Generate Encryption Key

Generate a secure encryption key for credential storage:

```bash
openssl rand -hex 32
```

Example output: `a1b2c3d4e5f6...` (64 characters)

**Important**: Save this key securely! You cannot recover encrypted credentials without it.

### Step 4: Create Configuration File

Create the `.env` configuration file:

```bash
# Create config directory
mkdir -p ~/.config/telegram-ssh-bot

# Create .env file
nano ~/.config/telegram-ssh-bot/.env
```

Add your configuration:

```bash
# Required
BOT_TOKEN=your_telegram_bot_token
BOT_CHAT_ID=your_chat_id
BOT_OWNER_IDS=123456789,987654321
ENCRYPTION_KEY=your_64_char_hex_key

# Optional
LOG_LEVEL=info
SSH_COMMAND_TIMEOUT=30000
BACKUP_INTERVAL=3600000
MAX_CONNECTIONS=10
```

### Step 5: Migrate Servers

Since v2.0 uses encrypted storage, you need to re-add your servers:

1. **Start the bot**:

   ```bash
   ./deploy/manage.sh start
   ```

2. **Add each server** using the `/add` command:

   ```
   /add
   ```

   Then provide server details in the format:

   ```
   host:port:username:password
   ```

   Or with private key:

   ```
   host:port:username::/path/to/key:keypass
   ```

3. **Verify servers** with `/list`

### Step 6: Verify Migration

1. **Check bot status**:

   ```bash
   ./deploy/manage.sh status
   ```

2. **Test basic commands**:
   - `/start` - Should show welcome message
   - `/list` - Should show your servers
   - `/ssh 1` - Should connect to first server
   - `ls -la` - Should execute command
   - `/exit` - Should disconnect

3. **Check logs**:
   ```bash
   ./deploy/manage.sh logs
   ```

## Configuration Mapping

| v1.x CLI Argument   | v2.0 Environment Variable      |
| ------------------- | ------------------------------ |
| `--bot_token`       | `BOT_TOKEN`                    |
| `--chat_id`         | `BOT_CHAT_ID`                  |
| `--owner_ids`       | `BOT_OWNER_IDS`                |
| `--path_privatekey` | Not needed (stored per-server) |
| `--servers_file`    | Not needed (auto-managed)      |

## New Features in v2.0

### Security Features

- **Credential Encryption**: All credentials encrypted at rest
- **Rate Limiting**: Prevents command abuse
- **Input Validation**: Sanitizes all user inputs
- **Command Injection Prevention**: Safe command execution

### Reliability Features

- **Connection Pooling**: Reuses SSH connections
- **Automatic Reconnection**: Recovers from connection drops
- **Graceful Shutdown**: Clean process termination
- **Health Monitoring**: System health checks

### Operational Features

- **Structured Logging**: JSON-formatted logs
- **Automatic Backups**: Periodic data backups
- **Admin Notifications**: Alerts for important events
- **Systemd Service**: Proper process management

## Troubleshooting

### "Configuration Error: Missing BOT_TOKEN"

The `.env` file is not found or missing required variables.

**Solution**: Ensure `.env` file exists at `~/.config/telegram-ssh-bot/.env` with all required variables.

### "Encryption Error: Invalid key"

The encryption key is not a valid 64-character hex string.

**Solution**: Generate a new key with `openssl rand -hex 32`.

### "Cannot connect to server"

SSH connection issues.

**Solutions**:

1. Verify server is reachable: `ping server.com`
2. Verify SSH port is open: `nc -zv server.com 22`
3. Check credentials are correct
4. Check private key permissions: `chmod 600 ~/.ssh/id_rsa`

### "Permission denied"

File permission issues.

**Solution**: Ensure proper permissions:

```bash
chmod 700 ~/.config/telegram-ssh-bot
chmod 600 ~/.config/telegram-ssh-bot/.env
```

### "Service failed to start"

Systemd service issues.

**Solution**: Check service logs:

```bash
./deploy/manage.sh logs
# Or directly:
journalctl --user -u telegram-ssh-bot -f
```

## Rollback

If you need to rollback to v1.x:

1. **Stop v2.0 service**:

   ```bash
   ./deploy/manage.sh stop
   ./deploy/uninstall.sh
   ```

2. **Restore v1.x**:
   ```bash
   # Use your backup servers.json
   node bot.js --bot_token "..." --chat_id "..." ...
   ```

## Getting Help

If you encounter issues:

1. Check the [CHANGELOG.md](../CHANGELOG.md) for known issues
2. Check logs: `./deploy/manage.sh logs`
3. Open an issue on GitHub with:
   - Error message
   - Log output
   - Steps to reproduce

## Summary

| Step | Action                      |
| ---- | --------------------------- |
| 1    | Backup existing data        |
| 2    | Install v2.0                |
| 3    | Generate encryption key     |
| 4    | Create `.env` configuration |
| 5    | Re-add servers              |
| 6    | Verify migration            |
