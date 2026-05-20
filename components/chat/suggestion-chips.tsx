'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, Sparkles, Plus, Code, Rocket, Settings } from 'lucide-react';
import { useEnhancedChat } from './enhanced-chat-panel';
import { getSuggestions } from '@/lib/prompts';
import { useProjectContext } from '@/lib/context/project-context';

interface SuggestionChip {
  id: string;
  text: string;
  icon?: React.ReactNode;
  category?: 'quick-action' | 'content' | 'deploy' | 'customize';
  action?: () => void;
}

interface SuggestionChipsProps {
  onSuggestionClick?: (suggestion: string) => void;
  className?: string;
}

export default function SuggestionChips({ 
  onSuggestionClick,
  className = '' 
}: SuggestionChipsProps) {
  const [suggestions, setSuggestions] = useState<SuggestionChip[]>([]);
  const [isVisible] = useState(true);
  const { structuredPrompts } = useEnhancedChat();
  const { context: projectContext } = useProjectContext();

  // Generate context-aware suggestions
  useEffect(() => {
    const generateSuggestions = () => {
      const chips: SuggestionChip[] = [];
      
      // Get template-based suggestions if a template is selected
      if (structuredPrompts?.selectedTemplate) {
        const templateSuggestions = getSuggestions(
          structuredPrompts.selectedTemplate.id,
          projectContext
        );
        
        templateSuggestions.slice(0, 3).forEach((text, index) => {
          chips.push({
            id: `template-${index}`,
            text,
            icon: <Sparkles className="w-3 h-3" />,
            category: 'quick-action'
          });
        });
      }
      
      // Add context-aware suggestions based on project stage
      const stage = projectContext?.currentStage;
      if (stage === 'planning') {
        chips.push(
          {
            id: 'plan-1',
            text: 'Create website structure',
            icon: <Code className="w-3 h-3" />,
            category: 'content'
          },
          {
            id: 'plan-2',
            text: 'Define content types',
            icon: <Plus className="w-3 h-3" />,
            category: 'content'
          }
        );
      } else if (stage === 'development') {
        chips.push(
          {
            id: 'dev-1',
            text: 'Add newsletter signup',
            icon: <Plus className="w-3 h-3" />,
            category: 'content'
          },
          {
            id: 'dev-2',
            text: 'Customize design',
            icon: <Settings className="w-3 h-3" />,
            category: 'customize'
          }
        );
      } else if (stage === 'deployment') {
        chips.push(
          {
            id: 'deploy-1',
            text: 'Deploy to Vercel',
            icon: <Rocket className="w-3 h-3" />,
            category: 'deploy'
          },
          {
            id: 'deploy-2',
            text: 'Configure domain',
            icon: <Settings className="w-3 h-3" />,
            category: 'deploy'
          }
        );
      }
      
      // Default suggestions if no context
      if (chips.length === 0) {
        chips.push(
          {
            id: 'default-1',
            text: 'Create a website',
            icon: <Sparkles className="w-3 h-3" />,
            category: 'quick-action'
          },
          {
            id: 'default-2',
            text: 'Add content',
            icon: <Plus className="w-3 h-3" />,
            category: 'content'
          },
          {
            id: 'default-3',
            text: 'More options',
            icon: <ChevronRight className="w-3 h-3" />,
            category: 'quick-action'
          }
        );
      }
      
      setSuggestions(chips);
    };
    
    generateSuggestions();
  }, [structuredPrompts, projectContext]);

  const handleChipClick = (chip: SuggestionChip) => {
    if (chip.action) {
      chip.action();
    } else if (onSuggestionClick) {
      onSuggestionClick(chip.text);
    }
    
    // Optionally hide chips after selection
    // setIsVisible(false);
  };

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  const getCategoryStyles = (category?: string) => {
    switch (category) {
      case 'quick-action':
        return 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800';
      case 'content':
        return 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800';
      case 'deploy':
        return 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800';
      case 'customize':
        return 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300 dark:border-orange-800';
      default:
        return 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  return (
    <div className={`suggestion-chips-container ${className}`}>
      <div className="flex flex-wrap gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400 self-center mr-2">
          Suggestions:
        </span>
        {suggestions.map((chip) => (
          <button
            key={chip.id}
            onClick={() => handleChipClick(chip)}
            className={`
              suggestion-chip 
              inline-flex items-center gap-1.5 
              px-3 py-1.5 
              text-sm font-medium 
              border rounded-full 
              transition-all duration-200 
              transform hover:scale-105 
              focus:outline-none focus:ring-2 focus:ring-offset-1 
              ${getCategoryStyles(chip.category)}
            `}
            aria-label={`Suggestion: ${chip.text}`}
          >
            {chip.icon}
            <span>{chip.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Export for testing
export type { SuggestionChip, SuggestionChipsProps };