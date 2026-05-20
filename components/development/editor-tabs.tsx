'use client';

import React, { useCallback, useEffect } from 'react';
import { X, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorTab {
  id: string;
  name: string;
  path: string;
  extension?: string;
  isDirty?: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId?: string;
  onTabSelect?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  className?: string;
}

const getFileIcon = (extension?: string) => {
  const iconClass = "w-3 h-3";
  
  switch (extension) {
    case 'ts':
    case 'tsx':
      return <File className={cn(iconClass, "text-blue-400")} />;
    case 'js':
    case 'jsx':
      return <File className={cn(iconClass, "text-yellow-400")} />;
    case 'css':
    case 'scss':
      return <File className={cn(iconClass, "text-purple-400")} />;
    case 'json':
      return <File className={cn(iconClass, "text-orange-400")} />;
    case 'md':
      return <File className={cn(iconClass, "text-gray-400")} />;
    default:
      return <File className={cn(iconClass, "text-gray-300")} />;
  }
};

export function EditorTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  className,
}: EditorTabsProps) {
  const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (activeTabId) {
          onTabClose?.(activeTabId);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
        if (currentIndex !== -1) {
          const nextIndex = e.shiftKey 
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length;
          onTabSelect?.(tabs[nextIndex].id);
        }
      }
    }
  }, [activeTabId, tabs, onTabClose, onTabSelect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [handleKeyboardShortcuts]);

  const handleTabClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isDirty) {
      const confirmClose = window.confirm(
        `"${tab.name}" has unsaved changes. Are you sure you want to close it?`
      );
      if (!confirmClose) return;
    }
    
    onTabClose?.(tabId);
  }, [tabs, onTabClose]);

  if (tabs.length === 0) {
    return (
      <div className={cn(
        "flex items-center px-4 py-2 bg-zinc-900/50 backdrop-blur-sm",
        "border-b border-white/10 text-gray-500 text-sm",
        className
      )}>
        No files open
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center bg-zinc-900/50 backdrop-blur-sm",
      "border-b border-white/10 overflow-x-auto scrollbar-thin",
      "scrollbar-thumb-gray-700 scrollbar-track-transparent",
      className
    )}>
      <div className="flex" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 border-r border-white/10",
                "cursor-pointer transition-all min-w-[120px] max-w-[200px]",
                "hover:bg-white/5",
                isActive ? [
                  "bg-orange-500/10 text-white",
                  "border-b-2 border-b-orange-500",
                ] : "text-gray-400 hover:text-gray-300"
              )}
              onClick={() => onTabSelect?.(tab.id)}
            >
              <span className="flex-shrink-0">
                {getFileIcon(tab.extension)}
              </span>
              
              <span className="flex-1 text-sm truncate">
                {tab.name}
                {tab.isDirty && (
                  <span className="ml-1 text-orange-500">•</span>
                )}
              </span>
              
              <button
                className={cn(
                  "flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100",
                  "hover:bg-white/10 transition-opacity",
                  isActive && "opacity-100"
                )}
                onClick={(e) => handleTabClose(e, tab.id)}
                aria-label={`Close ${tab.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { EditorTab };