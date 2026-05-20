/**
 * Reading time calculation utilities for blog components
 * Story 10.12: Blog Components
 */

/**
 * Calculate reading time in minutes based on word count
 * Industry standard: 200-250 words per minute
 * @param text - The text content to calculate reading time for
 * @returns Number of minutes to read the text
 */
export function calculateReadingTime(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  const wordsPerMinute = 225;
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  
  return minutes;
}

/**
 * Format reading time for display
 * @param minutes - Number of minutes
 * @returns Formatted reading time string
 */
export function formatReadingTime(minutes: number): string {
  if (!minutes || minutes < 1) return '< 1 min read';
  if (minutes === 1) return '1 min read';
  return `${minutes} min read`;
}

/**
 * Calculate and format reading time from text
 * Convenience function that combines calculation and formatting
 * @param text - The text content
 * @returns Formatted reading time string
 */
export function getReadingTime(text: string): string {
  const minutes = calculateReadingTime(text);
  return formatReadingTime(minutes);
}

/**
 * Calculate reading time from HTML content
 * Strips HTML tags before calculating
 * @param html - HTML content
 * @returns Number of minutes to read
 */
export function calculateReadingTimeFromHtml(html: string): number {
  if (!html || typeof html !== 'string') return 0;
  
  // Strip HTML tags
  const text = html.replace(/<[^>]*>/g, ' ');
  return calculateReadingTime(text);
}

/**
 * Estimate reading time for mixed content (text + images)
 * Adds 12 seconds per image (industry standard)
 * @param text - Text content
 * @param imageCount - Number of images
 * @returns Number of minutes to read
 */
export function calculateMixedContentReadingTime(
  text: string, 
  imageCount: number = 0
): number {
  const textMinutes = calculateReadingTime(text);
  const imageMinutes = (imageCount * 12) / 60; // 12 seconds per image
  
  return Math.ceil(textMinutes + imageMinutes);
}