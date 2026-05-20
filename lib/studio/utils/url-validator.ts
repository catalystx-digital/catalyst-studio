/**
 * URL validation utility for secure link handling
 * Prevents XSS, open redirects, and other URL-based attacks
 */

/**
 * Validates if a URL is safe to use in navigation
 * @param url - The URL to validate
 * @returns true if URL is safe, false otherwise
 */
export function isValidUrl(url: string | undefined): boolean {
  // Empty URLs are considered valid (component will use defaults)
  if (!url || url.trim() === '') {
    return true;
  }

  // Check for string type
  if (typeof url !== 'string') {
    return false;
  }

  const trimmedUrl = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
    'blob:',
  ];

  const lowerUrl = trimmedUrl.toLowerCase();
  if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
    return false;
  }

  // Check for protocol-relative URLs (// which could be exploited)
  if (trimmedUrl.startsWith('//')) {
    return false;
  }

  // Handle relative URLs (starting with /)
  if (trimmedUrl.startsWith('/')) {
    // Ensure it's a valid relative path (no double slashes except at start)
    return !trimmedUrl.includes('../') && !trimmedUrl.includes('./');
  }

  // Handle hash URLs
  if (trimmedUrl.startsWith('#')) {
    return true;
  }

  // Validate absolute URLs
  try {
    const parsed = new URL(trimmedUrl);
    
    // Only allow safe protocols for absolute URLs
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }

    // Additional check for suspicious patterns in the URL
    const suspiciousPatterns = [
      '%3Cscript',  // encoded <script>
      '%3C%2Fscript',  // encoded </script>
      'onclick',
      'onerror',
      'onload',
      '<script',
      '</script',
    ];

    if (suspiciousPatterns.some(pattern => lowerUrl.includes(pattern.toLowerCase()))) {
      return false;
    }

    return true;
  } catch {
    // If URL parsing fails, it's not a valid absolute URL
    // Could be a malformed URL or special case - reject for safety
    return false;
  }
}

/**
 * Sanitizes a URL by returning a safe fallback if invalid
 * @param url - The URL to sanitize
 * @param fallback - The fallback URL if validation fails (default: '#')
 * @returns The original URL if valid, otherwise the fallback
 */
export function sanitizeUrl(url: string | undefined, fallback: string = '#'): string {
  return isValidUrl(url) ? (url || fallback) : fallback;
}

/**
 * Validates an array of URLs (useful for menu items, social links, etc.)
 * @param urls - Array of URLs to validate
 * @returns true if all URLs are valid, false otherwise
 */
export function validateUrlArray(urls: (string | undefined)[]): boolean {
  return urls.every(url => isValidUrl(url));
}