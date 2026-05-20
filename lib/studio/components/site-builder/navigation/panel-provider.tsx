'use client';

/**
 * Panel Provider
 *
 * State management for site-builder navigation panels.
 * Uses React Context with localStorage persistence for pinned state.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type PanelType = 'pages' | null;

interface PanelState {
  activePanel: PanelType;
  isPinned: boolean;
  isFullCanvasMode: boolean;
}

interface PanelContextValue extends PanelState {
  openPanel: (panel: PanelType) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelType) => void;
  togglePin: () => void;
  toggleFullCanvasMode: () => void;
  setFullCanvasMode: (value: boolean) => void;
}

const PANEL_PINNED_KEY = 'catalyst:site-builder:panel-pinned';
const LAST_PANEL_KEY = 'catalyst:site-builder:last-panel';

const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanelState() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelState must be used within a PanelProvider');
  }
  return context;
}

interface PanelProviderProps {
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PanelProvider({ children, defaultOpen = false }: PanelProviderProps) {
  const [activePanel, setActivePanel] = useState<PanelType>(defaultOpen ? 'pages' : null);
  const [isPinned, setIsPinned] = useState(false);
  const [isFullCanvasMode, setIsFullCanvasMode] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const storedPinned = localStorage.getItem(PANEL_PINNED_KEY);
    if (storedPinned !== null) {
      setIsPinned(storedPinned === 'true');
    }

    // Restore last panel from session storage
    const lastPanel = sessionStorage.getItem(LAST_PANEL_KEY);
    if (lastPanel && (lastPanel === 'pages')) {
      setActivePanel(lastPanel as PanelType);
    }

    setIsHydrated(true);
  }, []);

  // Persist pinned state
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(PANEL_PINNED_KEY, String(isPinned));
    }
  }, [isPinned, isHydrated]);

  // Persist active panel to session storage
  useEffect(() => {
    if (isHydrated && activePanel) {
      sessionStorage.setItem(LAST_PANEL_KEY, activePanel);
    }
  }, [activePanel, isHydrated]);

  const openPanel = useCallback((panel: PanelType) => {
    setActivePanel(panel);
    setIsFullCanvasMode(false);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const togglePanel = useCallback((panel: PanelType) => {
    setActivePanel(current => current === panel ? null : panel);
    if (isFullCanvasMode) {
      setIsFullCanvasMode(false);
    }
  }, [isFullCanvasMode]);

  const togglePin = useCallback(() => {
    setIsPinned(prev => !prev);
  }, []);

  const toggleFullCanvasMode = useCallback(() => {
    setIsFullCanvasMode(prev => {
      const next = !prev;
      if (next) {
        setActivePanel(null);
      }
      return next;
    });
  }, []);

  const setFullCanvasModeValue = useCallback((value: boolean) => {
    setIsFullCanvasMode(value);
    if (value) {
      setActivePanel(null);
    }
  }, []);

  return (
    <PanelContext.Provider
      value={{
        activePanel,
        isPinned,
        isFullCanvasMode,
        openPanel,
        closePanel,
        togglePanel,
        togglePin,
        toggleFullCanvasMode,
        setFullCanvasMode: setFullCanvasModeValue,
      }}
    >
      {children}
    </PanelContext.Provider>
  );
}
