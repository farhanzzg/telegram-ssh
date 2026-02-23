#!/usr/bin/env node
/**
 * Telegram SSH Bot - Entry Point
 *
 * A secure Telegram bot for managing SSH connections
 *
 * @version 2.0.0
 */

import "dotenv/config";

import {
  ConfigReloader,
  loadConfig,
  validateOwnerIds,
} from "./config/index.js";
import { Bot, ConnectionPool, SSHClient, ServerManager } from "./core/index.js";
import { HealthHandler } from "./handlers/HealthHandler.js";
import {
  AddServerHandler,
  CurrentServerHandler,
  ExitServerHandler,
  HelpHandler,
  ListServerHandler,
  RemoveServerHandler,
  SSHCommandHandler,
  SSHServerHandler,
  StartHandler,
} from "./handlers/index.js";
import { AuthMiddleware, RateLimitMiddleware } from "./middleware/index.js";
import {
  BackupService,
  CryptoService,
  HealthService,
  LoggingService,
  MonitoringService,
  NotificationService,
  RateLimiter,
  ValidationService,
} from "./services/index.js";
import type { AppConfig } from "./types/index.js";

/**
 * Application state
 */
type AppState =
  | "idle"
  | "initializing"
  | "running"
  | "shutting_down"
  | "stopped";

/**
 * Graceful shutdown options
 */
interface ShutdownOptions {
  reason: string;
  timeout: number;
  notifyAdmin: boolean;
}

/**
 * Application class with enhanced graceful shutdown
 */
class Application {
  private config!: AppConfig;
  private configReloader!: ConfigReloader;
  private logger!: LoggingService;
  private cryptoService!: CryptoService;
  private validationService!: ValidationService;
  private rateLimiter!: RateLimiter;
  private sshClient!: SSHClient;
  private connectionPool!: ConnectionPool;
  private serverManager!: ServerManager;
  private bot!: Bot;
  private healthService!: HealthService;
  private monitoringService!: MonitoringService;
  private backupService!: BackupService;
  private notificationService!: NotificationService;

  private state: AppState = "idle";
  private readonly startTime: Date;
  private shutdownTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this.state !== "idle") {
      throw new Error(`Cannot initialize from state: ${this.state}`);
    }

    this.state = "initializing";

    try {
      // Load configuration
      this.config = await loadConfig();
      validateOwnerIds(this.config);

      // Initialize config reloader for hot reload
      this.configReloader = new ConfigReloader(this.config);
      this.setupConfigReload();

      // Initialize services
      this.logger = new LoggingService(this.config.logging);
      this.cryptoService = new CryptoService(
        this.config.security.encryptionKey,
      );
      this.validationService = new ValidationService({
        allowedCommands: this.config.security.allowedCommands,
        blockedCommands: this.config.security.blockedCommands,
      });
      this.rateLimiter = new RateLimiter(this.config.security.rateLimit);
      this.rateLimiter.startAutoCleanup();

      // Initialize health service
      this.healthService = new HealthService({
        version: "2.0.0",
        startTime: this.startTime,
      });

      // Initialize notification service
      this.notificationService = new NotificationService(
        {
          enabled: true,
          notifyOnStartup: true,
          notifyOnShutdown: true,
          notifyOnErrors: true,
          notifyOnSecurity: true,
          adminChatId: this.config.telegram.chatId,
        },
        this.logger,
      );

      // Initialize backup service
      this.backupService = new BackupService(
        {
          enabled: this.config.backup.enabled,
          backupDir: "./backups",
          maxBackups: this.config.backup.maxCount,
          backupInterval: this.config.backup.intervalMs,
          backupBeforeWrite: true,
        },
        this.logger,
      );

      await this.backupService.initialize();

      // Initialize monitoring service
      this.monitoringService = new MonitoringService(
        {
          enabled: this.config.monitoring.enabled,
          checkInterval: this.config.monitoring.intervalMs,
          timeout: 10000,
          alertThreshold: 3,
          cooldownPeriod: 300000,
        },
        this.logger,
      );

      this.setupMonitoring();

      // Initialize core components
      this.sshClient = new SSHClient({
        connectionTimeout: this.config.ssh.connectionTimeout,
        commandTimeout: this.config.ssh.commandTimeout,
      });

      // Initialize connection pool
      this.connectionPool = new ConnectionPool(
        {
          maxConnections: this.config.ssh.maxConnections,
          connectionTimeout: this.config.ssh.connectionTimeout,
          commandTimeout: this.config.ssh.commandTimeout,
          idleTimeout: 300000, // 5 minutes
          healthCheckInterval: 60000, // 1 minute
          maxHealthCheckFailures: 3,
        },
        this.logger,
      );

      await this.connectionPool.initialize();

      this.serverManager = new ServerManager(
        this.config.storage.serversFile,
        this.cryptoService,
        this.logger,
      );

      // Initialize server manager
      await this.serverManager.initialize();

      // Initialize bot
      this.bot = new Bot(
        {
          token: this.config.telegram.token,
          ownerIds: this.config.telegram.ownerIds,
          polling: this.config.telegram.polling,
        },
        this.logger,
      );

      // Set bot for notification service
      this.notificationService.setBot(this.bot);

      // Setup middleware
      this.setupMiddleware();

      // Register handlers
      this.registerHandlers();

      // Update health service
      this.healthService.setBotHealth(true);
      this.healthService.setStorageHealth(true);

      this.state = "running";

      this.logger.info("Application initialized", {
        ownerCount: this.config.telegram.ownerIds.length,
        serversFile: this.config.storage.serversFile,
      });
    } catch (error) {
      this.state = "idle";
      throw error;
    }
  }

  /**
   * Setup configuration hot reload
   */
  private setupConfigReload(): void {
    this.configReloader.on("reload", (event) => {
      this.logger.info("Configuration reloaded", {
        changedKeys: event.changedKeys,
      });
      this.notificationService.notifyConfigReloaded(true);
    });

    this.configReloader.on("error", (error: Error) => {
      this.logger.error("Configuration reload failed", error);
      this.notificationService.notifyConfigReloaded(false);
    });

    this.configReloader.startWatching();
  }

  /**
   * Setup monitoring service
   */
  private setupMonitoring(): void {
    this.monitoringService.on(
      "alert:triggered",
      (payload: {
        server: import("./types/index.js").Server;
        status: import("./services/MonitoringService.js").ServerMonitorStatus;
      }) => {
        this.logger.warn("Monitoring alert triggered", {
          serverId: payload.server.id,
          status: payload.status,
        });
        this.notificationService.notifyConnectionLost(
          payload.server,
          payload.status.error,
        );
      },
    );

    this.monitoringService.on(
      "server:recovered",
      (payload: {
        server: import("./types/index.js").Server;
        status: import("./services/MonitoringService.js").ServerMonitorStatus;
      }) => {
        this.logger.info("Server recovered", {
          serverId: payload.server.id,
        });
        this.notificationService.notifyConnectionRestored(payload.server);
      },
    );
  }

  /**
   * Setup middleware stack
   */
  private setupMiddleware(): void {
    // Auth middleware - only allow authorized users
    const authMiddleware = new AuthMiddleware(
      this.config.telegram.ownerIds,
      this.logger,
    );
    this.bot.use(authMiddleware);

    // Rate limiting middleware
    const rateLimitMiddleware = new RateLimitMiddleware(this.rateLimiter);
    this.bot.use(rateLimitMiddleware);

    this.logger.debug("Middleware configured");
  }

  /**
   * Register command handlers
   */
  private registerHandlers(): void {
    // Server management handlers
    this.bot.registerCommand(
      new AddServerHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    this.bot.registerCommand(
      new RemoveServerHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    this.bot.registerCommand(
      new ListServerHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    this.bot.registerCommand(
      new SSHServerHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    this.bot.registerCommand(
      new ExitServerHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    this.bot.registerCommand(
      new CurrentServerHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    // SSH command handler (for non-command messages)
    this.bot.registerCommand(
      new SSHCommandHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
        this.validationService,
      ),
    );

    // Help handlers
    this.bot.registerCommand(
      new HelpHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    this.bot.registerCommand(
      new StartHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
      ),
    );

    // Health handler
    this.bot.registerCommand(
      new HealthHandler(
        this.serverManager,
        this.sshClient,
        this.bot,
        this.logger,
        this.healthService,
      ),
    );

    this.logger.debug("Handlers registered");
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (this.state !== "running") {
      throw new Error(`Cannot start from state: ${this.state}`);
    }

    await this.bot.start();

    // Send startup notification
    await this.notificationService.notifyStartup("2.0.0");

    this.logger.info("Bot started successfully");
  }

  /**
   * Stop the application gracefully
   */
  async stop(options?: Partial<ShutdownOptions>): Promise<void> {
    const opts: ShutdownOptions = {
      reason: options?.reason ?? "Manual shutdown",
      timeout: options?.timeout ?? 30000, // 30 seconds default
      notifyAdmin: options?.notifyAdmin ?? true,
    };

    if (this.isShuttingDown) {
      this.logger.warn("Shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    this.state = "shutting_down";

    this.logger.info("Starting graceful shutdown", { reason: opts.reason });

    // Set timeout for forced shutdown
    this.shutdownTimeout = setTimeout(() => {
      this.logger.error("Graceful shutdown timeout exceeded, forcing exit");
      process.exit(1);
    }, opts.timeout);

    try {
      // Notify admin about shutdown
      if (opts.notifyAdmin) {
        await this.notificationService.notifyShutdown(opts.reason);
      }

      // Stop accepting new requests
      this.healthService.setBotHealth(false);

      // Stop monitoring
      this.monitoringService.stop();

      // Stop rate limiter auto cleanup
      this.rateLimiter.stopAutoCleanup();

      // Stop config watcher
      this.configReloader.stopWatching();

      // Disconnect SSH client
      if (this.sshClient.isConnected()) {
        this.logger.info("Disconnecting SSH client");
        await this.sshClient.disconnect();
      }

      // Drain connection pool
      this.logger.info("Draining connection pool");
      await this.connectionPool.drain();

      // Stop backup service
      this.backupService.stop();

      // Stop bot
      this.logger.info("Stopping bot");
      await this.bot.stop();

      // Clear shutdown timeout
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
        this.shutdownTimeout = null;
      }

      this.state = "stopped";
      this.logger.info("Application stopped gracefully");
    } catch (error) {
      this.logger.error("Error during shutdown", error as Error);
      throw error;
    }
  }

  /**
   * Get application state
   */
  getState(): AppState {
    return this.state;
  }

  /**
   * Get health service
   */
  getHealthService(): HealthService {
    return this.healthService;
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const app = new Application();

  // Track if we're already shutting down
  let isShuttingDown = false;

  /**
   * Handle shutdown signals gracefully
   */
  const handleShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      console.log(`\nAlready shutting down, please wait...`);
      return;
    }

    isShuttingDown = true;
    console.log(`\nReceived ${signal}, initiating graceful shutdown...`);

    try {
      await app.stop({ reason: `Received ${signal}` });
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGHUP", () => handleShutdown("SIGHUP"));

  // Handle uncaught exceptions
  process.on("uncaughtException", async (error) => {
    console.error("Uncaught exception:", error);
    try {
      await handleShutdown("uncaughtException");
    } catch (e) {
      console.error("Error during shutdown:", e);
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
  });

  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

// Run the application
main();
