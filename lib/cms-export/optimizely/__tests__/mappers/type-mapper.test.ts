import { TypeMapper } from '../../mappers/type-mapper';
import { OptimizelyContentType } from '../../types';
import { UniversalContentType } from '../../../universal/types';

describe('TypeMapper', () => {
  let mapper: TypeMapper;

  beforeEach(() => {
    mapper = new TypeMapper();
  });

  describe('toUniversal', () => {
    it('should map Optimizely page type to Universal format', () => {
      const optimizelyType: OptimizelyContentType = {
        key: 'ArticlePage',
        displayName: 'Article Page',
        description: 'Article page type',
        baseType: '_page',
        source: 'test',
        sortOrder: 100,
        mayContainTypes: [],
        properties: {
          title: {
            type: 'String',
            displayName: 'Title',
            required: true,
            description: 'Page title'
          },
          content: {
            type: 'XhtmlString',
            displayName: 'Content',
            required: false
          }
        }
      };

      const result = mapper.toUniversal(optimizelyType);

      expect(result.id).toBe('ArticlePage');
      expect(result.name).toBe('ArticlePage');
      expect(result.type).toBe('page');
      expect(result.isRoutable).toBe(true);
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].name).toBe('title');
      expect(result.fields[1].name).toBe('content');
    });

    it('should map Optimizely component type to Universal format', () => {
      const optimizelyType: OptimizelyContentType = {
        key: 'HeroBlock',
        displayName: 'Hero Block',
        description: 'Hero component',
        baseType: '_component',
        source: 'test',
        sortOrder: 100,
        mayContainTypes: [],
        properties: {
          heading: {
            type: 'String',
            displayName: 'Heading',
            required: true
          }
        }
      };

      const result = mapper.toUniversal(optimizelyType);

      expect(result.type).toBe('component');
      expect(result.isRoutable).toBe(false);
    });
  });

  describe('fromUniversal', () => {
    it('should map Universal page type to Optimizely format', () => {
      const universalType: UniversalContentType = {
        version: '1.0',
        id: 'ArticlePage',
        name: 'ArticlePage',
        type: 'page',
        description: 'Article page type',
        isRoutable: true,
        fields: [
          {
            id: 'field_title',
            name: 'title',
            layer: 'primitive',
            type: 'text',
            required: true,
            validations: []
          }
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const result = mapper.fromUniversal(universalType);

      expect(result.key).toBe('ArticlePage');
      expect(result.displayName).toBe('Article Page');
      expect(result.baseType).toBe('_page');
      expect(result.properties.title).toBeUndefined();
      expect(result.mayContainTypes).toEqual(['*']);
    });

    it('respects explicit empty containment arrays', () => {
      const universalType: UniversalContentType = {
        version: '1.0',
        id: 'LandingPage',
        name: 'LandingPage',
        type: 'page',
        description: 'Landing page type',
        isRoutable: true,
        fields: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          platformSpecific: {
            mayContainTypes: []
          }
        }
      } as any;

      const result = mapper.fromUniversal(universalType);
      expect(result.mayContainTypes).toEqual([]);
    });

    it('preserves wildcard containment', () => {
      const universalType: UniversalContentType = {
        version: '1.0',
        id: 'ArticlePage',
        name: 'ArticlePage',
        type: 'page',
        isRoutable: true,
        fields: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          platformSpecific: {
            mayContainTypes: ['*']
          }
        }
      } as any;

      const result = mapper.fromUniversal(universalType);
      expect(result.mayContainTypes).toEqual(['*']);
    });

    it('preserves specific containment lists', () => {
      const universalType: UniversalContentType = {
        version: '1.0',
        id: 'HomePage',
        name: 'HomePage',
        type: 'page',
        isRoutable: true,
        fields: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          platformSpecific: {
            mayContainTypes: ['blog_post', 'landing_page']
          }
        }
      } as any;

      const result = mapper.fromUniversal(universalType);
      expect(result.mayContainTypes).toEqual(
        expect.arrayContaining(['blog_post', 'landing_page'])
      );
      expect(result.mayContainTypes).not.toContain('*');
    });

    it('drops other values when wildcard present in platform metadata', () => {
      const universalType: UniversalContentType = {
        version: '1.0',
        id: 'WildcardPage',
        name: 'WildcardPage',
        type: 'page',
        isRoutable: true,
        fields: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          platformSpecific: {
            mayContainTypes: ['*', 'blog_post', 'landing_page']
          }
        }
      } as any;

      const result = mapper.fromUniversal(universalType);
      expect(result.mayContainTypes).toEqual(['*']);
    });

    it('should map Universal component type to Optimizely format', () => {
      const universalType: UniversalContentType = {
        version: '1.0',
        id: 'HeroBlock',
        name: 'HeroBlock',
        type: 'component',
        isRoutable: false,
        fields: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const result = mapper.fromUniversal(universalType);

      expect(result.baseType).toBe('_component');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty properties', () => {
      const optimizelyType: OptimizelyContentType = {
        key: 'EmptyType',
        displayName: 'Empty Type',
        description: '',
        baseType: '_component',
        source: 'test',
        sortOrder: 100,
        mayContainTypes: [],
        properties: {}
      };

      const result = mapper.toUniversal(optimizelyType);

      expect(result.fields).toHaveLength(0);
    });

    it('should handle types with special characters in key', () => {
      const optimizelyType: OptimizelyContentType = {
        key: 'Type_With-Special.Chars',
        displayName: 'Special Type',
        description: 'Type with special characters',
        baseType: '_component',
        source: 'test',
        sortOrder: 100,
        mayContainTypes: [],
        properties: {}
      };

      const result = mapper.toUniversal(optimizelyType);

      expect(result.id).toBe('Type_With-Special.Chars');
    });
  });
});
