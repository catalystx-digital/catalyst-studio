import { GraphQLScalarType, Kind } from 'graphql';

function ensureDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  throw new TypeError('Invalid Date');
}

function identity(value: unknown): unknown {
  return value;
}

function parseLiteral(ast: any): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.OBJECT: {
      const fields = ast.fields as Array<{ name: { value: string }; value: unknown }>;
      return fields.reduce<Record<string, unknown>>((acc, field) => {
        acc[field.name.value] = parseLiteral(field.value);
        return acc;
      }, {});
    }
    default:
      return null;
  }
}

export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO-8601 timestamp string',
  serialize(value) {
    return ensureDate(value);
  },
  parseValue(value) {
    return ensureDate(value);
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new TypeError('DateTime value must be a string literal');
    }
    return ensureDate(ast.value);
  },
});

export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: identity,
  parseValue: identity,
  parseLiteral,
});
