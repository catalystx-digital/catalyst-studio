import { KontentTypeMapper } from '../../kontent/mappers/type-mapper';
import type { UniversalContentType } from '@/lib/cms-export/types';

describe('KontentTypeMapper', () => {
  const baseType: UniversalContentType = {
    id: 'article',
    name: 'Article',
    version: '1.0.0',
    type: 'component',
    isRoutable: false,
    description: 'Test content type',
    fields: [
      {
        id: 'title',
        name: 'Title',
        type: 'text',
        layer: 'common',
        required: true,
      },
      {
        id: 'heroMedia',
        name: 'Hero Media',
        type: 'media',
        layer: 'common',
      },
      {
        id: 'body',
        name: 'Body',
        type: 'richText',
        layer: 'common',
      },
      {
        id: 'relatedArticles',
        name: 'Related Articles',
        type: 'repeater',
        layer: 'common',
        platformSpecific: {
          allowedTypes: ['article'],
        },
      },
      {
        id: 'isFeatured',
        name: 'Is Featured',
        type: 'boolean',
        layer: 'common',
      },
    ],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    platformSpecific: {},
  };

  it('maps universal field definitions to Kontent elements', () => {
    const mapper = new KontentTypeMapper({
      resolveTypeCodename: value => (value === 'article' ? 'article' : undefined),
    });

    const { contentType, fieldMappings } = mapper.map(baseType);

    expect(contentType.codename).toBe('article');
    expect(contentType.elements).toHaveLength(5);
    expect(contentType.elements[0]).toMatchObject({
      codename: 'title',
      type: 'text',
      is_required: true,
    });

    const heroMedia = fieldMappings.find(field => field.element.codename === 'hero_media');
    expect(heroMedia?.element.type).toBe('asset');

    const related = fieldMappings.find(field => field.element.codename.startsWith('related'));
    expect(related?.element.type).toBe('modular_content');
    expect(related?.element.allowed_content_types).toEqual([{ codename: 'article' }]);

    const booleanField = fieldMappings.find(field => field.element.codename.startsWith('is_featured'));
    expect(booleanField?.element.type).toBe('multiple_choice');
    expect(booleanField?.element.options).toEqual([
      { name: 'Yes', codename: 'yes' },
      { name: 'No', codename: 'no' },
    ]);
  });
});
