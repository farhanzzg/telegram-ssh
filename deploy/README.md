# Deployment Guide

## Systemd User Service Installation

### Prerequisites

- Linux system with systemd
- Built binary at `build/telegram-ssh-bot`

### Quick Install

```bash
./deploy/install.sh
```

### Manual Installation

1. Copy binary:

   ```bash
   mkdir -p ~/.local/bin
   cp build/telegram-ssh-bot ~/.local/bin/
   chmod +x ~/.local/bin/telegram-ssh-bot
   ```

2. Create config directory:

   ```bash
   mkdir -p ~/.config/telegram-ssh-bot
   cp deploy/.env.example ~/.config/telegram-ssh-bot/.env
   # Edit .env with your credentials
   ```

3. Install service:

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

### Service Management

| Command                      | Description        |
| ---------------------------- | ------------------ |
| `./deploy/manage.sh start`   | Start service      |
| `./deploy/manage.sh stop`    | Stop service       |
| `./deploy/manage.sh restart` | Restart service    |
| `./deploy/manage.sh status`  | Show status        |
| `./deploy/manage.sh logs`    | Follow logs        |
| `./deploy/manage.sh enable`  | Enable auto-start  |
| `./deploy/manage.sh disable` | Disable auto-start |

### Uninstallation

```bash
./deploy/uninstall.sh
```

## Configuration

Edit `~/.config/telegram-ssh-bot/.env` to configure:

- `BOT_TOKEN` - Telegram bot token from @BotFather
- `BOT_CHAT_ID` - Primary chat ID for notifications
- `BOT_OWNER_IDS` - Comma-separated list of authorized user IDs
- `ENCRYPTION_KEY` - 64-character hex key for credential encryption
