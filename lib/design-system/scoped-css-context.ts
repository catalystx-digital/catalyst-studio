import React from 'react';

export interface DesignSystemCssContextValue {
  cssVariables: string | null;
}

export const DesignSystemCssContext = React.createContext<DesignSystemCssContextValue>({
  cssVariables: null
});

export function useDesignSystemCss(): DesignSystemCssContextValue {
  return React.useContext(DesignSystemCssContext);
}
