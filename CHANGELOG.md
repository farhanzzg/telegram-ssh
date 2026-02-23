# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-02-23

### Added

#### Interactive Installation Wizard

- **New installation wizard**: Automatically runs on first launch when `.env` file is missing or incomplete
- **Guided configuration setup**: Prompts for required configuration values interactively
  - `BOT_TOKEN`: Telegram bot token (required)
  - `BOT_CHAT_ID`: Telegram chat ID for notifications (required)
  - `ENCRYPTION_KEY`: Encryption key for credential storage (required, with auto-generate option)
  - `BOT_OWNER_IDS`: Optional comma-separated list of authorized user IDs
- **Auto-generate encryption key**: Option to automatically generate a secure 64-character hex encryption key
- **Configuration file creation**: Creates `.env` file at `~/.config/telegram-ssh-bot/.env`

#### New Files

- [`InstallationWizard.ts`](src/wizard/InstallationWizard.ts): Main wizard class that orchestrates the installation process
- [`prompts.ts`](src/wizard/prompts.ts): Interactive CLI prompts using the `prompts` library
- [`validators.ts`](src/wizard/validators.ts): Input validation functions for configuration values
- [`index.ts`](src/wizard/index.ts): Module exports for the wizard package

### Dependencies

- Added `prompts` (^2.4.2): Interactive CLI prompts library for user input

---

## [2.1.0] - 2026-02-23

### Added

#### Installation Improvements

- **npm/pnpm global installation support**: Install globally with `npm install -g telegram-ssh-bot` or `pnpm add -g telegram-ssh-bot`
- **Auto-generated configuration file**: `.env` file is automatically created at `~/.config/telegram-ssh-bot/.env` during installation
- **Auto-generated encryption key**: Secure 64-character hex key is automatically generated during installation
- **Post-install script**: Automatically sets up configuration for global npm/pnpm installations

#### New Environment Variables

- `SSH_DEFAULT_PORT`: Configure default SSH port for new servers (default: `22`)
- `BACKUP_ENABLED`: Enable/disable automatic backups (default: `true`)
- `BACKUP_INTERVAL_MS`: Backup interval in milliseconds (default: `3600000`)
- `BACKUP_MAX_COUNT`: Maximum number of backup files to keep (default: `10`)
- `MONITORING_ENABLED`: Enable/disable health monitoring (default: `true`)
- `MONITORING_INTERVAL_MS`: Health check interval in milliseconds (default: `300000`)
- `BOT_API_URL`: Optional custom Telegram Bot API URL for proxies/middlewares

#### Uninstall Script Options

- `-f, --force`: Non-interactive mode (skip prompts)
- `--remove-binary`: Remove binary in force mode
- `--remove-config`: Remove configuration in force mode

### Fixed

#### HIGH Severity Fixes

- Fixed command injection vulnerabilities in SSH command execution
- Fixed SSH connection race conditions
- Fixed property name mismatch (`keyPassword`/`keypass`)
- Fixed `parseFloat` to `parseInt` for index parsing
- Fixed memory leaks in SSH event listeners
- Fixed unhandled promise rejections
- Fixed missing error handling in async operations

#### MEDIUM Severity Fixes

- Fixed connection pool not properly cleaning up idle connections
- Fixed rate limiter memory leak from accumulated records
- Fixed backup service not handling write errors gracefully
- Fixed monitoring service not recovering from transient failures

#### LOW Severity Fixes

- Fixed inconsistent log formatting
- Fixed missing validation for some configuration options
- Fixed documentation typos and outdated examples
- Fixed default values not being applied consistently

### Changed

#### Configuration Structure

- Added [`BackupConfig`](src/types/Config.ts:46) interface for backup settings
- Added [`MonitoringConfig`](src/types/Config.ts:52) interface for monitoring settings
- Updated [`AppConfig`](src/types/Config.ts:57) to include backup and monitoring configurations
- Configuration schema now validates all new environment variables

#### Rate Limiter Improvements

- Added automatic cleanup feature via [`startAutoCleanup()`](src/services/RateLimiter.ts:35)
- Periodic cleanup removes expired rate limit records (every 5 minutes)
- Timer is unref'd to prevent keeping process alive
- [`stopAutoCleanup()`](src/services/RateLimiter.ts:54) method for graceful shutdown

#### Error Handling Improvements

- Improved error handling patterns across all services
- Better error context and logging
- More descriptive error messages

### Security

- Encryption key is now auto-generated with cryptographically secure random bytes
- Configuration file permissions are set appropriately during installation
- Rate limiter cleanup prevents potential memory exhaustion

---

## [2.0.0] - 2024-02-23

### Breaking Changes

- Complete TypeScript migration from JavaScript
- New configuration format (`.env` based, replacing CLI arguments)
- Encrypted credential storage (migration required from v1.x)
- Modular architecture with separate modules for each component
- New command structure with improved handlers

### Added

#### TypeScript & Build

- TypeScript strict mode configuration
- Type definitions for all modules
- Single binary executable support via `pkg`
- Cross-platform build targets (Linux, macOS, Windows)
- Makefile for build automation

#### Architecture

- Modular architecture with clear separation of concerns
- Service layer pattern implementation
- Custom error classes hierarchy
- Middleware pattern for auth and rate limiting
- Handler pattern for command processing

#### Security

- AES-256-GCM credential encryption via [`CryptoService`](src/services/CryptoService.ts)
- Input validation and sanitization via [`ValidationService`](src/services/ValidationService.ts)
- Command injection prevention
- Path traversal protection
- Rate limiting implementation via [`RateLimiter`](src/services/RateLimiter.ts)
- Owner-only authorization via [`AuthMiddleware`](src/middleware/AuthMiddleware.ts)

#### Reliability

- SSH connection pooling via [`ConnectionPool`](src/core/ConnectionPool.ts)
- Automatic reconnection on connection failure
- Graceful shutdown handling
- Health monitoring via [`HealthService`](src/services/HealthService.ts)
- Structured logging via [`LoggingService`](src/services/LoggingService.ts)

#### Operations

- Automatic backups via [`BackupService`](src/services/BackupService.ts)
- Admin notifications via [`NotificationService`](src/services/NotificationService.ts)
- Systemd user service support
- Process management scripts
- Health check endpoint

#### Configuration

- Environment-based configuration
- Joi schema validation for configuration
- Default values for optional settings
- Configuration documentation

### Changed

- Migrated from CLI arguments to environment variables
- Improved error handling with custom error classes
- Enhanced logging with structured output
- Better SSH connection management
- Improved command parsing and validation

### Fixed

- Command injection vulnerabilities in SSH command execution
- SSH connection race conditions
- Property name mismatch (`keyPassword`/`keypass`)
- `parseFloat` to `parseInt` for index parsing
- Memory leaks in SSH event listeners
- Unhandled promise rejections
- Missing error handling in async operations

### Security

- Implemented credential encryption at rest
- Added input validation for all user inputs
- Added rate limiting to prevent abuse
- Secured command execution with sanitization
- Protected against path traversal attacks

### Removed

- Deprecated JavaScript source files (`bot.js`, `helper.js`, `test.js`)
- CLI argument parsing (replaced with environment variables)
- Insecure plaintext credential storage
- Unused dotenv import

### Migration Guide

If upgrading from v1.x:

1. **Backup your data**

   ```bash
   cp ~/.ssh/servers.json ~/servers.json.backup
   ```

2. **Generate encryption key**

   ```bash
   openssl rand -hex 32
   ```

3. **Create `.env` file**

   ```bash
   mkdir -p ~/.config/telegram-ssh-bot
   nano ~/.config/telegram-ssh-bot/.env
   ```

   Add configuration:

   ```bash
   BOT_TOKEN=your_token
   BOT_CHAT_ID=your_chat_id
   BOT_OWNER_IDS=your_user_id
   ENCRYPTION_KEY=generated_key
   ```

4. **Re-add servers** - Credentials must be re-added as they are now encrypted

---

## [1.0.0] - Initial Release

### Added

- Basic SSH management via Telegram
- Server add/remove/list functionality
- SSH connection and command execution
- Private key authentication support
- Multi-server support
- Basic command structure

[2.1.0]: https://github.com/farhanzzg/telegram-ssh/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/farhanzzg/telegram-ssh/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/farhanzzg/telegram-ssh/releases/tag/v1.0.0
