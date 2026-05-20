import crypto from "crypto";

const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type EncryptionMode = "enabled" | "disabled";

export interface EncryptionConfig {
  keyId: string;
  key: Buffer;
  mode: EncryptionMode;
  algorithm: string;
}

export interface EncryptionResult {
  ciphertext: Buffer;
  keyId: string;
  algorithm: string;
  isEncrypted: boolean;
}

export interface CipherPayload {
  ciphertext: Buffer;
  keyId: string;
  algorithm?: string;
}

export interface RotationPlan {
  keyId: string;
  scheduledFor?: Date;
  notes?: string;
}

export class CryptoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoConfigurationError";
  }
}

export class DecryptionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionFailedError";
  }
}

let cachedConfig: EncryptionConfig | null = null;
let pendingRotation: RotationPlan | null = null;

function normaliseMode(value: string | undefined): EncryptionMode {
  return value?.toLowerCase() === "disabled" ? "disabled" : "enabled";
}

function decodeKey(rawKey: string): Buffer {
  if (!rawKey) {
    throw new CryptoConfigurationError("Missing STUDIO_ENCRYPTION_KEY environment variable.");
  }

  const trimmed = rawKey.trim();

  if (trimmed.startsWith("base64:")) {
    return Buffer.from(trimmed.slice(7), "base64");
  }

  if (trimmed.startsWith("hex:")) {
    return Buffer.from(trimmed.slice(4), "hex");
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64) {
    return Buffer.from(trimmed, "hex");
  }

  const buffer = Buffer.from(trimmed, "base64");
  if (buffer.length === 0) {
    throw new CryptoConfigurationError("Unable to decode encryption key; provide base64 or hex.");
  }

  return buffer;
}

function validateKeyLength(key: Buffer): void {
  if (key.length !== 32) {
    throw new CryptoConfigurationError("Encryption key must be 32 bytes for aes-256-gcm.");
  }
}

export function resetCryptoState(): void {
  cachedConfig = null;
  pendingRotation = null;
}

export function scheduleKeyRotation(plan: RotationPlan): void {
  pendingRotation = plan;
}

export function getPendingRotation(): RotationPlan | null {
  return pendingRotation;
}

export function clearPendingRotation(): void {
  pendingRotation = null;
}

export function getEncryptionConfig(): EncryptionConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const mode = normaliseMode(process.env.STUDIO_ENCRYPTION_MODE);
  const keyId = process.env.STUDIO_ENCRYPTION_KEY_ID?.trim() || "v1";

  if (mode === "disabled") {
    cachedConfig = {
      keyId,
      key: Buffer.alloc(32),
      mode,
      algorithm: AES_ALGORITHM,
    };
    return cachedConfig;
  }

  const keyBuffer = decodeKey(process.env.STUDIO_ENCRYPTION_KEY ?? "");
  validateKeyLength(keyBuffer);

  cachedConfig = {
    keyId,
    key: keyBuffer,
    mode,
    algorithm: AES_ALGORITHM,
  };

  return cachedConfig;
}

function ensurePayloadAlgorithm(payload: CipherPayload): string {
  if (payload.algorithm && payload.algorithm !== AES_ALGORITHM) {
    throw new DecryptionFailedError(`Unsupported algorithm: ${payload.algorithm}`);
  }

  return payload.algorithm ?? AES_ALGORITHM;
}

export function encrypt(value: Buffer | string): EncryptionResult {
  const config = getEncryptionConfig();
  const input = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, "utf8");

  if (config.mode === "disabled") {
    return {
      ciphertext: input,
      keyId: config.keyId,
      algorithm: config.algorithm,
      isEncrypted: false,
    };
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(config.algorithm, config.key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([iv, encrypted, authTag]),
    keyId: config.keyId,
    algorithm: config.algorithm,
    isEncrypted: true,
  };
}

export function decrypt(payload: CipherPayload): Buffer {
  const config = getEncryptionConfig();
  const algorithm = ensurePayloadAlgorithm(payload);

  if (config.mode === "disabled") {
    return Buffer.from(payload.ciphertext);
  }

  if (payload.keyId !== config.keyId) {
    throw new DecryptionFailedError(`Unknown encryption key identifier: ${payload.keyId}`);
  }

  const ciphertext = Buffer.from(payload.ciphertext);
  if (ciphertext.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new DecryptionFailedError("Ciphertext payload is too short.");
  }

  const iv = ciphertext.subarray(0, IV_LENGTH);
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH);
  const encrypted = ciphertext.subarray(IV_LENGTH, ciphertext.length - AUTH_TAG_LENGTH);

  try {
    const decipher = crypto.createDecipheriv(algorithm, config.key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (error) {
    throw new DecryptionFailedError("Failed to decrypt payload: authentication failed.");
  }
}
