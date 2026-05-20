export function isOptimizelyError(error: unknown): boolean {
  return error instanceof Error && 
    (error.name === 'OptimizelyConnectionError' || 
     error.name === 'OptimizelyValidationError' ||
     error.name === 'OptimizelyTransformationError');
}

export function formatOptimizelyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function getOptimizelyFieldTypeCategory(type: string): 'primitive' | 'common' | 'extension' {
  const primitiveTypes = ['String', 'Number', 'Boolean', 'Integer', 'Float'];
  const commonTypes = ['DateTime', 'Url', 'XhtmlString', 'ContentReference', 'ContentArea'];
  
  if (primitiveTypes.includes(type)) {
    return 'primitive';
  } else if (commonTypes.includes(type)) {
    return 'common';
  } else {
    return 'extension';
  }
}