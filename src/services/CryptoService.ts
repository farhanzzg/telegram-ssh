/**
 * Crypto Service
 * Provides AES-256-GCM encryption for credential storage
 */

import * as crypto from 'crypto';
import type { EncryptedData } from '../types/index.js';
import { InvalidConfigError } from '../errors/index.js';

/**
 * Encryption algorithm configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag

/**
 * Crypto service for encrypting and decrypting sensitive data
 */
export class CryptoService {
  private readonly key: Buffer;

  constructor(encryptionKey: string) {
    // Validate key length (should be 64 hex characters = 32 bytes)
    if (encryptionKey.length !== 64) {
      throw new InvalidConfigError('Encryption key must be 64 hex characters (32 bytes)');
    }

    // Convert hex string to buffer
    this.key = Buffer.from(encryptionKey, 'hex');

    if (this.key.length !== 32) {
      throw new InvalidConfigError('Encryption key must decode to 32 bytes');
    }
  }

  /**
   * Encrypt plaintext string using AES-256-GCM
   */
  encrypt(plaintext: string): EncryptedData {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted.toString('base64'),
    };
  }

  /**
   * Decrypt encrypted data using AES-256-GCM
   */
  decrypt(encrypted: EncryptedData): string {
    // Decode from base64
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');
    const data = Buffer.from(encrypted.data, 'base64');

    // Validate IV length
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Set auth tag
    decipher.setAuthTag(authTag);

    // Decrypt
    try {
      const decrypted = Buffer.concat([
        decipher.update(data),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error('Decryption failed: authentication tag verification failed');
    }
  }

  /**
   * Hash a string using SHA-256
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify a hash against data
   */
  verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }

  /**
   * Generate a random hex string
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a random ID
   */
  static generateId(prefix: string = ''): string {
    const id = crypto.randomBytes(8).toString('hex');
    return prefix ? `${prefix}_${id}` : id;
  }
}
