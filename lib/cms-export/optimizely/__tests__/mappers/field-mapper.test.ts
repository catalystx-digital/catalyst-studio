import { FieldMapper } from '../../mappers/field-mapper';
import { OptimizelyProperty } from '../../types';
import { UniversalField } from '../../../universal/types';

describe('FieldMapper', () => {
  let mapper: FieldMapper;

  beforeEach(() => {
    mapper = new FieldMapper();
  });

  describe('toUniversal', () => {
    it('should map primitive Optimizely field to Universal format', () => {
      const optimizelyProperty: OptimizelyProperty = {
        type: 'String',
        displayName: 'Title',
        required: true,
        description: 'Page title'
      };

      const result = mapper.toUniversal('title', optimizelyProperty);

      expect(result.id).toBe('field_title');
      expect(result.name).toBe('title');
      expect(result.layer).toBe('primitive');
      expect(result.type).toBe('string');
      expect(result.required).toBe(true);
      expect(result.description).toBe('Page title');
      expect(result.platformSpecific?.displayName).toBe('Title');
    });

    it('should map common Optimizely field to Universal format', () => {
      const optimizelyProperty: OptimizelyProperty = {
        type: 'XhtmlString',
        displayName: 'Rich Content',
        required: false,
        description: 'Rich text content'
      };

      const result = mapper.toUniversal('content', optimizelyProperty);

      expect(result.layer).toBe('common');
      expect(result.type).toBe('richText');
      expect(result.required).toBe(false);
    });

    it('should map extension Optimizely field to Universal format', () => {
      const optimizelyProperty: OptimizelyProperty = {
        type: 'CustomType',
        displayName: 'Custom Field',
        required: false
      };

      const result = mapper.toUniversal('custom', optimizelyProperty);

      expect(result.layer).toBe('extension');
      expect(result.type).toBe('string'); // Falls back to string for unknown types
    });

    it('should include validation for required fields', () => {
      const optimizelyProperty: OptimizelyProperty = {
        type: 'String',
        displayName: 'Required Field',
        required: true
      };

      const result = mapper.toUniversal('requiredField', optimizelyProperty);

      expect(result.validations).toHaveLength(1);
      expect(result.validations?.[0].type).toBe('required');
    });
  });

  describe('fromUniversal', () => {
    it('should map Universal field to Optimizely property', () => {
      const universalField: UniversalField = {
        id: 'field_title',
        name: 'title',
        layer: 'primitive',
        type: 'text',
        description: 'Page title',
        required: true,
        validations: [],
        platformSpecific: {
          displayName: 'Title'
        }
      };

      const result = mapper.fromUniversal(universalField);

      expect(result.type).toBe('string');
      expect(result.displayName).toBe('Title');
      expect(result.required).toBe(true);
      expect(result.description).toBe('Page title');
    });

    it('should use field name as display name if not provided', () => {
      const universalField: UniversalField = {
        id: 'field_content',
        name: 'content',
        layer: 'common',
        type: 'richText',
        required: false,
        validations: []
      };

      const result = mapper.fromUniversal(universalField);

      expect(result.displayName).toBe('content');
    });

    it('should handle various field types correctly', () => {
      const testCases = [
        { universalType: 'string', optimizelyType: 'string' },
        { universalType: 'number', optimizelyType: 'integer' },
        { universalType: 'boolean', optimizelyType: 'boolean' },
        { universalType: 'date', optimizelyType: 'dateTime' },
        { universalType: 'richText', optimizelyType: 'richText' },
        { universalType: 'reference', optimizelyType: 'contentReference' },
        { universalType: 'array', optimizelyType: 'array' },
        { universalType: 'media', optimizelyType: 'contentReference' },
        { universalType: 'select', optimizelyType: 'string' },
        { universalType: 'multiselect', optimizelyType: 'string' },
        { universalType: 'unknown', optimizelyType: 'string' } // Fallback
      ];

      testCases.forEach(({ universalType, optimizelyType }) => {
        const field: UniversalField = {
          id: 'test',
          name: 'test',
          layer: 'primitive',
          type: universalType as any,
          validations: []
        };

        const result = mapper.fromUniversal(field);
        expect(result.type).toBe(optimizelyType);
      });
    });

    it('maps component lists to content areas with allowed types', () => {
      const field: UniversalField = {
        id: 'components',
        name: 'components',
        layer: 'common',
        type: 'array',
        required: false,
        validations: [],
        metadata: {
          componentList: true,
          itemType: 'content',
          allowedComponentTypes: ['hero-banner', 'feature-grid']
        },
        platformSpecific: {
          allowedTypes: ['hero-banner', 'feature-grid']
        }
      }

      const result = mapper.fromUniversal(field)

      expect(result.type).toBe('ContentArea')
      expect(result.allowedTypes).toEqual(expect.arrayContaining(['hero-banner', 'feature-grid']))
    })
  });
});
