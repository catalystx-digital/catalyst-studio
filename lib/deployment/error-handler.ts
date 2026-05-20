/**
 * Deployment error types
 */
export enum DeploymentErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  CONFIGURATION = 'CONFIGURATION',
  PROVIDER = 'PROVIDER',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Deployment error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Extended deployment error with additional context
 */
export class DeploymentError extends Error {
  public readonly type: DeploymentErrorType;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    type: DeploymentErrorType = DeploymentErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeploymentError';
    this.type = type;
    this.severity = severity;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = new Date();
  }
}

/**
 * Categorizes errors and returns appropriate DeploymentError
 * @param error - Original error
 * @returns Categorized DeploymentError
 */
export function categorizeError(error: unknown): DeploymentError {
  if (error instanceof DeploymentError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Network errors
  if (errorMessage.includes('fetch failed') || 
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('ECONNREFUSED')) {
    return new DeploymentError(
      'Network connection failed. Please check your internet connection.',
      DeploymentErrorType.NETWORK,
      ErrorSeverity.HIGH,
      true
    );
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('ETIMEDOUT')) {
    return new DeploymentError(
      'Operation timed out. The server may be busy.',
      DeploymentErrorType.TIMEOUT,
      ErrorSeverity.MEDIUM,
      true
    );
  }

  // Authentication errors
  if (errorMessage.includes('401') || 
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication')) {
    return new DeploymentError(
      'Authentication failed. Please check your credentials.',
      DeploymentErrorType.AUTHENTICATION,
      ErrorSeverity.HIGH,
      false
    );
  }

  // Rate limiting
  if (errorMessage.includes('429') || 
      errorMessage.includes('rate limit')) {
    return new DeploymentError(
      'Rate limit exceeded. Please wait before retrying.',
      DeploymentErrorType.RATE_LIMIT,
      ErrorSeverity.LOW,
      true
    );
  }

  // Validation errors
  if (errorMessage.includes('validation') || 
      errorMessage.includes('invalid')) {
    return new DeploymentError(
      errorMessage,
      DeploymentErrorType.VALIDATION,
      ErrorSeverity.MEDIUM,
      false
    );
  }

  // Configuration errors
  if (errorMessage.includes('config') || 
      errorMessage.includes('missing')) {
    return new DeploymentError(
      'Configuration error. Please check your settings.',
      DeploymentErrorType.CONFIGURATION,
      ErrorSeverity.HIGH,
      false
    );
  }

  // Default unknown error
  return new DeploymentError(
    errorMessage || 'An unexpected error occurred',
    DeploymentErrorType.UNKNOWN,
    ErrorSeverity.MEDIUM,
    false
  );
}

/**
 * Formats error for user display
 * @param error - DeploymentError to format
 * @returns User-friendly error message
 */
export function formatErrorForDisplay(error: DeploymentError): string {
  const prefix = error.severity === ErrorSeverity.CRITICAL ? '⚠️ Critical: ' : '';
  const suffix = error.retryable ? ' (This operation can be retried)' : '';
  return `${prefix}${error.message}${suffix}`;
}

/**
 * Logs error with appropriate context
 * @param error - Error to log
 * @param additionalContext - Additional context to log
 */
export function logDeploymentError(
  error: DeploymentError,
  additionalContext?: Record<string, unknown>
): void {
  const logData = {
    timestamp: error.timestamp,
    type: error.type,
    severity: error.severity,
    message: error.message,
    retryable: error.retryable,
    context: {
      ...error.context,
      ...additionalContext,
    },
  };

  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.HIGH:
      console.error('[DeploymentError]', logData);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('[DeploymentError]', logData);
      break;
    case ErrorSeverity.LOW:
      console.log('[DeploymentError]', logData);
      break;
  }
}

/**
 * Creates error recovery suggestions based on error type
 * @param error - DeploymentError
 * @returns Array of recovery suggestions
 */
export function getRecoverySuggestions(error: DeploymentError): string[] {
  const suggestions: string[] = [];

  switch (error.type) {
    case DeploymentErrorType.NETWORK:
      suggestions.push('Check your internet connection');
      suggestions.push('Verify the API endpoint is accessible');
      suggestions.push('Check if a firewall is blocking the connection');
      break;
    case DeploymentErrorType.AUTHENTICATION:
      suggestions.push('Verify your API credentials are correct');
      suggestions.push('Check if your API token has expired');
      suggestions.push('Ensure you have the necessary permissions');
      break;
    case DeploymentErrorType.CONFIGURATION:
      suggestions.push('Review your CMS provider settings');
      suggestions.push('Ensure all required fields are filled');
      suggestions.push('Check the provider documentation for requirements');
      break;
    case DeploymentErrorType.RATE_LIMIT:
      suggestions.push('Wait a few minutes before retrying');
      suggestions.push('Consider reducing the batch size');
      suggestions.push('Check your API rate limits');
      break;
    case DeploymentErrorType.TIMEOUT:
      suggestions.push('Try again with a smaller dataset');
      suggestions.push('Check if the server is experiencing high load');
      suggestions.push('Consider increasing the timeout duration');
      break;
    case DeploymentErrorType.VALIDATION:
      suggestions.push('Review the validation errors');
      suggestions.push('Ensure all required fields have valid values');
      suggestions.push('Check data format requirements');
      break;
    default:
      suggestions.push('Try refreshing the page');
      suggestions.push('Contact support if the issue persists');
      break;
  }

  return suggestions;
}