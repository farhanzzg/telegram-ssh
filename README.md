# Telegram SSH Bot

A secure, production-ready Telegram bot for remote SSH server management.

## Features

- **Server Management**: Add, remove, list, and connect to SSH servers
- **Remote Command Execution**: Execute commands on connected servers via Telegram
- **Security**:
  - AES-256-GCM credential encryption
  - Input validation and command sanitization
  - Rate limiting
  - Owner-only authorization
- **Reliability**:
  - Connection pooling
  - Automatic reconnection
  - Graceful shutdown
  - Health monitoring
- **Operations**:
  - Structured logging
  - Automatic backups
  - Admin notifications
  - Systemd service support

## Quick Start

### Prerequisites

- Node.js 18+ (for npm/pnpm installation or development)
- Linux (for production deployment with systemd)

### Installation

#### Option 1: npm/pnpm Global (Recommended)

```bash
# Install globally with npm
npm install -g telegram-ssh-bot

# Or with pnpm
pnpm add -g telegram-ssh-bot

# The .env file is auto-generated at ~/.config/telegram-ssh-bot/.env
# Edit with your credentials
nano ~/.config/telegram-ssh-bot/.env

# Start the bot
telegram-ssh-bot
```

#### Option 2: Binary Installation

```bash
# Download and install
./deploy/install.sh

# The .env file is auto-generated at ~/.config/telegram-ssh-bot/.env
# Edit with your credentials
nano ~/.config/telegram-ssh-bot/.env

# Start with systemd
./deploy/manage.sh start
```

#### Option 3: From Source

```bash
# Clone and build
git clone https://github.com/farhanzzg/telegram-ssh.git
cd telegram-ssh-bot
npm install
npm run build:binary

# Install
./deploy/install.sh
```

## Configuration

The configuration file is automatically generated at `~/.config/telegram-ssh-bot/.env` during installation. The encryption key is also auto-generated for you.

```bash
# Required
BOT_TOKEN=your_telegram_bot_token
BOT_CHAT_ID=your_chat_id
BOT_OWNER_IDS=123456789,987654321
ENCRYPTION_KEY=auto_generated_64_char_hex_key

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

# Logging (Optional)
LOG_LEVEL=info
```

### Configuration Options

#### Required Variables

| Variable         | Description                                                     |
| ---------------- | --------------------------------------------------------------- |
| `BOT_TOKEN`      | Telegram bot token from [@BotFather](https://t.me/botfather)    |
| `BOT_CHAT_ID`    | Primary chat ID for notifications                               |
| `BOT_OWNER_IDS`  | Comma-separated list of authorized user IDs                     |
| `ENCRYPTION_KEY` | 64-character hex key for credential encryption (auto-generated) |

#### SSH Configuration

| Variable                       | Default         | Description                      |
| ------------------------------ | --------------- | -------------------------------- |
| `SSH_DEFAULT_PORT`             | `22`            | Default SSH port for new servers |
| `SSH_CONNECTION_TIMEOUT`       | `30000`         | Connection timeout in ms         |
| `SSH_COMMAND_TIMEOUT`          | `30000`         | Command execution timeout in ms  |
| `SSH_DEFAULT_PRIVATE_KEY_PATH` | `~/.ssh/id_rsa` | Default private key path         |

#### Rate Limiting

| Variable                  | Default | Description                        |
| ------------------------- | ------- | ---------------------------------- |
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Rate limit window in ms (1 minute) |
| `RATE_LIMIT_MAX_REQUESTS` | `100`   | Max requests per window            |

#### Backup Configuration

| Variable             | Default   | Description                    |
| -------------------- | --------- | ------------------------------ |
| `BACKUP_ENABLED`     | `true`    | Enable automatic backups       |
| `BACKUP_INTERVAL_MS` | `3600000` | Backup interval in ms (1 hour) |
| `BACKUP_MAX_COUNT`   | `10`      | Maximum backup files to keep   |

#### Monitoring Configuration

| Variable                 | Default  | Description                         |
| ------------------------ | -------- | ----------------------------------- |
| `MONITORING_ENABLED`     | `true`   | Enable health monitoring            |
| `MONITORING_INTERVAL_MS` | `300000` | Health check interval in ms (5 min) |

#### Optional Variables

| Variable      | Default | Description                                           |
| ------------- | ------- | ----------------------------------------------------- |
| `LOG_LEVEL`   | `info`  | Logging level: `error`, `warn`, `info`, `debug`       |
| `BOT_API_URL` | -       | Custom Telegram Bot API URL (for proxies/middlewares) |

### Auto-Generated Configuration

During installation, the following are automatically generated:

- **Configuration file**: `~/.config/telegram-ssh-bot/.env`
- **Encryption key**: Secure 64-character hex key (32 bytes)

If you need to regenerate the encryption key:

```bash
# Generate a secure 64-character hex key
openssl rand -hex 32
```

> **Note**: Changing the encryption key will make previously encrypted credentials unreadable. You'll need to re-add your servers after changing the key.

## Usage

### Bot Commands

| Command          | Description             |
| ---------------- | ----------------------- |
| `/start`         | Start the bot           |
| `/help`          | Show help message       |
| `/add`           | Add a new server        |
| `/rm <id>`       | Remove a server         |
| `/list`          | List all servers        |
| `/ssh <id>`      | Connect to server       |
| `/exit`          | Disconnect from server  |
| `/current`       | Show current connection |
| `/health`        | Show system health      |
| `/cmd <command>` | Execute SSH command     |

### Example Workflow

```
User: /add
Bot: Enter server details...
User: myserver.com:22:user:password
Bot: Server added with ID 1

User: /ssh 1
Bot: Connected to myserver.com

User: ls -la
Bot: [command output]

User: /exit
Bot: Disconnected from myserver.com
```

### Adding a Server

Use the `/add` command with the following format:

```
host:port:username:password
```

Or with private key:

```
host:port:username::/path/to/private/key:keypass
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

### Project Structure

```
src/
├── types/        # TypeScript interfaces
├── errors/       # Custom error classes
├── utils/        # Utility functions
├── config/       # Configuration loader
├── services/     # Business services
├── core/         # Core modules (Bot, SSH, ServerManager)
├── handlers/     # Command handlers
└── middleware/   # Auth & rate limiting
```

### Key Components

- **Bot** ([`src/core/Bot.ts`](src/core/Bot.ts)): Telegram bot initialization and command routing
- **SSHClient** ([`src/core/SSHClient.ts`](src/core/SSHClient.ts)): SSH connection management
- **ServerManager** ([`src/core/ServerManager.ts`](src/core/ServerManager.ts)): Server storage and retrieval
- **ConnectionPool** ([`src/core/ConnectionPool.ts`](src/core/ConnectionPool.ts)): SSH connection pooling
- **CryptoService** ([`src/services/CryptoService.ts`](src/services/CryptoService.ts)): Credential encryption
- **HealthService** ([`src/services/HealthService.ts`](src/services/HealthService.ts)): System health monitoring

## Development

### Build

```bash
npm run build           # Compile TypeScript
npm run build:binary    # Create binary executable
make release            # Build all platforms
```

### Development Mode

```bash
npm run dev             # Watch mode with TypeScript
```

### Testing

```bash
# Run SSH test servers
docker pull takeyamajp/ubuntu-sshd
docker run -d -p 2222:22 --name ubuntu-server02 -e ROOT_PASSWORD="my_password" takeyamajp/ubuntu-sshd
docker run -d -p 2223:22 --name ubuntu-server03 -e ROOT_PASSWORD="my_password" takeyamajp/ubuntu-sshd
```

## Deployment

### Systemd Service

The bot includes a systemd user service for production deployment:

```bash
# Install service
./deploy/install.sh

# Manage service
./deploy/manage.sh start     # Start service
./deploy/manage.sh stop      # Stop service
./deploy/manage.sh restart   # Restart service
./deploy/manage.sh status    # Check status
./deploy/manage.sh logs      # View logs
```

See [deploy/README.md](deploy/README.md) for detailed deployment instructions.

## Security

### Credential Encryption

- All server credentials are encrypted using AES-256-GCM
- Encryption key must be provided via environment variable
- Credentials are never stored in plaintext

### Input Validation

- Command sanitization prevents injection attacks
- Path traversal protection for file operations
- Rate limiting prevents abuse

### Authorization

- Only configured owner IDs can interact with the bot
- Each command is authenticated before execution

### Best Practices

1. Use a dedicated Telegram bot token
2. Restrict owner IDs to trusted users
3. Generate a strong encryption key
4. Run as a non-root user
5. Keep the `.env` file secure (readable only by owner)

## Migration from v1.x

If upgrading from the JavaScript version:

1. **Backup your data**: Export your servers.json file
2. **Generate encryption key**: `openssl rand -hex 32`
3. **Create .env file**: Use the new configuration format
4. **Re-add servers**: Credentials must be re-encrypted

See [CHANGELOG.md](CHANGELOG.md) for a complete list of changes.

## Troubleshooting

### Common Issues

**Bot not responding**

- Verify `BOT_TOKEN` is correct
- Check `BOT_OWNER_IDS` includes your Telegram user ID
- Check logs: `./deploy/manage.sh logs`

**SSH connection failed**

- Verify server credentials
- Check network connectivity
- Verify SSH service is running on target server

**Permission denied**

- Check file permissions on `.env` file
- Ensure the user running the bot has access to SSH keys

### Logs

Logs are written to:

- Console output (stdout)
- `~/.local/share/telegram-ssh-bot/logs/` (when running as service)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT

## Acknowledgments

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [ssh2](https://github.com/mscdex/ssh2)
