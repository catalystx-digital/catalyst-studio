/**
 * Safely converts a value to a Date object
 * @param value - Value to convert (Date, string, number, or undefined)
 * @returns Date object or null if conversion fails
 */
export function safeToDate(value: Date | string | number | undefined | null): Date | null {
  if (!value) return null;
  
  try {
    // Already a Date object
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    
    // Convert string or number to Date
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Failed to convert to date:', value, error);
    return null;
  }
}

/**
 * Safely calculates time difference in milliseconds
 * @param endDate - End date (Date, string, or number)
 * @param startDate - Start date (Date, string, or number)
 * @returns Time difference in milliseconds or 0 if calculation fails
 */
export function safeTimeDifference(
  endDate: Date | string | number | undefined | null,
  startDate: Date | string | number | undefined | null
): number {
  const end = safeToDate(endDate);
  const start = safeToDate(startDate);
  
  if (!end || !start) return 0;
  
  return Math.max(0, end.getTime() - start.getTime());
}

/**
 * Type guard to check if a value is a valid Date
 * @param value - Value to check
 * @returns True if value is a valid Date object
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Formats a date value to ISO string safely
 * @param value - Date value to format
 * @returns ISO string or empty string if formatting fails
 */
export function safeToISOString(value: Date | string | number | undefined | null): string {
  const date = safeToDate(value);
  return date ? date.toISOString() : '';
}