/**
 * Type declarations for setup-env.js
 */

export function getConfigDir(): string;
export function getEnvFilePath(): string;
export function getEnvExamplePath(): string | null;
export function ensureConfigDir(): string;
export function generateEncryptionKey(): string;
export function envFileExists(): boolean;
export function createEnvFile(options?: { generateKey?: boolean }): boolean;
export function writeEnvFile(values: {
  botToken: string;
  botChatId: string;
  botOwnerIds: string[];
  encryptionKey: string;
}): boolean;
export function main(options?: {
  force?: boolean;
  generateKey?: boolean;
  silent?: boolean;
}): {
  success: boolean;
  created: boolean;
  envPath: string;
  configDir: string;
  message: string;
};
