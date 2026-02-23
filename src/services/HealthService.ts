/**
 * Health Service
 * Provides system health monitoring and status reporting
 */

import type { LogContext } from "../types/index.js";

/**
 * Component health status
 */
export interface ComponentHealth {
  status: "up" | "down";
  latency?: number;
  message?: string;
  lastCheck?: Date;
}

/**
 * Memory health metrics
 */
export interface MemoryHealth {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

/**
 * Overall health status
 */
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: Date;
  version: string;
  components: {
    bot: ComponentHealth;
    storage: ComponentHealth;
    memory: MemoryHealth;
  };
  metrics: {
    activeConnections: number;
    totalServers: number;
    requestsProcessed: number;
  };
}

/**
 * Health check options
 */
export interface HealthCheckOptions {
  version: string;
  startTime: Date;
}

/**
 * Service for monitoring application health
 */
export class HealthService {
  private readonly version: string;
  private readonly startTime: Date;
  private requestsProcessed = 0;
  private activeConnections = 0;
  private totalServers = 0;
  private storageHealthy = true;
  private botHealthy = true;
  private lastStorageCheck: Date | null = null;
  private lastBotCheck: Date | null = null;

  constructor(options: HealthCheckOptions) {
    this.version = options.version;
    this.startTime = options.startTime;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    const memory = this.getMemoryHealth();
    const components = {
      bot: this.getBotHealth(),
      storage: this.getStorageHealth(),
      memory,
    };

    const status = this.determineOverallStatus(components);

    return {
      status,
      uptime: this.getUptime(),
      timestamp: new Date(),
      version: this.version,
      components,
      metrics: {
        activeConnections: this.activeConnections,
        totalServers: this.totalServers,
        requestsProcessed: this.requestsProcessed,
      },
    };
  }

  /**
   * Get memory health metrics
   */
  private getMemoryHealth(): MemoryHealth {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
    };
  }

  /**
   * Get bot component health
   */
  private getBotHealth(): ComponentHealth {
    return {
      status: this.botHealthy ? "up" : "down",
      lastCheck: this.lastBotCheck ?? undefined,
      message: this.botHealthy ? "Bot is running" : "Bot is not responding",
    };
  }

  /**
   * Get storage component health
   */
  private getStorageHealth(): ComponentHealth {
    return {
      status: this.storageHealthy ? "up" : "down",
      lastCheck: this.lastStorageCheck ?? undefined,
      message: this.storageHealthy
        ? "Storage is accessible"
        : "Storage is not accessible",
    };
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(components: {
    bot: ComponentHealth;
    storage: ComponentHealth;
    memory: MemoryHealth;
  }): "healthy" | "degraded" | "unhealthy" {
    // Check if any critical component is down
    if (
      components.bot.status === "down" ||
      components.storage.status === "down"
    ) {
      return "unhealthy";
    }

    // Check memory usage - degraded if heap usage > 85%
    const heapUsagePercent =
      (components.memory.heapUsed / components.memory.heapTotal) * 100;
    if (heapUsagePercent > 85) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Get uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Format uptime as human-readable string
   */
  formatUptime(): string {
    const uptime = this.getUptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get formatted health report
   */
  getFormattedHealthReport(): string {
    const health = this.getHealthStatus();
    const memory = health.components.memory;
    const heapUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;

    const statusEmoji = {
      healthy: "✅",
      degraded: "⚠️",
      unhealthy: "❌",
    };

    const componentEmoji = {
      up: "✅",
      down: "❌",
    };

    let report = `${statusEmoji[health.status]} *System Health*\n\n`;
    report += `📊 *Status:* ${health.status.toUpperCase()}\n`;
    report += `⏱️ *Uptime:* ${this.formatUptime()}\n`;
    report += `📌 *Version:* ${health.version}\n\n`;

    report += `*Components:*\n`;
    report += `  ${componentEmoji[health.components.bot.status]} Bot: ${health.components.bot.message}\n`;
    report += `  ${componentEmoji[health.components.storage.status]} Storage: ${health.components.storage.message}\n\n`;

    report += `*Memory:*\n`;
    report += `  📦 Heap: ${this.formatBytes(memory.heapUsed)} / ${this.formatBytes(memory.heapTotal)} (${heapUsagePercent.toFixed(1)}%)\n`;
    report += `  🖥️ RSS: ${this.formatBytes(memory.rss)}\n`;
    report += `  🔗 External: ${this.formatBytes(memory.external)}\n\n`;

    report += `*Metrics:*\n`;
    report += `  🔌 Active Connections: ${health.metrics.activeConnections}\n`;
    report += `  📋 Total Servers: ${health.metrics.totalServers}\n`;
    report += `  📨 Requests Processed: ${health.metrics.requestsProcessed}\n`;

    return report;
  }

  /**
   * Update bot health status
   */
  setBotHealth(healthy: boolean): void {
    this.botHealthy = healthy;
    this.lastBotCheck = new Date();
  }

  /**
   * Update storage health status
   */
  setStorageHealth(healthy: boolean): void {
    this.storageHealthy = healthy;
    this.lastStorageCheck = new Date();
  }

  /**
   * Increment request counter
   */
  incrementRequests(): void {
    this.requestsProcessed++;
  }

  /**
   * Set active connections count
   */
  setActiveConnections(count: number): void {
    this.activeConnections = count;
  }

  /**
   * Set total servers count
   */
  setTotalServers(count: number): void {
    this.totalServers = count;
  }

  /**
   * Get log context for health-related logs
   */
  getLogContext(): LogContext {
    const health = this.getHealthStatus();
    return {
      status: health.status,
      uptime: health.uptime,
      activeConnections: health.metrics.activeConnections,
      heapUsed: health.components.memory.heapUsed,
    };
  }
}
