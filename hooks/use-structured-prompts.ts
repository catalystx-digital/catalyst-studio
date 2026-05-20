/**
 * Hook for using structured prompts in the chat
 * Integrates with Vercel AI SDK message handling
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  generatePrompt, 
  interpolatePrompt, 
  getSystemPrompt,
  getSuggestions,
  validateVariables,
  promptTemplates
} from '@/lib/prompts/structured-prompts';
import type { 
  PromptTemplate, 
  ProjectContext, 
  StructuredPrompt 
} from '@/lib/prompts/types';

interface UseStructuredPromptsOptions {
  initialContext?: ProjectContext;
  onPromptGenerated?: (prompt: string, systemPrompt: string) => void;
}

export function useStructuredPrompts(options: UseStructuredPromptsOptions = {}) {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [context, setContext] = useState<ProjectContext>(options.initialContext || {});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Update suggestions when template or context changes
  useEffect(() => {
    if (selectedTemplate) {
      const newSuggestions = getSuggestions(selectedTemplate.id, context);
      setSuggestions(newSuggestions);
    }
  }, [selectedTemplate, context]);

  // Select a template
  const selectTemplate = useCallback((templateId: string) => {
    const template = promptTemplates.get(templateId);
    if (template) {
      setSelectedTemplate(template);
      // Initialize variables with defaults
      const defaultVars: Record<string, any> = {};
      template.variables.forEach(v => {
        if (v.defaultValue !== undefined) {
          defaultVars[v.name] = v.defaultValue;
        }
      });
      setVariables(defaultVars);
      setValidationErrors([]);
    }
  }, []);

  // Update a variable value
  const updateVariable = useCallback((name: string, value: any) => {
    setVariables(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation errors when user updates
    setValidationErrors([]);
  }, []);

  // Update context
  const updateContext = useCallback((updates: Partial<ProjectContext>) => {
    setContext(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Generate the final prompt
  const generateFinalPrompt = useCallback(() => {
    if (!selectedTemplate) {
      console.error('No template selected');
      return null;
    }

    // Validate variables
    const validation = validateVariables(selectedTemplate, variables);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return null;
    }

    // Generate structured prompt
    const structuredPrompt = generatePrompt(
      selectedTemplate.id,
      variables,
      context
    );

    if (!structuredPrompt) {
      console.error('Failed to generate prompt');
      return null;
    }

    // Interpolate variables into prompt
    const userPrompt = interpolatePrompt(structuredPrompt);
    const systemPrompt = getSystemPrompt(selectedTemplate.id);

    // Call callback if provided
    if (options.onPromptGenerated) {
      options.onPromptGenerated(userPrompt, systemPrompt);
    }

    return {
      userPrompt,
      systemPrompt,
      template: selectedTemplate,
      variables,
      context
    };
  }, [selectedTemplate, variables, context, options]);

  // Clear current template and variables
  const clearTemplate = useCallback(() => {
    setSelectedTemplate(null);
    setVariables({});
    setValidationErrors([]);
    setSuggestions([]);
  }, []);

  // Get available templates for a category
  const getTemplatesForCategory = useCallback((category: string) => {
    return Array.from(promptTemplates.values()).filter(t => t.category === category);
  }, []);

  // Apply a suggestion
  const applySuggestion = useCallback((suggestion: string) => {
    // This would typically update variables or context based on the suggestion
    // For now, we'll return the suggestion text to be used directly
    return suggestion;
  }, []);

  return {
    // State
    selectedTemplate,
    variables,
    context,
    suggestions,
    validationErrors,
    
    // Actions
    selectTemplate,
    updateVariable,
    updateContext,
    generateFinalPrompt,
    clearTemplate,
    getTemplatesForCategory,
    applySuggestion,
    
    // Utilities
    availableTemplates: Array.from(promptTemplates.values())
  };
}

// Hook for managing conversation context
export function useConversationContext() {
  const [context, setContext] = useState<ProjectContext>({
    currentStage: 'planning'
  });

  const updateProjectInfo = useCallback((name: string, description: string) => {
    setContext(prev => ({
      ...prev,
      projectName: name,
      projectDescription: description
    }));
  }, []);

  const setStage = useCallback((stage: ProjectContext['currentStage']) => {
    setContext(prev => ({
      ...prev,
      currentStage: stage
    }));
  }, []);

  const addContentType = useCallback((contentType: any) => {
    setContext(prev => ({
      ...prev,
      contentTypes: [...(prev.contentTypes || []), contentType]
    }));
  }, []);

  const setDesignPreferences = useCallback((preferences: any) => {
    setContext(prev => ({
      ...prev,
      designPreferences: preferences
    }));
  }, []);

  const setTechnicalRequirements = useCallback((requirements: any) => {
    setContext(prev => ({
      ...prev,
      technicalRequirements: requirements
    }));
  }, []);

  return {
    context,
    updateProjectInfo,
    setStage,
    addContentType,
    setDesignPreferences,
    setTechnicalRequirements,
    resetContext: () => setContext({ currentStage: 'planning' })
  };
}