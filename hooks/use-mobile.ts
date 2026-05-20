import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    // Set initial state
    handleChange(mediaQuery);

    const listener = (event: MediaQueryListEvent) => handleChange(event);
    mediaQuery.addEventListener('change', listener);

    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, [breakpoint]);

  return isMobile;
}
