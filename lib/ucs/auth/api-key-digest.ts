import { createHash } from 'node:crypto';

/**
 * Deterministically digest an API key for constant-time comparisons.
 * Keys are already random, so sha256 without salt is acceptable and
 * keeps rotation bookkeeping simple.
 */
export function digestApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}
