import { useEffect } from 'react';
import { isCmsScopedVariableAllowed } from './cms-token-guardrails';

const CSS_VARIABLE_PATTERN = /^\s*--([^:]+):\s*([^;]+);/;

export function parseScopedCssVariableLines(input: string): Array<[string, string]> {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && CSS_VARIABLE_PATTERN.test(line))
    .map(line => {
      const match = line.match(CSS_VARIABLE_PATTERN);
      if (!match) {
        return null;
      }
      const [, rawName, rawValue] = match;
      const name = rawName.startsWith('--') ? rawName.trim() : `--${rawName.trim()}`;
      const value = rawValue.trim();
      return [name, value] as [string, string];
    })
    .filter((entry): entry is [string, string] => Boolean(entry))
    .filter(([name]) => isCmsScopedVariableAllowed(name));
}

function resolveTarget(target: HTMLElement | null | undefined): HTMLElement | null {
  if (target) {
    return target;
  }

  if (typeof document !== 'undefined') {
    return document.documentElement;
  }

  return null;
}

export function useCSSVariables(cssVariables: string | null, target: HTMLElement | null): void {
  useEffect(() => {
    const element = resolveTarget(target);

    if (!element || !cssVariables) {
      return;
    }

    const entries = parseScopedCssVariableLines(cssVariables);
    if (entries.length === 0) {
      return;
    }

    entries.forEach(([name, value]) => {
      element.style.setProperty(name, value);
    });

    return () => {
      entries.forEach(([name]) => {
        element.style.removeProperty(name);
      });
    };
  }, [cssVariables, target]);
}
