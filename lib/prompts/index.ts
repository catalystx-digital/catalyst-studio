/**
 * Main export file for structured prompts system
 */

export * from './types';
export * from './structured-prompts';

// Re-export commonly used items for convenience
export { 
  websiteCreationTemplate,
  contentModelingTemplate,
  deploymentTemplate,
  websiteCreationWorkflow,
  promptTemplates,
  workflows,
  generatePrompt,
  interpolatePrompt,
  getSystemPrompt,
  getSuggestions,
  getTemplatesByCategory,
  getTemplatesByIntent,
  validateVariables
} from './structured-prompts';

export type {
  PromptTemplate,
  PromptCategory,
  PromptIntent,
  StructuredPrompt,
  ProjectContext,
  PromptWorkflow,
  PromptResponse
} from './types';