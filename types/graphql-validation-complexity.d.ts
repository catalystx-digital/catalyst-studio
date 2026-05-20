declare module 'graphql-validation-complexity' {
  import { ValidationRule, GraphQLError } from 'graphql';

  export interface ComplexityLimitOptions {
    maximumComplexity: number;
    variables?: Record<string, unknown>;
    onComplete?: (complexity: number) => void;
    createError?: (max: number, actual: number) => GraphQLError;
    scalarCost?: number;
    objectCost?: number;
    listFactor?: number;
    introspectionListFactor?: number;
  }

  export function createComplexityLimitRule(
    options: ComplexityLimitOptions
  ): ValidationRule;
}
