import type { ContentstackContentTypeDefinition } from './types';

export const CONTENTSTACK_DEFAULT_BASE_URL = 'https://api.contentstack.io/v3';
export const CONTENTSTACK_DEFAULT_ENVIRONMENT = 'development';
export const CONTENTSTACK_DEFAULT_LOCALE = 'en-us';
export const CONTENTSTACK_DEFAULT_BRANCH = 'main';
export const CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID = 'catalyst_component';
export const CONTENTSTACK_PAGE_CONTENT_TYPE_UID = 'catalyst_page';
export const CONTENTSTACK_MEDIA_CONTENT_TYPE_UID = 'catalyst_media';

export const BASE_CONTENT_TYPES: ContentstackContentTypeDefinition[] = [
  {
    title: 'Catalyst Media',
    uid: CONTENTSTACK_MEDIA_CONTENT_TYPE_UID,
    description: 'Media references exported from Catalyst Studio',
    schema: [
      {
        display_name: 'File Name',
        uid: 'file_name',
        data_type: 'text',
        mandatory: true,
        field_metadata: {
          description: 'Original media filename',
        },
      },
      {
        display_name: 'URL',
        uid: 'url',
        data_type: 'text',
        mandatory: true,
        field_metadata: {
          description: 'Publicly accessible media URL',
        },
      },
      {
        display_name: 'MIME Type',
        uid: 'mime_type',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Media mime type',
        },
      },
      {
        display_name: 'Alt Text',
        uid: 'alt_text',
        data_type: 'text',
        mandatory: false,
      },
      {
        display_name: 'Metadata',
        uid: 'metadata',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Additional metadata captured during export',
        },
      },
    ],
    options: {
      is_page: false,
      singleton: false,
      title: 'file_name',
      sub_title: ['mime_type'],
      url_pattern: '/catalyst-media/{{file_name}}',
      url_prefix: '/catalyst-media',
    },
  },
  {
    title: 'Catalyst Component',
    uid: CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID,
    description: 'Component instances exported from Catalyst Studio',
    schema: [
      {
        display_name: 'Title',
        uid: 'title',
        data_type: 'text',
        mandatory: true,
        field_metadata: {
          description: 'Display title for the component instance',
        },
      },
      {
        display_name: 'Component Type',
        uid: 'component_type',
        data_type: 'text',
        mandatory: true,
        field_metadata: {
          description: 'Original component type identifier',
        },
      },
      {
        display_name: 'Local Only',
        uid: 'local_only',
        data_type: 'boolean',
        mandatory: false,
        field_metadata: {
          description: 'Indicates whether the component is page-scoped',
        },
      },
      {
        display_name: 'Shared Component ID',
        uid: 'shared_id',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Reference to a shared component identifier when applicable',
        },
      },
      {
        display_name: 'Properties',
        uid: 'properties',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Flattened component properties payload',
        },
      },
      {
        display_name: 'Metadata',
        uid: 'metadata',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Export-time metadata such as overrides and shared flags',
        },
      },
      {
        display_name: 'Position',
        uid: 'position',
        data_type: 'number',
        mandatory: false,
      },
    ],
    options: {
      is_page: false,
      singleton: false,
      title: 'title',
      sub_title: ['component_type'],
      url_pattern: '/catalyst-component/{{title}}',
      url_prefix: '/catalyst-component',
    },
  },
  {
    title: 'Catalyst Page',
    uid: CONTENTSTACK_PAGE_CONTENT_TYPE_UID,
    description: 'Page hierarchy exported from Catalyst Studio',
    schema: [
      {
        display_name: 'Title',
        uid: 'title',
        data_type: 'text',
        mandatory: true,
      },
      {
        display_name: 'Slug',
        uid: 'slug',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'URL-friendly slug derived from the page URL',
        },
      },
      {
        display_name: 'URL',
        uid: 'url',
        data_type: 'text',
        mandatory: false,
      },
      {
        display_name: 'Summary',
        uid: 'summary',
        data_type: 'text',
        mandatory: false,
      },
      {
        display_name: 'Content JSON',
        uid: 'content_json',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Raw page content payload as captured during export',
        },
      },
      {
        display_name: 'Metadata',
        uid: 'metadata',
        data_type: 'text',
        mandatory: false,
      },
      {
        display_name: 'Template Key',
        uid: 'template_key',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Template identifier used by Catalyst runtime',
        },
      },
      {
        display_name: 'Template Props',
        uid: 'template_props',
        data_type: 'text',
        mandatory: false,
        field_metadata: {
          description: 'Serialized template props payload',
        },
      },
      {
        display_name: 'Parent Page',
        uid: 'parent',
        data_type: 'reference',
        mandatory: false,
        field_metadata: {
          ref_type: 'Entry',
          ref_multiple: false,
          description: 'Parent page reference for hierarchy reconstruction',
        },
        reference_to: [CONTENTSTACK_PAGE_CONTENT_TYPE_UID],
      },
      {
        display_name: 'Components',
        uid: 'components',
        data_type: 'group',
        multiple: true,
        field_metadata: {
          description: 'Ordered collection of component references for the page layout',
        },
        schema: [
          {
            display_name: 'Display Option',
            uid: 'display_option',
            data_type: 'text',
            mandatory: false,
          },
          {
            display_name: 'Block',
            uid: 'block',
            data_type: 'reference',
            mandatory: false,
            multiple: false,
            field_metadata: {
              ref_type: 'Entry',
              ref_multiple: false,
              description: 'Reference to a Catalyst Component entry',
            },
            reference_to: [CONTENTSTACK_COMPONENT_CONTENT_TYPE_UID],
          },
        ],
      },
    ],
    options: {
      is_page: true,
      singleton: false,
      title: 'title',
      sub_title: ['slug'],
      url_pattern: '/catalyst-page/{{slug}}',
      url_prefix: '/catalyst-page',
    },
  },
];

export const CONTENTSTACK_REQUIRED_HEADERS = ['api_key', 'authorization'] as const;


