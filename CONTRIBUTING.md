# Contributing to Telegram SSH Bot

Thank you for your interest in contributing to the Telegram SSH Bot project! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

Be respectful and inclusive. Treat all contributors with respect, regardless of experience level, gender, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

## Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Git
- A Telegram bot token (for testing)

### Getting Started

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/telegram-ssh-bot.git
   cd telegram-ssh-bot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment**

   ```bash
   cp deploy/.env.example .env
   # Edit .env with your configuration
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

### Development Commands

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run build`        | Compile TypeScript to JavaScript |
| `npm run dev`          | Watch mode for development       |
| `npm run start`        | Run compiled application         |
| `npm run clean`        | Remove compiled files            |
| `npm run build:binary` | Build binary executable          |

## Project Structure

```
telegram-ssh-bot/
├── src/
│   ├── types/           # TypeScript type definitions
│   │   ├── Bot.ts       # Bot-related types
│   │   ├── Config.ts    # Configuration types
│   │   ├── Errors.ts    # Error types
│   │   ├── Server.ts    # Server types
│   │   └── SSH.ts       # SSH types
│   ├── errors/          # Custom error classes
│   │   ├── BaseError.ts
│   │   ├── AuthError.ts
│   │   ├── ConfigurationError.ts
│   │   ├── PoolError.ts
│   │   ├── SSHError.ts
│   │   ├── StorageError.ts
│   │   └── ValidationError.ts
│   ├── utils/           # Utility functions
│   │   ├── commandUtils.ts
│   │   ├── fileUtils.ts
│   │   └── pathUtils.ts
│   ├── config/          # Configuration module
│   │   ├── index.ts     # Configuration loader
│   │   └── schema.ts    # Joi validation schema
│   ├── services/        # Business services
│   │   ├── BackupService.ts
│   │   ├── CryptoService.ts
│   │   ├── HealthService.ts
│   │   ├── LoggingService.ts
│   │   ├── MonitoringService.ts
│   │   ├── NotificationService.ts
│   │   ├── RateLimiter.ts
│   │   └── ValidationService.ts
│   ├── core/            # Core modules
│   │   ├── Bot.ts       # Telegram bot
│   │   ├── ConnectionPool.ts
│   │   ├── ServerManager.ts
│   │   └── SSHClient.ts
│   ├── handlers/        # Command handlers
│   │   ├── BaseHandler.ts
│   │   ├── CommandHandler.ts
│   │   ├── HealthHandler.ts
│   │   ├── HelpHandler.ts
│   │   └── ServerHandler.ts
│   ├── middleware/      # Middleware
│   │   ├── AuthMiddleware.ts
│   │   └── RateLimitMiddleware.ts
│   └── index.ts         # Entry point
├── docs/                # Documentation
├── deploy/              # Deployment files
├── scripts/             # Build scripts
└── tests/               # Test files (if applicable)
```

## Code Style

### TypeScript Guidelines

- **Strict mode**: All code must pass TypeScript strict mode checks
- **No `any` types**: Use proper type definitions or `unknown` with type guards
- **Async/await**: Use async/await instead of raw Promises or callbacks
- **Explicit return types**: Always declare return types for functions

```typescript
// Good
async function connect(id: number): Promise<SSHConnection> {
  // ...
}

// Bad
async function connect(id) {
  // ...
}
```

### Error Handling

- Use custom error classes from [`src/errors/`](src/errors/)
- Always handle errors appropriately
- Log errors via [`LoggingService`](src/services/LoggingService.ts)

```typescript
// Good
import { SSHError } from "../errors";

try {
  await client.connect();
} catch (error) {
  throw new SSHError("Connection failed", error);
}

// Bad
try {
  await client.connect();
} catch (error) {
  throw error; // Unhandled generic error
}
```

### Logging

- Use [`LoggingService`](src/services/LoggingService.ts) for all logging
- Include context in log messages
- Use appropriate log levels

```typescript
// Good
import { LoggingService } from "../services";

const logger = new LoggingService();
logger.info("Server connected", { host, port });
logger.error("Connection failed", { error: error.message });

// Bad
console.log("Server connected");
```

### Code Organization

- One class/module per file
- Use barrel exports (`index.ts`) for each directory
- Keep functions small and focused
- Use dependency injection where appropriate

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type       | Description                   |
| ---------- | ----------------------------- |
| `feat`     | New feature                   |
| `fix`      | Bug fix                       |
| `docs`     | Documentation only            |
| `style`    | Code style (formatting, etc.) |
| `refactor` | Code refactoring              |
| `test`     | Adding or updating tests      |
| `chore`    | Maintenance tasks             |

### Examples

```
feat(ssh): add connection pooling support

- Implement ConnectionPool class
- Add max connections configuration
- Handle connection timeout

Closes #123
```

```
fix(auth): resolve rate limiter bypass issue

The rate limiter was not properly checking all requests.
This fix ensures all requests are properly rate limited.
```

## Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow code style guidelines
   - Add/update tests if applicable
   - Update documentation

3. **Test your changes**

   ```bash
   npm run build
   npm run start  # Manual testing
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

5. **Push and create PR**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **PR Requirements**
   - Clear description of changes
   - Reference to related issues
   - All CI checks passing
   - Code review approval

### PR Checklist

- [ ] Code compiles without errors
- [ ] TypeScript strict mode passes
- [ ] No `any` types used
- [ ] Error handling implemented
- [ ] Logging added where appropriate
- [ ] Documentation updated
- [ ] Commit messages follow guidelines

## Testing

### Manual Testing

1. Set up test SSH servers:

   ```bash
   docker pull takeyamajp/ubuntu-sshd
   docker run -d -p 2222:22 --name test-server -e ROOT_PASSWORD="test" takeyamajp/ubuntu-sshd
   ```

2. Run the bot and test commands:
   - `/start` - Verify bot responds
   - `/add` - Add test server
   - `/list` - Verify server appears
   - `/ssh 1` - Connect to server
   - `ls -la` - Execute command
   - `/exit` - Disconnect
   - `/rm 1` - Remove server

### Test Cases to Cover

- [ ] Bot starts successfully
- [ ] Commands work with valid input
- [ ] Errors handled for invalid input
- [ ] Rate limiting works
- [ ] Authorization blocks unauthorized users
- [ ] SSH connection succeeds/fails appropriately
- [ ] Credentials are encrypted

## Documentation

### When to Update Documentation

- Adding new features → Update README.md
- Changing configuration → Update .env.example and README.md
- Adding new modules → Update ARCHITECTURE.md
- Fixing bugs → Update CHANGELOG.md
- Changing API → Update all relevant docs

### Documentation Style

- Use clear, concise language
- Include code examples
- Keep line length under 100 characters
- Use proper Markdown formatting

## Questions?

If you have questions, feel free to:

- Open an issue for discussion
- Check existing documentation in [`docs/`](docs/)
- Review the [Architecture](docs/ARCHITECTURE.md) document

Thank you for contributing!
