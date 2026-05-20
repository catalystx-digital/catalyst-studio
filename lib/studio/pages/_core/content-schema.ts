import type { PageTemplateContentSchema } from './types'

export function definePageContentSchema<TSchema extends PageTemplateContentSchema>(
  schema: TSchema
): TSchema {
  return schema
}
