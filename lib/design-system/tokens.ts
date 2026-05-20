/**
 * Catalyst X Design System Tokens
 * Centralized design tokens for consistent visual identity
 */

const lightModeColors = {
  background: {
    primary: '#fdf8f3',
    secondary: '#ffffff',
    surface: '#f1f5f9',
    surfaceDark: 'rgba(15, 23, 42, 0.85)',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
  text: {
    primary: '#111827',
    secondary: '#334155',
    muted: '#64748b',
    disabled: '#94a3b8',
  },
  accent: {
    orange: '#ef6820',
    orangeHover: '#e25713',
    orangeLight: 'rgba(239, 104, 32, 0.12)',
    blue: '#0ea5e9',
    blueHover: '#0284c7',
    blueLight: 'rgba(14, 165, 233, 0.12)',
    green: '#10b981',
    greenHover: '#059669',
    greenLight: 'rgba(16, 185, 129, 0.1)',
    red: '#f43f5e',
    redHover: '#e11d48',
    redLight: 'rgba(244, 63, 94, 0.12)',
  },
  border: {
    default: 'rgba(52, 66, 86, 0.16)',
    hover: 'rgba(52, 66, 86, 0.24)',
    active: '#ef6820',
  },
} as const;

const darkModeColors = {
  background: {
    primary: '#0a0a0a',
    secondary: '#1a1a1a',
    surface: 'rgba(255, 255, 255, 0.05)',
    surfaceDark: 'rgba(255, 255, 255, 0.03)',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
  text: {
    primary: '#ffffff',
    secondary: '#9ca3af',
    muted: '#6b7280',
    disabled: '#4b5563',
  },
  accent: {
    orange: '#ff5500',
    orangeHover: '#ff6622',
    orangeLight: 'rgba(255, 85, 0, 0.1)',
    blue: '#0077cc',
    blueHover: '#0088dd',
    blueLight: 'rgba(0, 119, 204, 0.1)',
    green: '#00aa55',
    greenHover: '#00bb66',
    greenLight: 'rgba(0, 170, 85, 0.1)',
    red: '#dc2626',
    redHover: '#ef4444',
    redLight: 'rgba(220, 38, 38, 0.1)',
  },
  border: {
    default: 'rgba(255, 255, 255, 0.1)',
    hover: 'rgba(255, 255, 255, 0.15)',
    active: '#ff5500',
  },
} as const;

export const tokens = {
  colors: {
    ...lightModeColors,
    light: lightModeColors,
    dark: darkModeColors,
  },
  effects: {
    blur: 'blur(10px)',
    glass: 'backdrop-filter: blur(10px); background: rgba(255, 255, 255, 0.05);',
    glassDark: 'backdrop-filter: blur(10px); background: rgba(15, 23, 42, 0.85);',
  },
  spacing: {
    xxs: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  typography: {
    fontFamily: 'Inter, "SF Pro Text", -apple-system, sans-serif',
    headingFamily: '"Cal Sans", Inter, "Helvetica Neue", sans-serif',
    fontWeights: {
      light: 300,
      normal: 400,
      medium: 500,
      bold: 700,
    },
    sizes: {
      display: '3.5rem',
      h1: '3rem',
      h2: '2.375rem',
      h3: '1.875rem',
      h4: '1.5rem',
      h5: '1.3125rem',
      h6: '1.125rem',
      body: '1rem',
      bodySm: '0.9375rem',
      bodyLg: '1.125rem',
      bodyXl: '1.25rem',
      ui: '1rem',
    },
    lineHeights: {
      tight: '1.1',
      snug: '1.25',
      normal: '1.6',
      relaxed: '1.75',
    },
  },
  shadows: {
    sm: '0 2px 8px rgba(15, 23, 42, 0.08)',
    md: '0 10px 30px rgba(15, 23, 42, 0.12)',
    lg: '0 25px 60px rgba(15, 23, 42, 0.18)',
    xl: '0 35px 80px rgba(15, 23, 42, 0.22)',
    inner: 'inset 0 2px 4px rgba(15, 23, 42, 0.12)',
  },
  borders: {
    radius: {
      sm: '0.375rem',
      md: '0.625rem',
      lg: '1rem',
      xl: '1.5rem',
      full: '9999px',
    },
    width: {
      thin: '1px',
      medium: '2px',
      thick: '3px',
    },
  },
  transitions: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
    },
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
};

export type DesignTokens = typeof tokens;

export function buildDesignTokenCssVariables(tokenSet: DesignTokens = tokens): Record<string, string> {
  return {
    '--color-bg-primary': tokenSet.colors.background.primary,
    '--color-bg-secondary': tokenSet.colors.background.secondary,
    '--color-bg-surface': tokenSet.colors.background.surface,
    '--color-bg-surface-dark': tokenSet.colors.background.surfaceDark,
    '--color-bg-overlay': tokenSet.colors.background.overlay,
    '--color-text-primary': tokenSet.colors.text.primary,
    '--color-text-secondary': tokenSet.colors.text.secondary,
    '--color-text-muted': tokenSet.colors.text.muted,
    '--color-text-disabled': tokenSet.colors.text.disabled,
    '--color-accent-orange': tokenSet.colors.accent.orange,
    '--color-accent-orange-hover': tokenSet.colors.accent.orangeHover,
    '--color-accent-orange-light': tokenSet.colors.accent.orangeLight,
    '--color-accent-blue': tokenSet.colors.accent.blue,
    '--color-accent-blue-hover': tokenSet.colors.accent.blueHover,
    '--color-accent-blue-light': tokenSet.colors.accent.blueLight,
    '--color-accent-green': tokenSet.colors.accent.green,
    '--color-accent-green-hover': tokenSet.colors.accent.greenHover,
    '--color-accent-green-light': tokenSet.colors.accent.greenLight,
    '--color-accent-red': tokenSet.colors.accent.red,
    '--color-accent-red-hover': tokenSet.colors.accent.redHover,
    '--color-accent-red-light': tokenSet.colors.accent.redLight,
    '--color-border-default': tokenSet.colors.border.default,
    '--color-border-hover': tokenSet.colors.border.hover,
    '--color-border-active': tokenSet.colors.border.active,
    '--font-family': tokenSet.typography.fontFamily,
    '--font-heading': tokenSet.typography.headingFamily,
    '--font-weight-light': `${tokenSet.typography.fontWeights.light}`,
    '--font-weight-normal': `${tokenSet.typography.fontWeights.normal}`,
    '--font-weight-medium': `${tokenSet.typography.fontWeights.medium}`,
    '--font-weight-bold': `${tokenSet.typography.fontWeights.bold}`,
    '--transition-fast': tokenSet.transitions.duration.fast,
    '--transition-normal': tokenSet.transitions.duration.normal,
    '--transition-slow': tokenSet.transitions.duration.slow,
    '--ease-in-out': tokenSet.transitions.easing.easeInOut,
  };
}

// Export CSS variables for use in global styles
export function getCSSVariables(tokenSet: DesignTokens = tokens) {
  const variables = buildDesignTokenCssVariables(tokenSet);
  const variableLines = Object.entries(variables)
    .map(([name, value]) => `      ${name}: ${value};`)
    .join('\n');

  return `
    :root {
${variableLines}
    }
  `;
}
