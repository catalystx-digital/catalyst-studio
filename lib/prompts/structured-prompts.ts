/**
 * Structured Prompt Templates Library
 * Provides pre-built templates for common workflows
 */

import type { 
  PromptTemplate, 
  PromptWorkflow, 
  StructuredPrompt,
  ProjectContext,
  PromptCategory,
  PromptIntent,
  UniversalTypeContext
} from './types';

// Website Creation Templates
export const websiteCreationTemplate: PromptTemplate = {
  id: 'website-creation-basic',
  name: 'Basic Website Creation',
  category: 'website-creation',
  intent: 'create',
  description: 'Guide user through creating a basic website structure',
  systemPrompt: `You are an expert web developer and designer helping to create a website. 
    Focus on understanding the user's needs and generating appropriate content and structure.
    Always consider best practices for UX, accessibility, and performance.`,
  userPromptTemplate: `I want to create a website for {{businessType}} that {{primaryGoal}}.
    The target audience is {{targetAudience}}.
    Key features needed: {{features}}
    Design preference: {{designStyle}}`,
  variables: [
    {
      name: 'businessType',
      type: 'string',
      required: true,
      description: 'Type of business or organization',
      placeholder: 'e.g., restaurant, law firm, online store'
    },
    {
      name: 'primaryGoal',
      type: 'string',
      required: true,
      description: 'Main goal of the website',
      placeholder: 'e.g., showcases our services, sells products online'
    },
    {
      name: 'targetAudience',
      type: 'string',
      required: true,
      description: 'Primary target audience',
      placeholder: 'e.g., small business owners, young professionals'
    },
    {
      name: 'features',
      type: 'array',
      required: false,
      description: 'List of desired features',
      defaultValue: []
    },
    {
      name: 'designStyle',
      type: 'string',
      required: false,
      description: 'Preferred design style',
      options: ['modern', 'classic', 'minimalist', 'bold', 'playful'],
      defaultValue: 'modern'
    }
  ],
  followUpSuggestions: [
    'Add contact form',
    'Include testimonials section',
    'Add newsletter signup',
    'Create about us page',
    'Add social media links'
  ]
};

export const contentModelingTemplate: PromptTemplate = {
  id: 'content-modeling-basic',
  name: 'Content Type Modeling',
  category: 'content-modeling',
  intent: 'create',
  description: 'Help define content types and their structure',
  systemPrompt: `You are a content strategist helping to define content models.
    Focus on creating clear, reusable content types with appropriate fields.
    Consider relationships between content types and data validation needs.`,
  userPromptTemplate: `I need to model content for {{contentPurpose}}.
    The main content types are: {{contentTypes}}.
    Each content item should include: {{requiredFields}}.
    Additional requirements: {{additionalRequirements}}`,
  variables: [
    {
      name: 'contentPurpose',
      type: 'string',
      required: true,
      description: 'Purpose of the content',
      placeholder: 'e.g., blog posts, product catalog, portfolio'
    },
    {
      name: 'contentTypes',
      type: 'array',
      required: true,
      description: 'List of content types needed',
      defaultValue: []
    },
    {
      name: 'requiredFields',
      type: 'array',
      required: true,
      description: 'Common fields across content types',
      defaultValue: ['title', 'description']
    },
    {
      name: 'additionalRequirements',
      type: 'string',
      required: false,
      description: 'Any special requirements',
      defaultValue: ''
    }
  ],
  followUpSuggestions: [
    'Add media fields',
    'Define relationships',
    'Add metadata fields',
    'Create taxonomies',
    'Add SEO fields'
  ]
};

// Universal Type Generation Template
export const universalTypeGenerationTemplate: PromptTemplate = {
  id: 'universal-type-generation',
  name: 'Universal Type Generation',
  category: 'universal-type-generation',
  intent: 'create',
  description: 'Generate content types using hybrid static/dynamic system',
  systemPrompt: `You are an expert content architect generating universal content types.
    Use the dynamic context to avoid duplication and reuse existing components.
    Follow the generation rules and validate against available primitive types.`,
  userPromptTemplate: `Generate a {{contentCategory}} type for {{purpose}}.
    
    Available Types: {{dynamicTypes.availableTypes}}
    Existing Types: {{dynamicTypes.existingContentTypes}}
    Reusable Components: {{dynamicTypes.reusableComponents}}
    
    Requirements:
    - Must not duplicate existing types
    - Use only available primitive types
    - Reuse components where applicable
    - Include proper validation rules`,
  variables: [
    {
      name: 'contentCategory',
      type: 'string',
      required: true,
      description: 'Category of content type (page or component)',
      options: ['page', 'component']
    },
    {
      name: 'purpose',
      type: 'string',
      required: true,
      description: 'Purpose or use case for the content type',
      placeholder: 'e.g., blog articles, product listings, hero sections'
    },
    {
      name: 'dynamicTypes',
      type: 'object',
      required: true,
      description: 'Dynamic type context loaded from system'
    }
  ],
  followUpSuggestions: [
    'Add validation rules',
    'Create relationships',
    'Generate example content',
    'Test type compatibility'
  ],
  contextRequirements: ['websiteId', 'dynamicTypes']
};

export const deploymentTemplate: PromptTemplate = {
  id: 'deployment-basic',
  name: 'Deployment Configuration',
  category: 'deployment',
  intent: 'deploy',
  description: 'Guide through deployment process and configuration',
  systemPrompt: `You are a DevOps expert helping with deployment.
    Focus on security, performance, and reliability best practices.
    Provide clear steps and consider the user's technical level.`,
  userPromptTemplate: `I want to deploy {{projectType}} to {{platform}}.
    Current environment: {{environment}}.
    Technical constraints: {{constraints}}.
    Budget: {{budget}}`,
  variables: [
    {
      name: 'projectType',
      type: 'string',
      required: true,
      description: 'Type of project to deploy',
      placeholder: 'e.g., Next.js app, static site, API'
    },
    {
      name: 'platform',
      type: 'string',
      required: true,
      description: 'Target deployment platform',
      options: ['Vercel', 'Netlify', 'AWS', 'Heroku', 'Self-hosted'],
      placeholder: 'Select platform'
    },
    {
      name: 'environment',
      type: 'string',
      required: true,
      description: 'Deployment environment',
      options: ['development', 'staging', 'production'],
      defaultValue: 'production'
    },
    {
      name: 'constraints',
      type: 'string',
      required: false,
      description: 'Any technical constraints',
      defaultValue: 'none'
    },
    {
      name: 'budget',
      type: 'string',
      required: false,
      description: 'Budget considerations',
      options: ['free tier', 'low budget', 'standard', 'enterprise'],
      defaultValue: 'standard'
    }
  ],
  followUpSuggestions: [
    'Configure environment variables',
    'Set up custom domain',
    'Enable SSL certificate',
    'Configure CDN',
    'Set up monitoring'
  ]
};

// Workflow Definitions
export const websiteCreationWorkflow: PromptWorkflow = {
  id: 'website-creation-workflow',
  name: 'Complete Website Creation',
  description: 'Step-by-step workflow for creating a complete website',
  category: 'website-creation',
  steps: [
    {
      id: 'step-1',
      name: 'Define Website Purpose',
      promptTemplateId: 'website-creation-basic',
      order: 1,
      isOptional: false,
      nextStepId: 'step-2'
    },
    {
      id: 'step-2',
      name: 'Model Content Types',
      promptTemplateId: 'content-modeling-basic',
      order: 2,
      isOptional: false,
      nextStepId: 'step-3'
    },
    {
      id: 'step-3',
      name: 'Configure Deployment',
      promptTemplateId: 'deployment-basic',
      order: 3,
      isOptional: true,
      conditions: [
        {
          variable: 'readyToDeploy',
          operator: 'equals',
          value: true
        }
      ]
    }
  ]
};

// Template Registry
export const promptTemplates = new Map<string, PromptTemplate>([
  ['website-creation-basic', websiteCreationTemplate],
  ['content-modeling-basic', contentModelingTemplate],
  ['deployment-basic', deploymentTemplate],
  ['universal-type-generation', universalTypeGenerationTemplate]
]);

export const workflows = new Map<string, PromptWorkflow>([
  ['website-creation-workflow', websiteCreationWorkflow]
]);

// Helper Functions
export function generatePrompt(
  templateId: string, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, any>,
  context?: ProjectContext
): StructuredPrompt | null {
  const template = promptTemplates.get(templateId);
  if (!template) {
    console.error(`Template ${templateId} not found`);
    return null;
  }

  // Validate required variables
  for (const variable of template.variables) {
    if (variable.required && !variables[variable.name]) {
      console.error(`Required variable ${variable.name} not provided`);
      return null;
    }
  }

  return {
    template,
    variables,
    context
  };
}

export function interpolatePrompt(prompt: StructuredPrompt): string {
  let interpolated = prompt.template.userPromptTemplate;
  
  // Replace variables in template
  for (const [key, value] of Object.entries(prompt.variables)) {
    const placeholder = `{{${key}}}`;
    const replacement = Array.isArray(value) ? value.join(', ') : String(value);
    interpolated = interpolated.replace(new RegExp(placeholder, 'g'), replacement);
  }
  
  // Add context if available
  if (prompt.context) {
    interpolated += `\n\nContext: Project "${prompt.context.projectName || 'Unnamed'}" - ${prompt.context.projectDescription || 'No description'}`;
    if (prompt.context.currentStage) {
      interpolated += `\nCurrent Stage: ${prompt.context.currentStage}`;
    }
  }
  
  return interpolated;
}

export function getSystemPrompt(templateId: string): string {
  const template = promptTemplates.get(templateId);
  return template?.systemPrompt || 'You are a helpful AI assistant.';
}

export function getSuggestions(templateId: string, context?: ProjectContext): string[] {
  const template = promptTemplates.get(templateId);
  if (!template) return [];
  
  const suggestions = [...template.followUpSuggestions];
  
  // Add context-aware suggestions
  if (context) {
    if (context.currentStage === 'planning') {
      suggestions.push('Define requirements', 'Create wireframes');
    } else if (context.currentStage === 'development') {
      suggestions.push('Add more features', 'Test functionality');
    } else if (context.currentStage === 'deployment') {
      suggestions.push('Configure domain', 'Set up monitoring');
    }
  }
  
  return suggestions;
}

export function getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
  return Array.from(promptTemplates.values()).filter(t => t.category === category);
}

export function getTemplatesByIntent(intent: PromptIntent): PromptTemplate[] {
  return Array.from(promptTemplates.values()).filter(t => t.intent === intent);
}

export function validateVariables(
  template: PromptTemplate, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const varDef of template.variables) {
    const value = variables[varDef.name];
    
    // Check required
    if (varDef.required && (value === undefined || value === null || value === '')) {
      errors.push(`${varDef.name} is required`);
      continue;
    }
    
    // Check type
    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== varDef.type && !(varDef.type === 'array' && !Array.isArray(value))) {
        errors.push(`${varDef.name} must be of type ${varDef.type}`);
      }
      
      // Check validation rules
      if (varDef.validationRules) {
        for (const rule of varDef.validationRules) {
          if (rule.type === 'minLength' && String(value).length < rule.value) {
            errors.push(rule.message);
          }
          if (rule.type === 'maxLength' && String(value).length > rule.value) {
            errors.push(rule.message);
          }
          if (rule.type === 'pattern' && !new RegExp(rule.value).test(String(value))) {
            errors.push(rule.message);
          }
        }
      }
      
      // Check options
      if (varDef.options && !varDef.options.includes(value)) {
        errors.push(`${varDef.name} must be one of: ${varDef.options.join(', ')}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}