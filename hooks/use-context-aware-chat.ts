/**
 * Hook for integrating project context with chat functionality
 * Tracks conversation topics and injects context into prompts
 */

'use client';

import { useCallback, useEffect } from 'react';
import { useProjectContext, useContextInjection, analyzeIntent } from '@/lib/context/project-context';
import type { Message } from '@/components/chat/message-list-simple';

interface UseContextAwareChatOptions {
  autoTrackTopics?: boolean;
  autoInjectContext?: boolean;
  persistContext?: boolean;
}

export function useContextAwareChat(options: UseContextAwareChatOptions = {}) {
  const {
    autoTrackTopics = true,
    autoInjectContext = true,
    persistContext = true
  } = options;

  const {
    context,
    addTopic,
    setIntent,
    incrementMessageCount,
    exportContext,
    importContext
  } = useProjectContext();

  const { injectContext } = useContextInjection();

  // Load persisted context on mount
  useEffect(() => {
    if (persistContext && typeof window !== 'undefined') {
      const stored = localStorage.getItem('project-context');
      if (stored) {
        importContext(stored);
      }
    }
  }, [persistContext, importContext]);

  // Save context changes
  useEffect(() => {
    if (persistContext && typeof window !== 'undefined') {
      const contextString = exportContext();
      localStorage.setItem('project-context', contextString);
    }
  }, [persistContext, context, exportContext]);

  // Process user message for context tracking
  const processUserMessage = useCallback((message: string) => {
    // Track message count
    incrementMessageCount();

    // Analyze and set intent
    const intent = analyzeIntent(message);
    if (intent) {
      setIntent(intent);
    }

    // Extract and track topics
    if (autoTrackTopics) {
      const topics = extractTopics(message);
      topics.forEach(topic => addTopic(topic));
    }

    // Inject context if enabled
    if (autoInjectContext) {
      return injectContext(message);
    }

    return message;
  }, [
    incrementMessageCount,
    setIntent,
    autoTrackTopics,
    autoInjectContext,
    addTopic,
    injectContext
  ]);

  // Process AI response for context updates
  const processAIResponse = useCallback((response: string) => {
    // Could extract additional context from AI responses
    // For example, if AI mentions specific technologies or frameworks
    
    return response;
  }, []);

  // Get context-aware suggestions
  const getContextualSuggestions = useCallback((): string[] => {
    const suggestions: string[] = [];
    
    // Stage-based suggestions
    switch (context.currentStage) {
      case 'planning':
        suggestions.push(
          'Define the main purpose of the website',
          'Identify target audience',
          'List key features needed'
        );
        break;
      case 'design':
        suggestions.push(
          'Choose a color scheme',
          'Select typography',
          'Create page layouts'
        );
        break;
      case 'development':
        suggestions.push(
          'Add new feature',
          'Connect to database',
          'Implement authentication'
        );
        break;
      case 'testing':
        suggestions.push(
          'Run tests',
          'Check mobile responsiveness',
          'Validate forms'
        );
        break;
      case 'deployment':
        suggestions.push(
          'Deploy to Vercel',
          'Configure domain',
          'Set up SSL'
        );
        break;
    }
    
    // Intent-based suggestions
    if (context.conversationMetadata.currentIntent) {
      switch (context.conversationMetadata.currentIntent) {
        case 'create':
          suggestions.push('Create a new page', 'Add content type');
          break;
        case 'modify':
          suggestions.push('Change design', 'Update content');
          break;
        case 'deploy':
          suggestions.push('Check deployment status', 'Configure environment');
          break;
      }
    }
    
    // Project-specific suggestions
    if (context.projectName) {
      suggestions.push(`Tell me more about ${context.projectName}`);
    }
    
    if (context.contentTypes && context.contentTypes.length > 0) {
      suggestions.push('Add more content', 'Modify content structure');
    }
    
    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }, [context]);

  // Get conversation summary
  const getConversationSummary = useCallback(() => {
    return {
      projectName: context.projectName || 'Unnamed Project',
      stage: context.currentStage || 'planning',
      messageCount: context.conversationMetadata.messageCount,
      topics: context.conversationMetadata.topicHistory.slice(-5),
      lastActivity: context.conversationMetadata.lastActivity,
      hasDesignPreferences: !!context.designPreferences,
      hasTechnicalRequirements: !!context.technicalRequirements,
      contentTypeCount: context.contentTypes?.length || 0
    };
  }, [context]);

  return {
    context,
    processUserMessage,
    processAIResponse,
    getContextualSuggestions,
    getConversationSummary,
    exportContext,
    importContext
  };
}

// Helper function to extract topics from message
function extractTopics(message: string): string[] {
  const topics: string[] = [];
  const lowerMessage = message.toLowerCase();
  
  // Keywords that indicate topics
  const topicKeywords = {
    'website': ['website', 'site', 'web page', 'landing page'],
    'design': ['design', 'color', 'theme', 'style', 'layout'],
    'content': ['content', 'text', 'copy', 'article', 'blog'],
    'navigation': ['menu', 'navigation', 'nav', 'header', 'footer'],
    'forms': ['form', 'contact', 'signup', 'login', 'register'],
    'ecommerce': ['shop', 'store', 'product', 'cart', 'checkout'],
    'seo': ['seo', 'search', 'google', 'ranking', 'optimization'],
    'performance': ['speed', 'performance', 'fast', 'optimize', 'load'],
    'mobile': ['mobile', 'responsive', 'phone', 'tablet'],
    'deployment': ['deploy', 'host', 'vercel', 'domain', 'publish']
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      topics.push(topic);
    }
  }
  
  return topics;
}

// Export for testing
export { extractTopics };