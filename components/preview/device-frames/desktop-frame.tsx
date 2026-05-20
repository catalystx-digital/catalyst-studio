'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DesktopFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function DesktopFrame({ children, className }: DesktopFrameProps) {
  return (
    <div className={cn('relative w-full h-full transition-all duration-300 ease-catalyst', className)}>
      {/* Browser Chrome */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-t-lg border border-gray-200 dark:border-gray-700">
        {/* Traffic lights */}
        <div className="flex items-center gap-2 absolute left-3 top-1/2 -translate-y-1/2">
          <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors" />
          <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors" />
        </div>
        
        {/* URL Bar */}
        <div className="flex items-center justify-center h-full px-20">
          <div className="bg-white dark:bg-gray-700 rounded-md px-3 py-1 text-xs text-gray-500 dark:text-gray-400 w-full max-w-sm">
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="truncate">localhost:3000</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Frame */}
      <div className="absolute inset-0 top-10 bg-white dark:bg-gray-950 rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 shadow-2xl">
        {/* Subtle inner shadow for depth */}
        <div className="absolute inset-0 rounded-b-lg shadow-inner pointer-events-none" />
        
        {/* Content Area */}
        <div className="relative w-full h-full rounded-b-lg overflow-hidden">
          {children}
        </div>
      </div>
      
      {/* Outer shadow for realism */}
      <div className="absolute -inset-4 -z-10 bg-gradient-to-b from-transparent via-black/5 to-black/10 rounded-lg blur-2xl" />
    </div>
  );
}
