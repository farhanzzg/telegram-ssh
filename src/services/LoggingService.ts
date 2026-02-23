/**
 * Logging Service
 * Provides structured logging with multiple output formats, log rotation, and request tracking
 */

import { promises as fs } from "fs";
import * as path from "path";
import type { LogContext, LogEntry, LoggingConfig } from "../types/index.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Extended log entry with additional metadata
 */
interface ExtendedLogEntry extends LogEntry {
  requestId?: string;
  duration?: number;
  component?: string;
}

/**
 * Log file handle
 */
interface LogFile {
  path: string;
  size: number;
  createdAt: Date;
}

/**
 * Performance timer
 */
interface PerformanceTimer {
  startTime: number;
  label: string;
  context?: LogContext;
}

/**
 * Logging service for structured logging with rotation and request tracking
 */
export class LoggingService {
  private readonly level: LogLevel;
  private readonly format: "json" | "pretty";
  private readonly file?: string;
  private readonly maxFileSize: number;
  private readonly maxFiles: number;
  private currentLogFile: LogFile | null = null;
  private requestCounter = 0;
  private readonly performanceTimers: Map<string, PerformanceTimer> = new Map();
  private logCount = 0;
  private errorCount = 0;
  private readonly startTime: Date;

  constructor(config: LoggingConfig) {
    this.level = this.parseLevel(config.level);
    this.format = config.format;
    this.file = config.file;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB default
    this.maxFiles = 5;
    this.startTime = new Date();
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, undefined, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, undefined, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log("error", message, error, context);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, undefined, context);
  }

  /**
   * Log with request ID tracking
   */
  withRequestId(requestId: string): {
    info: (message: string, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    error: (message: string, error?: Error, context?: LogContext) => void;
    debug: (message: string, context?: LogContext) => void;
  } {
    const logWithContext = (
      level: LogLevel,
      message: string,
      error?: Error,
      context?: LogContext,
    ) => {
      this.log(level, message, error, { ...context, requestId });
    };

    return {
      info: (message: string, context?: LogContext) =>
        logWithContext("info", message, undefined, context),
      warn: (message: string, context?: LogContext) =>
        logWithContext("warn", message, undefined, context),
      error: (message: string, error?: Error, context?: LogContext) =>
        logWithContext("error", message, error, context),
      debug: (message: string, context?: LogContext) =>
        logWithContext("debug", message, undefined, context),
    };
  }

  /**
   * Generate a new request ID
   */
  generateRequestId(): string {
    this.requestCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.requestCounter.toString(36).padStart(4, "0");
    return `req_${timestamp}_${counter}`;
  }

  /**
   * Start a performance timer
   */
  startTimer(label: string, context?: LogContext): string {
    const timerId = `${label}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.performanceTimers.set(timerId, {
      startTime: Date.now(),
      label,
      context,
    });
    return timerId;
  }

  /**
   * End a performance timer and log the duration
   */
  endTimer(timerId: string, additionalContext?: LogContext): number | null {
    const timer = this.performanceTimers.get(timerId);
    if (!timer) {
      this.warn(`Timer not found: ${timerId}`);
      return null;
    }

    this.performanceTimers.delete(timerId);
    const duration = Date.now() - timer.startTime;

    this.debug(`Performance: ${timer.label}`, {
      ...timer.context,
      ...additionalContext,
      duration,
      durationMs: duration,
    });

    return duration;
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    context?: LogContext,
  ): void {
    this.log("debug", `Performance: ${operation}`, undefined, {
      ...context,
      duration,
      durationMs: duration,
      performance: true,
    });
  }

  /**
   * Log with component context
   */
  withComponent(component: string): {
    info: (message: string, context?: LogContext) => void;
    warn: (message: string, context?: LogContext) => void;
    error: (message: string, error?: Error, context?: LogContext) => void;
    debug: (message: string, context?: LogContext) => void;
  } {
    const logWithContext = (
      level: LogLevel,
      message: string,
      error?: Error,
      context?: LogContext,
    ) => {
      this.log(level, message, error, { ...context, component });
    };

    return {
      info: (message: string, context?: LogContext) =>
        logWithContext("info", message, undefined, context),
      warn: (message: string, context?: LogContext) =>
        logWithContext("warn", message, undefined, context),
      error: (message: string, error?: Error, context?: LogContext) =>
        logWithContext("error", message, error, context),
      debug: (message: string, context?: LogContext) =>
        logWithContext("debug", message, undefined, context),
    };
  }

  /**
   * Get logging statistics
   */
  getStats(): {
    totalLogs: number;
    errorCount: number;
    uptime: number;
    activeTimers: number;
    requestCount: number;
  } {
    return {
      totalLogs: this.logCount,
      errorCount: this.errorCount,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      activeTimers: this.performanceTimers.size,
      requestCount: this.requestCounter,
    };
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    error?: Error,
    context?: LogContext,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    this.logCount++;
    if (level === "error") {
      this.errorCount++;
    }

    const entry: ExtendedLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      requestId: context?.requestId as string | undefined,
      component: context?.component as string | undefined,
    };

    const output =
      this.format === "json" ? JSON.stringify(entry) : this.formatPretty(entry);

    // Use appropriate console method
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }

    // Write to file if configured
    if (this.file) {
      this.writeToFile(output).catch((err) => {
        console.error("Failed to write to log file:", err);
      });
    }
  }

  /**
   * Check if should log based on level
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  /**
   * Parse log level from string
   */
  private parseLevel(level: string): LogLevel {
    const normalized = level.toLowerCase() as LogLevel;
    if (normalized in LOG_LEVELS) {
      return normalized;
    }
    return "info";
  }

  /**
   * Format log entry as pretty string
   */
  private formatPretty(entry: ExtendedLogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase().padEnd(5);
    const requestId = entry.requestId ? `[${entry.requestId}] ` : "";
    const component = entry.component ? `<${entry.component}> ` : "";
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const error = entry.error
      ? `\n  ${entry.error.stack ?? entry.error.message}`
      : "";

    return `[${timestamp}] ${level} | ${requestId}${component}${entry.message}${context}${error}`;
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(line: string): Promise<void> {
    if (!this.file) {
      return;
    }

    try {
      // Check if we need to rotate
      if (this.currentLogFile && this.currentLogFile.size >= this.maxFileSize) {
        await this.rotateLogFile();
      }

      // Initialize log file if needed
      if (!this.currentLogFile) {
        await this.initializeLogFile();
      }

      if (this.currentLogFile) {
        const logLine = line + "\n";
        await fs.appendFile(this.currentLogFile.path, logLine, "utf-8");
        this.currentLogFile.size += Buffer.byteLength(logLine, "utf-8");
      }
    } catch (error) {
      // Don't throw, just log to console
      console.error("Failed to write to log file:", error);
    }
  }

  /**
   * Initialize log file
   */
  private async initializeLogFile(): Promise<void> {
    if (!this.file) {
      return;
    }

    const logDir = path.dirname(this.file);
    await fs.mkdir(logDir, { recursive: true });

    this.currentLogFile = {
      path: this.file,
      size: 0,
      createdAt: new Date(),
    };

    // Check existing file size
    try {
      const stats = await fs.stat(this.file);
      this.currentLogFile.size = stats.size;
    } catch {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(): Promise<void> {
    if (!this.file || !this.currentLogFile) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedPath = `${this.file}.${timestamp}`;

    try {
      // Rename current file
      await fs.rename(this.file, rotatedPath);

      // Clean up old files
      await this.cleanupOldLogFiles();

      // Reset current log file
      this.currentLogFile = {
        path: this.file,
        size: 0,
        createdAt: new Date(),
      };

      console.log(`Log rotated to ${rotatedPath}`);
    } catch (error) {
      console.error("Failed to rotate log file:", error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogFiles(): Promise<void> {
    if (!this.file) {
      return;
    }

    const logDir = path.dirname(this.file);
    const baseName = path.basename(this.file);

    try {
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter((f) => f.startsWith(baseName) && f !== baseName)
        .map((f) => ({
          name: f,
          path: path.join(logDir, f),
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      // Remove files beyond max count
      const toRemove = logFiles.slice(this.maxFiles - 1);
      for (const file of toRemove) {
        await fs.unlink(file.path);
        console.log(`Removed old log file: ${file.name}`);
      }
    } catch (error) {
      console.error("Failed to cleanup old log files:", error);
    }
  }
}
