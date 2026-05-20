'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export type DensityOption = 'comfortable' | 'compact' | 'dense';

interface DensityContextValue {
  density: DensityOption;
  setDensity: (density: DensityOption) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

const DENSITY_STORAGE_KEY = 'dashboard-density';

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<DensityOption>('comfortable');
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (stored && ['comfortable', 'compact', 'dense'].includes(stored)) {
      setDensityState(stored as DensityOption);
    }
    setIsHydrated(true);
  }, []);

  const setDensity = useCallback((newDensity: DensityOption) => {
    setDensityState(newDensity);
    localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
  }, []);

  // Prevent hydration mismatch
  if (!isHydrated) {
    return <>{children}</>;
  }

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  const context = useContext(DensityContext);
  if (!context) {
    // Return default if provider not present
    return {
      density: 'comfortable' as DensityOption,
      setDensity: () => {},
    };
  }
  return context;
}

// Density configuration for cards
export const densityConfig: Record<DensityOption, {
  cardPadding: string;
  cardGap: string;
  gridCols: string;
  iconSize: string;
  fontSize: string;
  showDescription: boolean;
}> = {
  comfortable: {
    cardPadding: 'p-4',
    cardGap: 'gap-4',
    gridCols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    iconSize: 'w-10 h-10',
    fontSize: 'text-base',
    showDescription: true,
  },
  compact: {
    cardPadding: 'p-3',
    cardGap: 'gap-3',
    gridCols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5',
    iconSize: 'w-8 h-8',
    fontSize: 'text-sm',
    showDescription: true,
  },
  dense: {
    cardPadding: 'p-2',
    cardGap: 'gap-2',
    gridCols: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
    iconSize: 'w-6 h-6',
    fontSize: 'text-xs',
    showDescription: false,
  },
};
