/**
 * Structured Prompt System Types
 * Defines the TypeScript interfaces for prompt templates and workflows
 */

export type PromptCategory = 
  | 'website-creation'
  | 'content-modeling' 
  | 'deployment'
  | 'design'
  | 'optimization'
  | 'troubleshooting'
  | 'universal-type-generation';

export type PromptIntent = 
  | 'create'
  | 'modify'
  | 'analyze'
  | 'deploy'
  | 'debug'
  | 'optimize';

export interface PromptTemplate {
  id: string;
  name: string;
  category: PromptCategory;
  intent: PromptIntent;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: PromptVariable[];
  followUpSuggestions: string[];
  contextRequirements?: string[];
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any;
  validationRules?: ValidationRule[];
  placeholder?: string;
  options?: string[]; // For select/dropdown types
}

export interface ValidationRule {
  type: 'minLength' | 'maxLength' | 'pattern' | 'custom';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  message: string;
}

export interface StructuredPrompt {
  template: PromptTemplate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, any>;
  context?: ProjectContext;
}

export interface ProjectContext {
  projectName?: string;
  projectDescription?: string;
  targetAudience?: string;
  industry?: string;
  contentTypes?: ContentType[];
  designPreferences?: DesignPreferences;
  technicalRequirements?: TechnicalRequirements;
  currentStage?: 'planning' | 'design' | 'development' | 'testing' | 'deployment';
  dynamicTypes?: UniversalTypeContext;
}

export interface UniversalTypeContext {
  websiteId: string;
  availableTypes: string[];
  existingContentTypes: Array<{
    name: string;
    category: 'page' | 'component';
    fields: Array<{ name: string; type: string; required: boolean }>;
  }>;
  reusableComponents: string[];
  commonProperties: Array<{ name: string; type: string; usage: number }>;
  sessionTypes?: Array<{ name: string; createdAt: Date }>;
}

export interface ContentType {
  id: string;
  name: string;
  category: 'page' | 'component';
  fields: ContentField[];
  purpose: string;
}

export interface ContentField {
  name: string;
  type: string;
  required: boolean;
  validation?: string;
}

export interface DesignPreferences {
  style?: 'modern' | 'classic' | 'minimalist' | 'bold' | 'playful';
  colorScheme?: 'light' | 'dark' | 'custom';
  primaryColor?: string;
  secondaryColor?: string;
  typography?: 'serif' | 'sans-serif' | 'custom';
}

export interface TechnicalRequirements {
  framework?: string;
  database?: string;
  hosting?: string;
  integrations?: string[];
  performance?: 'standard' | 'optimized' | 'maximum';
  seo?: boolean;
  analytics?: boolean;
}

export interface PromptWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  category: PromptCategory;
}

export interface WorkflowStep {
  id: string;
  name: string;
  promptTemplateId: string;
  order: number;
  isOptional: boolean;
  conditions?: StepCondition[];
  nextStepId?: string;
}

export interface StepCondition {
  variable: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

export interface PromptResponse {
  promptId: string;
  userInput: string;
  systemPrompt: string;
  response: string;
  timestamp: Date;
  context?: ProjectContext;
  suggestions?: string[];
}