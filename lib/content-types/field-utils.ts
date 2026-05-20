import { FieldType } from './types';

export function getFieldIcon(type: FieldType): string {
  switch (type) {
    case FieldType.TEXT:
      return '📝';
    case FieldType.NUMBER:
      return '🔢';
    case FieldType.BOOLEAN:
      return '✓';
    case FieldType.DATE:
      return '📅';
    case FieldType.IMAGE:
      return '🖼️';
    case FieldType.RICH_TEXT:
      return '📄';
    case FieldType.REFERENCE:
      return '🔗';
    default:
      return '📋';
  }
}