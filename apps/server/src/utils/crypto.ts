/**
 * Encryption utilities for sensitive data (server tokens, API keys)
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

let encryptionKey: Buffer | null = null;

/**
 * Initialize the encryption module with the key from environment
 * Must be called during server startup
 */
export function initializeEncryption(): void {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Key should be 32 bytes (64 hex chars) for AES-256
  if (keyHex.length !== KEY_LENGTH * 2) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`
    );
  }

  encryptionKey = Buffer.from(keyHex, 'hex');
}

/**
 * Check if encryption is initialized
 */
export function isEncryptionInitialized(): boolean {
  return encryptionKey !== null;
}

/**
 * Get the encryption key, throwing if not initialized
 */
function getKey(): Buffer {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized. Call initializeEncryption() first.');
  }
  return encryptionKey;
}

/**
 * Encrypt a string value
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine iv:authTag:ciphertext and encode as base64
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);
  return combined.toString('base64');
}

/**
 * Decrypt a value encrypted with encrypt()
 * Returns the original plaintext string
 */
export function decrypt(encryptedValue: string): string {
  const key = getKey();

  // Decode the combined value
  const combined = Buffer.from(encryptedValue, 'base64');

  // Extract iv, authTag, and ciphertext
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate a new random encryption key
 * Returns a hex-encoded 32-byte key suitable for ENCRYPTION_KEY env var
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}
