/**
 * Generates a unique ID for various entities in the application
 * Uses timestamp + random string for uniqueness
 */
export function generateUniqueId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  const id = `${timestamp}-${randomStr}`;
  
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Generates a website-specific unique ID
 */
export function generateWebsiteId(): string {
  return generateUniqueId('ws');
}

/**
 * Generates a short, human-friendly ID
 */
export function generateShortId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}