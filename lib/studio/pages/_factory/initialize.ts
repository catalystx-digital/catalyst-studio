import { pageTemplateFactory } from './page-factory'

let initializationPromise: Promise<void> | null = null

export async function initializePageTemplates(): Promise<void> {
  if (pageTemplateFactory.isInitialized()) {
    return
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        const modules = await Promise.all([
          import('../core/generic/register'),
          import('../core/folder/register'),
          import('../marketing/home/register'),
          import('../blog/index/register'),
          import('../blog/post/register'),
          import('../commerce/product-detail/register')
        ])

        for (const mod of modules) {
          if (typeof mod.registerTemplate === 'function') {
            mod.registerTemplate()
          }
        }

        pageTemplateFactory.markInitialized()
      } catch (error) {
        pageTemplateFactory.clearRegistry()
        pageTemplateFactory.markUninitialized()
        throw error
      }
    })().finally(() => {
      initializationPromise = null
    })
  }

  return initializationPromise
}

export function resetPageTemplateInitialization(): void {
  pageTemplateFactory.clearRegistry()
  initializationPromise = null
}
