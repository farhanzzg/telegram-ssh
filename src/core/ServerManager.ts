/**
 * Server Manager
 * Provides CRUD operations for server configurations
 */

import {
  FileNotFoundError,
  InvalidServerConfigError,
} from "../errors/index.js";
import { CryptoService } from "../services/CryptoService.js";
import { LoggingService } from "../services/LoggingService.js";
import { ValidationService } from "../services/ValidationService.js";
import type { Server, ServerConfig, ServerStorage } from "../types/index.js";
import { fileExists, readJsonFile, writeJsonFile } from "../utils/fileUtils.js";

/**
 * Server Manager for handling server configurations
 */
export class ServerManager {
  private servers: Server[] = [];
  private currentServer: Server | null = null;
  private readonly storageFile: string;
  private readonly cryptoService: CryptoService;
  private readonly validationService: ValidationService;
  private readonly logger: LoggingService;

  constructor(
    storageFile: string,
    cryptoService: CryptoService,
    logger: LoggingService,
  ) {
    this.storageFile = storageFile;
    this.cryptoService = cryptoService;
    this.validationService = new ValidationService();
    this.logger = logger;
  }

  /**
   * Initialize server manager and load servers from storage
   */
  async initialize(): Promise<void> {
    await this.load();
  }

  /**
   * Add a new server
   */
  async add(config: ServerConfig): Promise<Server> {
    // Validate config
    const validation = this.validationService.validateServerConfig(config);
    if (!validation.valid || !validation.data) {
      throw new InvalidServerConfigError(
        validation.error ?? "Invalid server configuration",
      );
    }

    const validConfig = validation.data;

    // Create server object
    const now = new Date();
    const server: Server = {
      id: this.generateId(),
      host: validConfig.host,
      port: validConfig.port ?? 22,
      username: validConfig.username,
      note: validConfig.note,
      createdAt: now,
      updatedAt: now,
      auth: {
        type: validConfig.privateKeyPath ? "privateKey" : "password",
      },
    };

    // Encrypt and store credentials
    if (validConfig.password) {
      server.auth.password = this.cryptoService.encrypt(validConfig.password);
    }

    if (validConfig.privateKeyPath) {
      // Store path reference (actual key is read at connection time)
      server.auth.privateKey = this.cryptoService.encrypt(
        validConfig.privateKeyPath,
      );
    }

    if (validConfig.keyPassphrase) {
      server.auth.passphrase = this.cryptoService.encrypt(
        validConfig.keyPassphrase,
      );
    }

    // Add to list and save
    this.servers.push(server);
    await this.save();

    this.logger.info("Server added", {
      serverId: server.id,
      host: server.host,
    });

    return server;
  }

  /**
   * Remove a server by ID
   */
  async remove(id: string): Promise<void> {
    const index = this.servers.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new FileNotFoundError(`Server with ID ${id}`);
    }

    const removed = this.servers.splice(index, 1)[0];
    if (!removed) {
      throw new FileNotFoundError(`Server with ID ${id}`);
    }

    // Clear current server if it was removed
    if (this.currentServer?.id === id) {
      this.currentServer = null;
    }

    await this.save();
    this.logger.info("Server removed", { serverId: id, host: removed.host });
  }

  /**
   * Remove a server by index (1-based for user friendliness)
   */
  async removeByIndex(index: number): Promise<void> {
    // BUG-003 FIX: Use parseInt semantics, but index is already a number here
    // The index is 1-based from user input
    const arrayIndex = index - 1;

    if (arrayIndex < 0 || arrayIndex >= this.servers.length) {
      throw new FileNotFoundError(`Server at index ${index}`);
    }

    const server = this.servers[arrayIndex];
    if (server) {
      await this.remove(server.id);
    }
  }

  /**
   * List all servers
   */
  async list(): Promise<Server[]> {
    return [...this.servers];
  }

  /**
   * Get a server by ID
   */
  async get(id: string): Promise<Server | null> {
    return this.servers.find((s) => s.id === id) ?? null;
  }

  /**
   * Get a server by index (1-based)
   */
  async getByIndex(index: number): Promise<Server | null> {
    const arrayIndex = index - 1;
    if (arrayIndex < 0 || arrayIndex >= this.servers.length) {
      return null;
    }
    return this.servers[arrayIndex] ?? null;
  }

  /**
   * Get current connected server
   */
  getCurrent(): Server | null {
    return this.currentServer;
  }

  /**
   * Set current server
   */
  setCurrent(server: Server): void {
    this.currentServer = server;
    this.logger.info("Current server set", {
      serverId: server.id,
      host: server.host,
    });
  }

  /**
   * Clear current server
   */
  clearCurrent(): void {
    this.currentServer = null;
    this.logger.info("Current server cleared");
  }

  /**
   * Get decrypted credentials for a server
   */
  getDecryptedCredentials(server: Server): {
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
  } {
    const credentials: {
      password?: string;
      privateKeyPath?: string;
      passphrase?: string;
    } = {};

    if (server.auth.password) {
      credentials.password = this.cryptoService.decrypt(server.auth.password);
    }

    if (server.auth.privateKey) {
      credentials.privateKeyPath = this.cryptoService.decrypt(
        server.auth.privateKey,
      );
    }

    if (server.auth.passphrase) {
      credentials.passphrase = this.cryptoService.decrypt(
        server.auth.passphrase,
      );
    }

    return credentials;
  }

  /**
   * Load servers from storage
   */
  private async load(): Promise<void> {
    try {
      const exists = await fileExists(this.storageFile);
      if (!exists) {
        this.servers = [];
        return;
      }

      const storage = await readJsonFile<ServerStorage>(this.storageFile);
      this.servers = storage.servers ?? [];

      this.logger.info("Servers loaded", { count: this.servers.length });
    } catch (error) {
      this.logger.error(
        "Failed to load servers",
        error instanceof Error ? error : new Error(String(error)),
      );
      this.servers = [];
    }
  }

  /**
   * Save servers to storage
   */
  private async save(): Promise<void> {
    const storage: ServerStorage = {
      version: 2,
      encryptionVersion: 1,
      servers: this.servers,
    };

    await writeJsonFile(this.storageFile, storage);
    this.logger.debug("Servers saved", { count: this.servers.length });
  }

  /**
   * Generate a unique server ID
   */
  private generateId(): string {
    return `srv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
