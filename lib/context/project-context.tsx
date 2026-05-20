'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ProjectContext as ProjectContextType, ContentType } from '@/lib/prompts/types';

interface ConversationMetadata {
  topicHistory: string[];
  currentIntent?: 'create' | 'modify' | 'analyze' | 'deploy' | 'debug' | 'optimize';
  lastActivity: Date;
  messageCount: number;
}

interface ProjectContextState extends ProjectContextType {
  conversationMetadata: ConversationMetadata;
}

interface ProjectContextValue {
  context: ProjectContextState;
  updateProjectInfo: (name: string, description: string) => void;
  setStage: (stage: ProjectContextType['currentStage']) => void;
  addContentType: (contentType: ContentType) => void;
  removeContentType: (contentTypeId: string) => void;
  setDesignPreferences: (preferences: ProjectContextType['designPreferences']) => void;
  setTechnicalRequirements: (requirements: ProjectContextType['technicalRequirements']) => void;
  addTopic: (topic: string) => void;
  setIntent: (intent: ConversationMetadata['currentIntent']) => void;
  incrementMessageCount: () => void;
  resetContext: () => void;
  exportContext: () => string;
  importContext: (contextString: string) => boolean;
}

const defaultContext: ProjectContextState = {
  currentStage: 'planning',
  conversationMetadata: {
    topicHistory: [],
    lastActivity: new Date(),
    messageCount: 0
  }
};

const ProjectContextContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectContextProvider({ 
  children,
  initialContext
}: { 
  children: ReactNode;
  initialContext?: Partial<ProjectContextState>;
}) {
  const [context, setContext] = useState<ProjectContextState>({
    ...defaultContext,
    ...initialContext
  });

  const updateProjectInfo = useCallback((name: string, description: string) => {
    setContext(prev => ({
      ...prev,
      projectName: name,
      projectDescription: description,
      conversationMetadata: {
        ...prev.conversationMetadata,
        lastActivity: new Date()
      }
    }));
  }, []);

  const setStage = useCallback((stage: ProjectContextType['currentStage']) => {
    setContext(prev => ({
      ...prev,
      currentStage: stage,
      conversationMetadata: {
        ...prev.conversationMetadata,
        lastActivity: new Date()
      }
    }));
  }, []);

  const addContentType = useCallback((contentType: ContentType) => {
    setContext(prev => ({
      ...prev,
      contentTypes: [...(prev.contentTypes || []), contentType],
      conversationMetadata: {
        ...prev.conversationMetadata,
        lastActivity: new Date()
      }
    }));
  }, []);

  const removeContentType = useCallback((contentTypeId: string) => {
    setContext(prev => ({
      ...prev,
      contentTypes: prev.contentTypes?.filter(ct => ct.id !== contentTypeId),
      conversationMetadata: {
        ...prev.conversationMetadata,
        lastActivity: new Date()
      }
    }));
  }, []);

  const setDesignPreferences = useCallback((preferences: ProjectContextType['designPreferences']) => {
    setContext(prev => ({
      ...prev,
      designPreferences: preferences,
      conversationMetadata: {
        ...prev.conversationMetadata,
        lastActivity: new Date()
      }
    }));
  }, []);

  const setTechnicalRequirements = useCallback((requirements: ProjectContextType['technicalRequirements']) => {
    setContext(prev => ({
      ...prev,
      technicalRequirements: requirements,
      conversationMetadata: {
        ...prev.conversationMetadata,
        lastActivity: new Date()
      }
    }));
  }, []);

  const addTopic = useCallback((topic: string) => {
    setContext(prev => {
      const topicHistory = [...prev.conversationMetadata.topicHistory];
      if (!topicHistory.includes(topic)) {
        topicHistory.push(topic);
      }
      return {
        ...prev,
        conversationMetadata: {
          ...prev.conversationMetadata,
          topicHistory,
          lastActivity: new Date()
        }
      };
    });
  }, []);

  const setIntent = useCallback((intent: ConversationMetadata['currentIntent']) => {
    setContext(prev => ({
      ...prev,
      conversationMetadata: {
        ...prev.conversationMetadata,
        currentIntent: intent,
        lastActivity: new Date()
      }
    }));
  }, []);

  const incrementMessageCount = useCallback(() => {
    setContext(prev => ({
      ...prev,
      conversationMetadata: {
        ...prev.conversationMetadata,
        messageCount: prev.conversationMetadata.messageCount + 1,
        lastActivity: new Date()
      }
    }));
  }, []);

  const resetContext = useCallback(() => {
    setContext(defaultContext);
  }, []);

  const exportContext = useCallback(() => {
    return JSON.stringify(context, null, 2);
  }, [context]);

  const importContext = useCallback((contextString: string) => {
    try {
      const imported = JSON.parse(contextString);
      setContext({
        ...defaultContext,
        ...imported,
        conversationMetadata: {
          ...defaultContext.conversationMetadata,
          ...imported.conversationMetadata,
          lastActivity: new Date(imported.conversationMetadata?.lastActivity || Date.now())
        }
      });
      return true;
    } catch (error) {
      console.error('Failed to import context:', error);
      return false;
    }
  }, []);

  const value: ProjectContextValue = {
    context,
    updateProjectInfo,
    setStage,
    addContentType,
    removeContentType,
    setDesignPreferences,
    setTechnicalRequirements,
    addTopic,
    setIntent,
    incrementMessageCount,
    resetContext,
    exportContext,
    importContext
  };

  return (
    <ProjectContextContext.Provider value={value}>
      {children}
    </ProjectContextContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContextContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectContextProvider');
  }
  return context;
}

// Alias for convenience
export const useProject = () => {
  const { context } = useProjectContext();
  return {
    selectedProject: context.projectName ? {
      id: '1',
      name: context.projectName,
      description: context.projectDescription || ''
    } : null
  };
};

// Higher-order component for wrapping components with project context
export function withProjectContext<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithProjectContextComponent(props: P) {
    return (
      <ProjectContextProvider>
        <Component {...props} />
      </ProjectContextProvider>
    );
  };
}

// Hook for injecting context into prompts
export function useContextInjection() {
  const { context } = useProjectContext();
  
  const injectContext = useCallback((prompt: string): string => {
    const contextInfo: string[] = [];
    
    if (context.projectName) {
      contextInfo.push(`Project: ${context.projectName}`);
    }
    
    if (context.projectDescription) {
      contextInfo.push(`Description: ${context.projectDescription}`);
    }
    
    if (context.currentStage) {
      contextInfo.push(`Current Stage: ${context.currentStage}`);
    }
    
    if (context.targetAudience) {
      contextInfo.push(`Target Audience: ${context.targetAudience}`);
    }
    
    if (context.industry) {
      contextInfo.push(`Industry: ${context.industry}`);
    }
    
    if (context.contentTypes && context.contentTypes.length > 0) {
      const contentTypeNames = context.contentTypes.map(ct => ct.name).join(', ');
      contextInfo.push(`Content Types: ${contentTypeNames}`);
    }
    
    if (context.designPreferences) {
      const { style, colorScheme } = context.designPreferences;
      if (style) contextInfo.push(`Design Style: ${style}`);
      if (colorScheme) contextInfo.push(`Color Scheme: ${colorScheme}`);
    }
    
    if (context.technicalRequirements) {
      const { framework, database, hosting } = context.technicalRequirements;
      if (framework) contextInfo.push(`Framework: ${framework}`);
      if (database) contextInfo.push(`Database: ${database}`);
      if (hosting) contextInfo.push(`Hosting: ${hosting}`);
    }
    
    if (context.conversationMetadata.topicHistory.length > 0) {
      contextInfo.push(`Previous Topics: ${context.conversationMetadata.topicHistory.slice(-3).join(', ')}`);
    }
    
    if (contextInfo.length === 0) {
      return prompt;
    }
    
    return `Context:\n${contextInfo.join('\n')}\n\n${prompt}`;
  }, [context]);
  
  return { injectContext };
}

// Utility to analyze user intent from message
export function analyzeIntent(message: string): ConversationMetadata['currentIntent'] | undefined {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('create') || lowerMessage.includes('build') || lowerMessage.includes('make')) {
    return 'create';
  }
  if (lowerMessage.includes('change') || lowerMessage.includes('modify') || lowerMessage.includes('update')) {
    return 'modify';
  }
  if (lowerMessage.includes('analyze') || lowerMessage.includes('review') || lowerMessage.includes('check')) {
    return 'analyze';
  }
  if (lowerMessage.includes('deploy') || lowerMessage.includes('publish') || lowerMessage.includes('launch')) {
    return 'deploy';
  }
  if (lowerMessage.includes('debug') || lowerMessage.includes('fix') || lowerMessage.includes('error')) {
    return 'debug';
  }
  if (lowerMessage.includes('optimize') || lowerMessage.includes('improve') || lowerMessage.includes('performance')) {
    return 'optimize';
  }
  
  return undefined;
}

// Export types
export type { ProjectContextState, ProjectContextValue, ConversationMetadata };