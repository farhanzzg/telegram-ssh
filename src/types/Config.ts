/**
 * Configuration type definitions
 */

export interface TelegramConfig {
  token: string;
  chatId: string;
  ownerIds: string[];
  polling: boolean;
}

export interface SecurityConfig {
  encryptionKey: string;
  rateLimit: RateLimitConfig;
  allowedCommands?: string[];
  blockedCommands?: string[];
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipFailedRequests: boolean;
}

export interface SSHConfig {
  defaultPrivateKeyPath: string;
  connectionTimeout: number;
  keepaliveInterval: number;
  maxConnections: number;
  commandTimeout: number;
}

export interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "pretty";
  file?: string;
}

export interface StorageConfig {
  serversFile: string;
  encryptionEnabled: boolean;
}

export interface AppConfig {
  telegram: TelegramConfig;
  security: SecurityConfig;
  ssh: SSHConfig;
  logging: LoggingConfig;
  storage: StorageConfig;
}
