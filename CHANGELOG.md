# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.0.0]: https://github.com/user/telegram-ssh-bot/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/user/telegram-ssh-bot/releases/tag/v1.0.0
