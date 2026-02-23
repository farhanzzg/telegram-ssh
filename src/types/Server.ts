/**
 * Server-related type definitions
 */

export interface EncryptedData {
  iv: string;
  authTag: string;
  data: string;
}

export interface ServerAuth {
  type: "password" | "privateKey";
  password?: EncryptedData;
  privateKey?: EncryptedData;
  passphrase?: EncryptedData;
}

export interface Server {
  id: string;
  host: string;
  username: string;
  port: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  auth: ServerAuth;
}

export interface ServerConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  keyPassphrase?: string;
  note?: string;
}

export interface ServerStorage {
  version: number;
  encryptionVersion: number;
  servers: Server[];
}
