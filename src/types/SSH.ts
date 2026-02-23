/// <reference types="node" />
/**
 * SSH-related type definitions
 */

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: Buffer;
  passphrase?: string;
  readyTimeout?: number;
  keepaliveInterval?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  duration: number;
}

export interface SanitizedCommand {
  original: string;
  sanitized: string;
  warnings: string[];
  isSafe: boolean;
}

export interface SSHConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  serverId?: string;
  lastError?: Error;
  connectedAt?: Date;
}

export interface SSHCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: Buffer;
  passphrase?: string;
}

export interface DecryptedCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: Buffer;
  passphrase?: string;
}

export interface ISSHClient {
  connect(config: SSHConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  execute(command: string): Promise<CommandResult>;
  getServerId(): string | undefined;
}
