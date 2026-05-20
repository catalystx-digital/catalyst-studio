'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MobileFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileFrame({ children, className }: MobileFrameProps) {
  return (
    <div className={cn('relative transition-all duration-300 ease-catalyst', className)}>
      {/* Phone body */}
      <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-[3rem] p-2 shadow-2xl">
        {/* Side buttons */}
        <div className="absolute -left-1 top-24 w-1 h-8 bg-gray-700 dark:bg-gray-600 rounded-r-sm" />
        <div className="absolute -left-1 top-36 w-1 h-12 bg-gray-700 dark:bg-gray-600 rounded-r-sm" />
        <div className="absolute -left-1 top-52 w-1 h-12 bg-gray-700 dark:bg-gray-600 rounded-r-sm" />
        <div className="absolute -right-1 top-32 w-1 h-16 bg-gray-700 dark:bg-gray-600 rounded-l-sm" />
        
        {/* Inner shine */}
        <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none" />
        
        {/* Screen bezel */}
        <div className="relative bg-black rounded-[2.5rem] p-1">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-2xl z-10">
            {/* Speaker grill */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-800 rounded-full" />
            {/* Front camera */}
            <div className="absolute top-1.5 right-14 w-2 h-2 rounded-full bg-gray-700">
              <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-gray-600 to-gray-800" />
            </div>
          </div>
          
          {/* Screen */}
          <div className="relative bg-white dark:bg-gray-950 rounded-[2.25rem] overflow-hidden">
            {/* Status bar area */}
            <div className="absolute top-0 left-0 right-0 h-7 bg-gradient-to-b from-black/10 to-transparent z-10 pointer-events-none" />
            
            {/* Content */}
            <div className="relative w-full h-full">
              {children}
            </div>
            
            {/* Screen reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/3 to-white/5 pointer-events-none" />
            
            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-800 dark:bg-gray-200 rounded-full opacity-50" />
          </div>
        </div>
      </div>
      
      {/* Shadow for depth */}
      <div className="absolute -inset-6 -z-10 bg-gradient-radial from-black/25 via-black/15 to-transparent rounded-[3.5rem] blur-3xl" />
    </div>
  );
}
