'use client';

import React, { useCallback, useState } from 'react';
import { useCSSVariables } from './use-css-variables';
import { useDesignSystemCss } from './scoped-css-context';

export interface DesignSystemScopeProps extends React.HTMLAttributes<HTMLDivElement> {
  disableDisplayContents?: boolean;
}

// Scopes imported design system variables to the wrapped subtree.
export function DesignSystemScope({
  children,
  disableDisplayContents = false,
  style,
  ...rest
}: DesignSystemScopeProps): React.ReactElement {
  const { cssVariables } = useDesignSystemCss();
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  const assignRef = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  useCSSVariables(cssVariables, element);

  const mergedStyle: React.CSSProperties = {
    ...(disableDisplayContents ? {} : { display: 'contents' }),
    ...style
  };

  return (
    <div
      {...rest}
      ref={assignRef}
      data-design-system-scope="true"
      style={mergedStyle}
    >
      {children}
    </div>
  );
}
