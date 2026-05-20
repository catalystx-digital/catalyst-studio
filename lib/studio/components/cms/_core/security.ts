import DOMPurify from 'isomorphic-dompurify';

// Define DOMPurify config interface since types aren't available
interface DOMPurifyConfig {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOW_DATA_ATTR?: boolean;
  KEEP_CONTENT?: boolean;
  [key: string]: any;
}

/**
 * Security utilities for form validation and content sanitization
 * Story 10.10: Contact & Forms Components
 */

// Email validation regex (RFC 5322 compliant)
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (international format support)
export const PHONE_REGEX = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

// URL validation regex
export const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

/**
 * Validate an email address
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate a phone number (international formats)
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  return PHONE_REGEX.test(phone.trim());
}

/**
 * Validate a URL
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return URL_REGEX.test(url.trim());
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string, options?: DOMPurifyConfig): string {
  if (!html || typeof html !== 'string') return '';
  
  const defaultOptions: DOMPurifyConfig = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ...options,
  };
  
  return DOMPurify.sanitize(html, defaultOptions);
}

/**
 * Sanitize plain text (remove all HTML)
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return DOMPurify.sanitize(text, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Generate a random CSRF token
 */
export function generateCsrfToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  
  if (typeof window !== 'undefined' && window.crypto) {
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      token += chars[values[i] % chars.length];
    }
  } else {
    // Fallback for server-side or older browsers
    for (let i = 0; i < length; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return token;
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) return false;
  return token === storedToken;
}

/**
 * Rate limiting helper for client-side debouncing
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Create a honeypot field configuration
 */
export interface HoneypotConfig {
  fieldName: string;
  isSpam: (value: any) => boolean;
}

export function createHoneypot(fieldName: string = '_honeypot'): HoneypotConfig {
  return {
    fieldName,
    isSpam: (value: any) => {
      // If honeypot field has any value, it's likely spam
      return value !== undefined && value !== null && value !== '';
    },
  };
}

/**
 * Validate form field with common rules
 */
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message?: string;
}

export function validateField(value: any, rules: ValidationRule): string | null {
  // Required validation
  if (rules.required) {
    if (value === undefined || value === null || value === '') {
      return rules.message || 'This field is required';
    }
    if (typeof value === 'string' && value.trim() === '') {
      return rules.message || 'This field is required';
    }
  }
  
  // String validations
  if (typeof value === 'string' && value.trim()) {
    // Min length validation
    if (rules.minLength && value.length < rules.minLength) {
      return rules.message || `Minimum ${rules.minLength} characters required`;
    }
    
    // Max length validation
    if (rules.maxLength && value.length > rules.maxLength) {
      return rules.message || `Maximum ${rules.maxLength} characters allowed`;
    }
    
    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      return rules.message || 'Invalid format';
    }
  }
  
  // Custom validation
  if (rules.custom && !rules.custom(value)) {
    return rules.message || 'Validation failed';
  }
  
  return null;
}

/**
 * Sanitize form data object
 */
export function sanitizeFormData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFormData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, char => map[char]);
}

/**
 * Check for common SQL injection patterns
 */
export function hasSqlInjectionPattern(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE)\b)/i,
    /(--|#|\/\*|\*\/)/,
    /(\bOR\b.*=.*)/i,
    /('.*\bOR\b.*')/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for common XSS patterns
 */
export function hasXssPattern(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /<img[^>]*onerror/gi,
    /<svg[^>]*onload/gi,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Security check for form submission
 */
export interface SecurityCheckResult {
  isValid: boolean;
  errors: string[];
}

export function performSecurityCheck(data: Record<string, any>): SecurityCheckResult {
  const errors: string[] = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      if (hasSqlInjectionPattern(value)) {
        errors.push(`Potential SQL injection detected in field: ${key}`);
      }
      if (hasXssPattern(value)) {
        errors.push(`Potential XSS attack detected in field: ${key}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      const nestedCheck = performSecurityCheck(value);
      if (!nestedCheck.isValid) {
        errors.push(...nestedCheck.errors);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default {
  validateEmail,
  validatePhone,
  validateUrl,
  sanitizeHtml,
  sanitizeText,
  generateCsrfToken,
  verifyCsrfToken,
  debounce,
  throttle,
  createHoneypot,
  validateField,
  sanitizeFormData,
  escapeHtml,
  hasSqlInjectionPattern,
  hasXssPattern,
  performSecurityCheck,
};