'use client';

import React from 'react';
import {
  tokens as defaultTokens,
  buildDesignTokenCssVariables,
  type DesignTokens
} from './tokens';
import { filterCmsScopedVariables } from './cms-token-guardrails';

type CssVariableMap = Record<string, string>;

interface DesignTokenContextValue {
  tokens: DesignTokens;
  cssVariables: CssVariableMap;
}

const DEFAULT_CSS_VARIABLES = buildDesignTokenCssVariables(defaultTokens);

export const DesignTokenContext = React.createContext<DesignTokenContextValue>({
  tokens: defaultTokens,
  cssVariables: DEFAULT_CSS_VARIABLES
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(target: T, source?: Partial<T>): T {
  if (!source) {
    return target;
  }

  const mutableTarget = target as Record<string, unknown>;

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (isPlainObject(value) && isPlainObject(mutableTarget[key])) {
      mutableTarget[key] = deepMerge({ ...mutableTarget[key] } as Record<string, unknown>, value as Record<string, unknown>);
      return;
    }

    mutableTarget[key] = value;
  });

  return target;
}

function cloneTokens(tokenSet: DesignTokens): DesignTokens {
  return JSON.parse(JSON.stringify(tokenSet)) as DesignTokens;
}

function mergeDesignTokens(overrides?: Partial<DesignTokens>): DesignTokens {
  if (!overrides) {
    return cloneTokens(defaultTokens);
  }

  const base = cloneTokens(defaultTokens);
  return deepMerge(base, overrides);
}

function normalizeCssVariableMap(input?: Record<string, unknown> | null): CssVariableMap | undefined {
  if (!isPlainObject(input)) {
    return undefined;
  }

  const entries: Array<[string, string]> = [];
  Object.entries(input).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      entries.push([key, String(value)]);
    }
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function mergeCssVariables(
  fromTokens: CssVariableMap,
  overrideMap?: Record<string, string> | null
): CssVariableMap {
  if (!overrideMap || Object.keys(overrideMap).length === 0) {
    return { ...fromTokens };
  }

  return {
    ...fromTokens,
    ...overrideMap
  };
}

export interface DesignTokenProviderProps {
  children: React.ReactNode;
  tokens?: Partial<DesignTokens>;
  cssVariables?: Record<string, string> | null;
}

export function DesignTokenProvider({
  children,
  tokens,
  cssVariables
}: DesignTokenProviderProps): React.ReactElement {
  const mergedTokens = mergeDesignTokens(tokens);
  const tokenVariableMap = buildDesignTokenCssVariables(mergedTokens);
  const overrideVariableMap = filterCmsScopedVariables(
    normalizeCssVariableMap(cssVariables ?? undefined)
  );
  const mergedVariableMap = mergeCssVariables(tokenVariableMap, overrideVariableMap);

  const contextValue: DesignTokenContextValue = {
    tokens: mergedTokens,
    cssVariables: mergedVariableMap
  };

  const inlineStyle: React.CSSProperties = { display: 'contents' };
  Object.entries(mergedVariableMap).forEach(([name, value]) => {
    (inlineStyle as Record<string, string>)[name] = value;
  });

  return (
    <DesignTokenContext.Provider value={contextValue}>
      <div style={inlineStyle} data-design-token-provider="catalyst">
        {children}
      </div>
    </DesignTokenContext.Provider>
  );
}
