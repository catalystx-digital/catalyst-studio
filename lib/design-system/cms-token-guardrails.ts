const CMS_ALLOWED_VARIABLES = new Set([
  '--primary',
  '--primary-foreground',
  '--accent',
  '--accent-foreground',
  '--ring',
  '--font-family',
  '--ds-body-font',
  '--ds-heading-font',
]);

export function isCmsScopedVariableAllowed(name: string): boolean {
  return CMS_ALLOWED_VARIABLES.has(name);
}

export function filterCmsScopedVariables(
  variables: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!variables) {
    return undefined;
  }

  const entries = Object.entries(variables).filter(([name]) => isCmsScopedVariableAllowed(name));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
