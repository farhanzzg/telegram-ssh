/**
 * Backup Service
 * Provides automatic backup and recovery for server configurations
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { BaseError } from "../errors/BaseError.js";
import { FileReadError, FileWriteError } from "../errors/index.js";
import type { LogContext, ServerStorage } from "../types/index.js";
import { ErrorCode } from "../types/index.js";
import { LoggingService } from "./LoggingService.js";

/**
 * Backup metadata
 */
interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: Date;
  size: number;
  version: number;
  checksum: string;
  reason: "automatic" | "manual" | "pre-migration";
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  enabled: boolean;
  backupDir: string;
  maxBackups: number;
  backupInterval: number;
  backupBeforeWrite: boolean;
}

/**
 * Backup result
 */
export interface BackupResult {
  success: boolean;
  backupId?: string;
  filename?: string;
  error?: string;
}

/**
 * Custom backup error
 */
class BackupError extends BaseError {
  constructor(message: string, cause?: Error) {
    super(ErrorCode.FILE_WRITE_ERROR, message, { cause });
  }
}

/**
 * Service for managing backups
 */
export class BackupService {
  private readonly logger: LoggingService;
  private readonly config: BackupConfig;
  private readonly backups: BackupMetadata[] = [];
  private backupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<BackupConfig>, logger: LoggingService) {
    this.config = {
      enabled: config.enabled ?? true,
      backupDir: config.backupDir ?? "./backups",
      maxBackups: config.maxBackups ?? 10,
      backupInterval: config.backupInterval ?? 86400000, // 24 hours
      backupBeforeWrite: config.backupBeforeWrite ?? true,
    };
    this.logger = logger;
  }

  /**
   * Initialize the backup service
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info("Backup service disabled");
      return;
    }

    try {
      // Ensure backup directory exists
      await fs.mkdir(this.config.backupDir, { recursive: true });

      // Load existing backup metadata
      await this.loadBackupMetadata();

      // Start automatic backup timer
      this.startBackupTimer();

      this.logger.info("Backup service initialized", {
        backupDir: this.config.backupDir,
        maxBackups: this.config.maxBackups,
        existingBackups: this.backups.length,
      });
    } catch (error) {
      this.logger.error("Failed to initialize backup service", error as Error);
      throw new BackupError(
        "Failed to initialize backup service",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Create a backup
   */
  async createBackup(
    data: ServerStorage,
    reason: "automatic" | "manual" | "pre-migration" = "manual",
  ): Promise<BackupResult> {
    if (!this.config.enabled) {
      return { success: false, error: "Backup service is disabled" };
    }

    try {
      const backupId = this.generateBackupId();
      const filename = `servers_${backupId}.json`;
      const filepath = path.join(this.config.backupDir, filename);

      // Serialize data
      const content = JSON.stringify(data, null, 2);
      const checksum = this.calculateChecksum(content);

      // Write backup file
      await fs.writeFile(filepath, content, "utf-8");

      // Get file size
      const stats = await fs.stat(filepath);

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        filename,
        createdAt: new Date(),
        size: stats.size,
        version: data.version,
        checksum,
        reason,
      };

      this.backups.push(metadata);
      await this.saveBackupMetadata();

      // Rotate old backups
      await this.rotateBackups();

      this.logger.info("Backup created", {
        backupId,
        filename,
        size: stats.size,
        reason,
      });

      return { success: true, backupId, filename };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to create backup", error as Error);
      return { success: false, error: message };
    }
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupId: string): Promise<ServerStorage> {
    const metadata = this.backups.find((b) => b.id === backupId);
    if (!metadata) {
      throw new BackupError(`Backup not found: ${backupId}`);
    }

    const filepath = path.join(this.config.backupDir, metadata.filename);

    try {
      const content = await fs.readFile(filepath, "utf-8");

      // Verify checksum
      const checksum = this.calculateChecksum(content);
      if (checksum !== metadata.checksum) {
        throw new BackupError(
          "Backup checksum mismatch - file may be corrupted",
        );
      }

      const data = JSON.parse(content) as ServerStorage;

      this.logger.info("Backup restored", {
        backupId,
        filename: metadata.filename,
        version: metadata.version,
      });

      return data;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }
      throw new FileReadError(
        filepath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * List available backups
   */
  listBackups(): BackupMetadata[] {
    return [...this.backups].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    const index = this.backups.findIndex((b) => b.id === backupId);
    if (index === -1) {
      return false;
    }

    const metadata = this.backups[index];
    if (!metadata) {
      return false;
    }

    const filepath = path.join(this.config.backupDir, metadata.filename);

    try {
      await fs.unlink(filepath);
      this.backups.splice(index, 1);
      await this.saveBackupMetadata();

      this.logger.info("Backup deleted", { backupId });
      return true;
    } catch (error) {
      this.logger.error("Failed to delete backup", error as Error, {
        backupId,
      });
      return false;
    }
  }

  /**
   * Get latest backup
   */
  getLatestBackup(): BackupMetadata | undefined {
    if (this.backups.length === 0) {
      return undefined;
    }
    const sorted = this.listBackups();
    return sorted[0];
  }

  /**
   * Stop the backup service
   */
  stop(): void {
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = null;
    }
    this.logger.info("Backup service stopped");
  }

  /**
   * Get backup statistics
   */
  getStats(): {
    enabled: boolean;
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  } {
    const totalSize = this.backups.reduce((sum, b) => sum + b.size, 0);
    const sorted = this.listBackups();

    return {
      enabled: this.config.enabled,
      totalBackups: this.backups.length,
      totalSize,
      oldestBackup:
        sorted.length > 0
          ? (sorted[sorted.length - 1]?.createdAt ?? null)
          : null,
      newestBackup: sorted.length > 0 ? (sorted[0]?.createdAt ?? null) : null,
    };
  }

  /**
   * Get log context for backup-related logs
   */
  getLogContext(): LogContext {
    const stats = this.getStats();
    return {
      backupEnabled: stats.enabled,
      totalBackups: stats.totalBackups,
      backupSize: stats.totalSize,
    };
  }

  /**
   * Start automatic backup timer
   */
  private startBackupTimer(): void {
    if (this.config.backupInterval > 0) {
      this.backupTimer = setInterval(() => {
        this.performAutomaticBackup();
      }, this.config.backupInterval);
    }
  }

  /**
   * Perform automatic backup (emits event for caller to provide data)
   */
  private performAutomaticBackup(): void {
    this.logger.debug("Automatic backup triggered");
    // Note: In practice, this would need to be called with actual data
    // The caller should handle this event and provide the data
  }

  /**
   * Load backup metadata from disk
   */
  private async loadBackupMetadata(): Promise<void> {
    const metaFile = path.join(this.config.backupDir, "backups_meta.json");

    try {
      const content = await fs.readFile(metaFile, "utf-8");
      const data = JSON.parse(content) as BackupMetadata[];

      // Convert date strings back to Date objects
      for (const meta of data) {
        meta.createdAt = new Date(meta.createdAt);
      }

      this.backups.push(...data);
    } catch (error) {
      // File doesn't exist or is invalid - start fresh
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn("Could not load backup metadata, starting fresh", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Save backup metadata to disk
   */
  private async saveBackupMetadata(): Promise<void> {
    const metaFile = path.join(this.config.backupDir, "backups_meta.json");

    try {
      const content = JSON.stringify(this.backups, null, 2);
      await fs.writeFile(metaFile, content, "utf-8");
    } catch (error) {
      throw new FileWriteError(
        metaFile,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Rotate old backups to maintain max count
   */
  private async rotateBackups(): Promise<void> {
    if (this.backups.length <= this.config.maxBackups) {
      return;
    }

    // Sort by creation date (oldest first)
    const sorted = [...this.backups].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const toRemove = sorted.slice(
      0,
      this.backups.length - this.config.maxBackups,
    );

    for (const meta of toRemove) {
      await this.deleteBackup(meta.id);
    }

    this.logger.info("Rotated old backups", {
      removed: toRemove.length,
      remaining: this.backups.length,
    });
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  /**
   * Calculate checksum for content using SHA-256
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
