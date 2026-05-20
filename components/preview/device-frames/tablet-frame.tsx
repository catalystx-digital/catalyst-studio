'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TabletFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function TabletFrame({ children, className }: TabletFrameProps) {
  return (
    <div className={cn('relative transition-all duration-300 ease-catalyst', className)}>
      {/* Outer bezel */}
      <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-[2.5rem] p-4 shadow-2xl">
        {/* Inner bezel shine */}
        <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />
        
        {/* Screen area */}
        <div className="relative bg-black rounded-[2rem] p-2">
          {/* Screen */}
          <div className="relative bg-white dark:bg-gray-950 rounded-[1.75rem] overflow-hidden">
            {/* Content */}
            <div className="relative w-full h-full">
              {children}
            </div>
            
            {/* Screen reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
          </div>
        </div>
        
        {/* Home button */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gray-700 dark:bg-gray-600 border-2 border-gray-600 dark:border-gray-500">
          <div className="absolute inset-2 rounded-full bg-gray-800 dark:bg-gray-700" />
        </div>
        
        {/* Camera */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gray-600 dark:bg-gray-500">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-500 to-gray-700" />
        </div>
      </div>
      
      {/* Shadow for depth */}
      <div className="absolute -inset-8 -z-10 bg-gradient-radial from-black/20 via-black/10 to-transparent rounded-[3rem] blur-3xl" />
    </div>
  );
}
