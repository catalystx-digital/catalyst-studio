import { pageTemplateFactory } from '../../_factory/page-factory'
import { PageTemplateCategory } from '../../_core/types'
import type { TemplateManifest } from '../../_core/manifest'
import { definePageContentSchema } from '../../_core/content-schema'
import { FOLDER_TEMPLATE_KEY } from '../../_core/constants'

const manifest: TemplateManifest = {
  registration: {
    templateKey: FOLDER_TEMPLATE_KEY,
    name: 'Navigation Folder',
    category: PageTemplateCategory.Core,
    isHomeEligible: false,
    description: 'Non-routable navigation container used for grouping pages within the site tree.',
    requiredRegions: [],
    optionalRegions: [],
    contentSchema: definePageContentSchema({
      components: {
        type: 'content[]',
        required: false,
        description: 'Optional components rendered for folder landing experiences.',
        allowedComponentTypes: []
      }
    }),
    aiMetadata: {
      keywords: ['folder', 'directory', 'navigation group', 'site structure'],
      layoutGuidelines: [
        'Folders do not render visible content by default; they act as structural nodes.',
        'Only assign components when the folder should render a landing experience.'
      ],
      contentGuidelines: [
        'Use folders to organize related pages. Avoid assigning marketing content unless the folder should be a landing page.'
      ],
      recommendedComponents: [],
      routeHints: []
    }
  }
}

export function registerTemplate(): void {
  if (pageTemplateFactory.getTemplate(FOLDER_TEMPLATE_KEY)) {
    return
  }

  pageTemplateFactory.registerManifest(manifest)
}


