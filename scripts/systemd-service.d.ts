/**
 * Type declarations for systemd-service.js
 */

export function getSystemdServiceDir(): string;
export function getSystemdServicePath(): string;
export function getConfigDir(): string;
export function getExecutablePath(): string;
export function generateServiceFile(execPath: string): string;
export function isSystemdServiceInstalled(): boolean;
export function isSystemdServiceRunning(): boolean;
export function isSystemdServiceEnabled(): boolean;

export interface SystemdSetupResult {
  success: boolean;
  servicePath: string;
  execPath: string;
  message: string;
  wasRunning: boolean;
}

export function setupSystemdService(execPath?: string): SystemdSetupResult;
export function enableSystemdService(): boolean;
export function startSystemdService(): boolean;
export function restartSystemdService(): boolean;
export function stopSystemdService(): boolean;
export function disableSystemdService(): boolean;

export interface SystemdServiceStatus {
  installed: boolean;
  running: boolean;
  enabled: boolean;
  servicePath: string;
  execPath: string | null;
}

export function getSystemdServiceStatus(): SystemdServiceStatus;
export function updateSystemdService(): SystemdSetupResult;

export interface FullSystemdSetupOptions {
  enable?: boolean;
  start?: boolean;
  execPath?: string;
}

export interface FullSystemdSetupResult {
  success: boolean;
  message: string;
  servicePath: string;
  execPath: string;
  enabled: boolean;
  started: boolean;
}

export function fullSystemdSetup(options?: FullSystemdSetupOptions): FullSystemdSetupResult;
