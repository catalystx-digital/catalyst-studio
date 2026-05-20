'use client';

import React from 'react';
import { AnimatedPanel, FloatingShape } from '@/components/glass-morphism';

interface LayoutContainerProps {
  children: React.ReactNode;
}

/**
 * LayoutContainer - Three-column layout wrapper (REFACTORED)
 * Uses centralized FeatureFlagContext to eliminate duplication
 * Story 1.1a: Basic structure
 * Story 1.1b: Catalyst X branding  
 */
export function LayoutContainer({ children }: LayoutContainerProps) {
  // Three-column layout and catalyst branding are always enabled
  return (
    <div className="grid grid-cols-[360px_260px_1fr] h-screen overflow-hidden bg-gray-900">
      {children}
    </div>
  );
}

/**
 * ChatPanel - Refactored to use context
 */
export function ChatPanel({ children }: { children: React.ReactNode }) {
  // All features are always enabled

  return (
    <AnimatedPanel direction="left" delay={0.1}>
      <div className="border-r h-full flex flex-col relative border-gray-700 backdrop-blur-md bg-gray-900/70">
        {children}
      </div>
    </AnimatedPanel>
  );
}

/**
 * NavigationPanel - Refactored to use context
 */
export function NavigationPanel({ children }: { children: React.ReactNode }) {
  // All features are always enabled

  // If no children provided, show default placeholder
  const panelContent = children || (
    <div className="p-4 text-gray-400">
      {/* Empty shell for navigation - Story 1.1a */}
      <div className="mb-4">
        <div className="w-10 h-10 bg-orange-500 transform rotate-45 rounded mb-4"></div>
      </div>
      <p>Navigation (Coming Soon)</p>
    </div>
  );

  return (
    <AnimatedPanel direction="left" delay={0.2}>
      <div className="border-r h-full flex flex-col relative border-gray-700 backdrop-blur-md bg-gray-800/50">
        <FloatingShape size={80} color="blue" position={{ top: '20%', left: '10%' }} delay={1} />
        {panelContent}
      </div>
    </AnimatedPanel>
  );
}

/**
 * MainContentPanel - Refactored to use context
 */
export function MainContentPanel({ children }: { children: React.ReactNode }) {
  // All features are always enabled

  return (
    <div className="h-full relative overflow-hidden">
      <AnimatedPanel direction="right" delay={0.3}>
        <div className="h-full flex flex-col relative overflow-hidden backdrop-blur-sm bg-gray-950/80">
          <>
            <FloatingShape size={120} color="orange" position={{ top: '10%', right: '15%' }} delay={0} />
            <FloatingShape size={90} color="green" position={{ bottom: '20%', left: '20%' }} delay={2} />
          </>
          {children || (
            <div className="p-4 text-gray-400">
              {/* Empty shell for main content - Story 1.1a */}
              <p>Main Content (Coming Soon)</p>
            </div>
          )}
        </div>
      </AnimatedPanel>
    </div>
  );
}