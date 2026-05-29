import fs from 'node:fs';
import path from 'node:path';
import plugin from 'tailwindcss/plugin';
import { tokens as defaultTokens, type DesignTokens } from './lib/design-system/tokens';

const LIGHT_MODE = defaultTokens.colors.light;
const DARK_MODE = defaultTokens.colors.dark;

type BackgroundTokens = typeof LIGHT_MODE.background;
type TextTokens = typeof LIGHT_MODE.text;
type AccentTokens = typeof LIGHT_MODE.accent;
type BorderTokens = typeof LIGHT_MODE.border;

type ColorMode = 'light' | 'dark';

type AliasMap = Record<string, string>;

// Mutable version of color mode tokens for assignment during override resolution
type MutableColorModeTokens = {
  background: Record<string, string>;
  text: Record<string, string>;
  accent: Record<string, string>;
  border: Record<string, string>;
};

function cloneTokens(tokenSet: DesignTokens): DesignTokens {
  return JSON.parse(JSON.stringify(tokenSet)) as DesignTokens;
}

function normalizeAliasKey(key: string): string {
  return key.startsWith('--') ? key : `--${key}`;
}

function parseCssVariableBlock(block: string): AliasMap {
  const map: AliasMap = {};
  block
    .split('\n')
    .map(line => line.trim())
    .forEach(line => {
      if (!line.startsWith('--')) {
        return;
      }
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        return;
      }
      const key = line.slice(0, colonIndex).trim();
      const rawValue = line.slice(colonIndex + 1).trim();
      const value = rawValue.endsWith(';') ? rawValue.slice(0, -1).trim() : rawValue;
      if (!key || !value) {
        return;
      }
      map[normalizeAliasKey(key)] = value;
    });
  return map;
}

function normalizeAliasMap(candidate: unknown): AliasMap | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const entries = Object.entries(candidate as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string');

  if (entries.length === 0) {
    return null;
  }

  return entries.reduce<AliasMap>((acc, [key, value]) => {
    acc[normalizeAliasKey(key)] = value;
    return acc;
  }, {});
}

function extractAliasMap(payload: unknown): AliasMap | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const primary = normalizeAliasMap((payload as Record<string, unknown>).aliasMap);
  if (primary) {
    return primary;
  }

  const sources: string[] = [];
  const css = (payload as Record<string, unknown>).css;

  if (css && typeof css === 'object') {
    const cssRecord = css as Record<string, unknown>;
    if (typeof cssRecord.aliases === 'string') {
      sources.push(cssRecord.aliases);
    }
    if (typeof cssRecord.combined === 'string') {
      sources.push(cssRecord.combined);
    }
    if (typeof cssRecord.canonical === 'string') {
      sources.push(cssRecord.canonical);
    }
    const sections = cssRecord.sections;
    if (sections && typeof sections === 'object') {
      Object.values(sections as Record<string, unknown>).forEach(value => {
        if (typeof value === 'string') {
          sources.push(value);
        }
      });
    }
  }

  if (sources.length === 0) {
    return null;
  }

  const merged = sources.reduce<AliasMap>((acc, block) => {
    const parsed = parseCssVariableBlock(block);
    Object.assign(acc, parsed);
    return acc;
  }, {});

  return Object.keys(merged).length > 0 ? merged : null;
}

function loadAliasMapFromGeneratedDesignSystem(): AliasMap | null {
  const candidatePaths = new Set<string>();
  candidatePaths.add(path.resolve(process.cwd(), 'generated/design-system.json'));
  if (typeof __dirname === 'string') {
    candidatePaths.add(path.resolve(__dirname, 'generated/design-system.json'));
    candidatePaths.add(path.resolve(__dirname, '../generated/design-system.json'));
  }

  for (const candidate of candidatePaths) {
    try {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      const raw = fs.readFileSync(candidate, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      const aliasMap = extractAliasMap(parsed);
      if (aliasMap) {
        return aliasMap;
      }
    } catch {
      // ignore parse or access issues and continue searching
    }
  }

  return null;
}

type ModePaletteOverride = {
  background?: Partial<BackgroundTokens>;
  text?: Partial<TextTokens>;
  border?: Partial<BorderTokens>;
  accent?: Partial<AccentTokens>;
};

type ColorOverrides = Partial<Record<ColorMode, ModePaletteOverride>>;

function buildTokenOverrides(aliasMap: AliasMap): ColorOverrides | null {
  const overrides: ColorOverrides = {};

  const ensureMode = (mode: ColorMode): ModePaletteOverride => {
    if (!overrides[mode]) {
      overrides[mode] = {};
    }
    return overrides[mode] as ModePaletteOverride;
  };

  const assign = <Key extends keyof BackgroundTokens>(
    mode: ColorMode,
    bucket: 'background',
    key: Key,
    aliasKey: string
  ) => {
    const value = aliasMap[aliasKey];
    if (typeof value === 'string' && value) {
      const modeOverride = ensureMode(mode);
      modeOverride.background = {
        ...(modeOverride.background ?? {}),
        [key]: value
      };
    }
  };

  const assignText = <Key extends keyof TextTokens>(mode: ColorMode, key: Key, aliasKey: string) => {
    const value = aliasMap[aliasKey];
    if (typeof value === 'string' && value) {
      const modeOverride = ensureMode(mode);
      modeOverride.text = {
        ...(modeOverride.text ?? {}),
        [key]: value
      };
    }
  };

  const assignBorder = <Key extends keyof BorderTokens>(mode: ColorMode, key: Key, aliasKey: string) => {
    const value = aliasMap[aliasKey];
    if (typeof value === 'string' && value) {
      const modeOverride = ensureMode(mode);
      modeOverride.border = {
        ...(modeOverride.border ?? {}),
        [key]: value
      };
    }
  };

  const assignAccent = <Key extends keyof AccentTokens>(mode: ColorMode, key: Key, aliasKey: string) => {
    const value = aliasMap[aliasKey];
    if (typeof value === 'string' && value) {
      const modeOverride = ensureMode(mode);
      modeOverride.accent = {
        ...(modeOverride.accent ?? {}),
        [key]: value
      };
    }
  };

  const primaryKeys: Array<[keyof BackgroundTokens, string, string]> = [
    ['primary', '--color-bg-primary', '--color-bg-primary-dark'],
    ['secondary', '--color-bg-secondary', '--color-bg-secondary-dark'],
    ['surface', '--color-bg-surface', '--color-bg-surface-dark-mode'],
    ['surfaceDark', '--color-bg-surface-dark', '--color-bg-surface-dark-alt'],
    ['overlay', '--color-bg-overlay', '--color-bg-overlay-dark']
  ];

  primaryKeys.forEach(([key, lightKey, darkKey]) => {
    assign('light', 'background', key, lightKey);
    assign('dark', 'background', key, darkKey);
  });

  const textKeys: Array<[keyof TextTokens, string, string]> = [
    ['primary', '--color-text-primary', '--color-text-primary-dark'],
    ['secondary', '--color-text-secondary', '--color-text-secondary-dark'],
    ['muted', '--color-text-muted', '--color-text-muted-dark'],
    ['disabled', '--color-text-disabled', '--color-text-disabled-dark']
  ];

  textKeys.forEach(([key, lightKey, darkKey]) => {
    assignText('light', key, lightKey);
    assignText('dark', key, darkKey);
  });

  const accentKeys: Array<[keyof AccentTokens, string, string]> = [
    ['orange', '--color-accent-orange', '--color-accent-orange-dark'],
    ['orangeHover', '--color-accent-orange-hover', '--color-accent-orange-hover-dark'],
    ['orangeLight', '--color-accent-orange-light', '--color-accent-orange-light-dark'],
    ['blue', '--color-accent-blue', '--color-accent-blue-dark'],
    ['blueHover', '--color-accent-blue-hover', '--color-accent-blue-hover-dark'],
    ['blueLight', '--color-accent-blue-light', '--color-accent-blue-light-dark'],
    ['green', '--color-accent-green', '--color-accent-green-dark'],
    ['greenHover', '--color-accent-green-hover', '--color-accent-green-hover-dark'],
    ['greenLight', '--color-accent-green-light', '--color-accent-green-light-dark'],
    ['red', '--color-accent-red', '--color-accent-red-dark'],
    ['redHover', '--color-accent-red-hover', '--color-accent-red-hover-dark'],
    ['redLight', '--color-accent-red-light', '--color-accent-red-light-dark']
  ];

  accentKeys.forEach(([key, lightKey, darkKey]) => {
    assignAccent('light', key, lightKey);
    assignAccent('dark', key, darkKey);
  });

  const borderKeys: Array<[keyof BorderTokens, string, string]> = [
    ['default', '--color-border-default', '--color-border-default-dark'],
    ['hover', '--color-border-hover', '--color-border-hover-dark'],
    ['active', '--color-border-active', '--color-border-active-dark']
  ];

  borderKeys.forEach(([key, lightKey, darkKey]) => {
    assignBorder('light', key, lightKey);
    assignBorder('dark', key, darkKey);
  });

  return Object.keys(overrides).length > 0 ? overrides : null;
}

function resolveDesignTokens(aliasMap: AliasMap | null): DesignTokens {
  if (!aliasMap) {
    return defaultTokens;
  }

  const overrides = buildTokenOverrides(aliasMap);
  if (!overrides) {
    return defaultTokens;
  }

  const merged = cloneTokens(defaultTokens);

  (['light', 'dark'] as ColorMode[]).forEach(mode => {
    const modeOverride = overrides[mode];
    if (!modeOverride) {
      return;
    }

    const target = merged.colors[mode] as MutableColorModeTokens;

    if (modeOverride.background) {
      target.background = {
        ...target.background,
        ...modeOverride.background
      };
    }

    if (modeOverride.text) {
      target.text = {
        ...target.text,
        ...modeOverride.text
      };
    }

    if (modeOverride.accent) {
      target.accent = {
        ...target.accent,
        ...modeOverride.accent
      };
    }

    if (modeOverride.border) {
      target.border = {
        ...target.border,
        ...modeOverride.border
      };
    }
  });

  return merged;
}

const aliasMap = loadAliasMapFromGeneratedDesignSystem();
const tokens = resolveDesignTokens(aliasMap);

function buildThemeVariables(defaults: Record<string, string>, map: AliasMap | null): Record<string, string> {
  return Object.entries(defaults).reduce<Record<string, string>>((acc, [key, fallback]) => {
    const normalizedKey = normalizeAliasKey(key);
    const value = map?.[normalizedKey] ?? fallback;
    acc[normalizedKey] = value;
    return acc;
  }, {});
}

// Legacy theme variable definitions removed - now using shadcn variables exclusively
// See PRD: Design System Phase 3 - Export Pipeline Cleanup

/**
 * Catalyst Design System Tailwind Plugin
 *
 * This plugin extends Tailwind with Catalyst design tokens,
 * theme variants, and component utilities.
 */

export const catalystPlugin = plugin.withOptions<{}>(() => {
  return function({ addUtilities, addComponents, theme, e }) {
    const resolveFontSize = (key: string): string => {
      const value = theme(`fontSize.${key}`) as unknown;
      if (Array.isArray(value)) {
        const [size] = value as [string, ...unknown[]];
        return size;
      }
      return typeof value === 'string' ? value : '';
    };

    // Add theme and variant utilities
    // Note: Theme classes now rely on shadcn CSS variables set in globals.css
    // No legacy --color-* variables are injected here
    addUtilities({
      // Theme utilities - these classes are markers for styling context
      // Actual colors come from shadcn variables in :root and .dark
      '.theme-light': {
        'color-scheme': 'light',
      },

      '.theme-dark': {
        'color-scheme': 'dark',
      },

      // Theme inverted variants - swap the color scheme
      '.theme-inverted': {
        'color-scheme': 'dark',
      },

      '.theme-dark .theme-inverted': {
        'color-scheme': 'light',
      },

      '.theme-light .theme-inverted': {
        'color-scheme': 'dark',
      },

      // Root-level component variable defaults (fallbacks if no variant is applied)
      ':root': {
        '--component-border-radius': '0.5rem',
        '--component-padding': '1.5rem',
        '--component-shadow': 'none',
      },

      // Variant utilities
      '.variant-default': {
        '--component-border-radius': theme('borderRadius.md'),
        '--component-padding': theme('spacing.4'),
        '--component-shadow': 'none',
      },

      '.variant-minimal': {
        '--component-border-radius': theme('borderRadius.sm'),
        '--component-padding': theme('spacing.2'),
        '--component-shadow': 'none',
      },

      '.variant-detailed': {
        '--component-border-radius': theme('borderRadius.lg'),
        '--component-padding': theme('spacing.6'),
        '--component-shadow': theme('boxShadow.md'),
      },

      '.variant-compact': {
        '--component-border-radius': theme('borderRadius.sm'),
        '--component-padding': theme('spacing.1'),
        '--component-shadow': 'none',
      },

      '.variant-expanded': {
        '--component-border-radius': theme('borderRadius.xl'),
        '--component-padding': theme('spacing.8'),
        '--component-shadow': theme('boxShadow.lg'),
      },

      // Glass morphism effects
      '.glass-morphism': {
        'backdrop-filter': 'blur(10px)',
        'background': 'hsl(var(--card) / 0.8)',
        'border': '1px solid hsl(var(--border))',
      },

      '.glass-morphism-light': {
        'backdrop-filter': 'blur(10px)',
        'background': 'hsl(var(--background) / 0.9)',
        'border': '1px solid hsl(var(--border))',
      },

      // Animation utilities
      '.animations-enabled': {
        '--transition-duration': tokens.transitions.duration.normal,
        '--transition-easing': tokens.transitions.easing.easeInOut,
      },

      // Interactive states
      '.interactive-hover': {
        'transition': `all ${tokens.transitions.duration.normal} ${tokens.transitions.easing.easeInOut}`,
        '&:hover': {
          'transform': 'translateY(-2px)',
          'box-shadow': theme('boxShadow.lg'),
        },
      },

      '.interactive-press': {
        'transition': `all ${tokens.transitions.duration.fast} ${tokens.transitions.easing.easeInOut}`,
        '&:active': {
          'transform': 'translateY(0)',
          'box-shadow': theme('boxShadow.sm'),
        },
      },

      // Focus utilities with proper contrast
      '.focus-ring': {
        '&:focus': {
          'outline': 'none',
          'box-shadow': '0 0 0 2px hsl(var(--ring))',
        },
      },

      '.focus-ring-subtle': {
        '&:focus': {
          'outline': 'none',
          'box-shadow': '0 0 0 1px hsl(var(--ring) / 0.5)',
        },
      },
    });

    const spacingScale = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
    const spacingFallback: Record<(typeof spacingScale)[number], string> = {
      xxs: tokens.spacing.xxs,
      xs: tokens.spacing.xs,
      sm: tokens.spacing.sm,
      md: tokens.spacing.md,
      lg: tokens.spacing.lg,
      xl: tokens.spacing.xl,
      '2xl': tokens.spacing['2xl'],
      '3xl': tokens.spacing['3xl']
    };
    const spacingUtilities: Record<string, Record<string, string>> = {};

    spacingScale.forEach(scale => {
      const variable = `var(--ds-spacing-${scale}, ${spacingFallback[scale]})`;
      spacingUtilities[`.ds-spacing-${scale}`] = { gap: variable };
      spacingUtilities[`.ds-gap-${scale}`] = { gap: variable };
      spacingUtilities[`.ds-space-x-${scale}`] = { columnGap: variable };
      spacingUtilities[`.ds-space-y-${scale}`] = { rowGap: variable };
      spacingUtilities[`.ds-p-${scale}`] = { padding: variable };
      spacingUtilities[`.ds-px-${scale}`] = { paddingLeft: variable, paddingRight: variable };
      spacingUtilities[`.ds-py-${scale}`] = { paddingTop: variable, paddingBottom: variable };
      spacingUtilities[`.ds-pt-${scale}`] = { paddingTop: variable };
      spacingUtilities[`.ds-pr-${scale}`] = { paddingRight: variable };
      spacingUtilities[`.ds-pb-${scale}`] = { paddingBottom: variable };
      spacingUtilities[`.ds-pl-${scale}`] = { paddingLeft: variable };
      spacingUtilities[`.ds-m-${scale}`] = { margin: variable };
      spacingUtilities[`.ds-mx-${scale}`] = { marginLeft: variable, marginRight: variable };
      spacingUtilities[`.ds-my-${scale}`] = { marginTop: variable, marginBottom: variable };
      spacingUtilities[`.ds-mt-${scale}`] = { marginTop: variable };
      spacingUtilities[`.ds-mr-${scale}`] = { marginRight: variable };
      spacingUtilities[`.ds-mb-${scale}`] = { marginBottom: variable };
      spacingUtilities[`.ds-ml-${scale}`] = { marginLeft: variable };
    });

    addUtilities(spacingUtilities);

    const headingFallbacks: Record<number, { size: string; lineHeight: string; weight: string; letterSpacing: string }> = {
      1: {
        size: 'clamp(2.25rem, 2.5vw + 1rem, 3rem)',
        lineHeight: '1.2',
        weight: '600',
        letterSpacing: '-0.02em',
      },
      2: {
        size: 'clamp(1.875rem, 2vw + 0.75rem, 2.5rem)',
        lineHeight: '1.25',
        weight: '600',
        letterSpacing: '-0.015em',
      },
      3: {
        size: 'clamp(1.5rem, 1.6vw + 0.5rem, 2rem)',
        lineHeight: '1.3',
        weight: '600',
        letterSpacing: '-0.01em',
      },
      4: {
        size: 'clamp(1.25rem, 1.1vw + 0.5rem, 1.625rem)',
        lineHeight: '1.35',
        weight: '600',
        letterSpacing: '-0.005em',
      },
      5: {
        size: 'clamp(1.125rem, 0.8vw + 0.45rem, 1.375rem)',
        lineHeight: '1.45',
        weight: '500',
        letterSpacing: '-0.0025em',
      },
      6: {
        size: 'clamp(1rem, 0.6vw + 0.4rem, 1.25rem)',
        lineHeight: '1.5',
        weight: '500',
        letterSpacing: '0.01em',
      },
    };

    const displayFallback = {
      size: 'clamp(2.75rem, 3vw + 1rem, 3.5rem)',
      lineHeight: '1.15',
      weight: '700',
      letterSpacing: '-0.03em'
    };

    const headingUtilities: Record<string, Record<string, string>> = {
      '.ds-heading-display': {
        fontFamily: 'var(--ds-heading-font, var(--font-family, inherit))',
        fontSize: `var(--ds-heading-display-size, ${displayFallback.size})`,
        lineHeight: `var(--ds-heading-display-line-height, ${displayFallback.lineHeight})`,
        fontWeight: `var(--ds-heading-display-weight, ${displayFallback.weight})`,
        letterSpacing: `var(--ds-heading-display-letter-spacing, ${displayFallback.letterSpacing})`,
      }
    };

    Object.entries(headingFallbacks).forEach(([level, fallback]) => {
      const headingBase = `--ds-heading-heading-${level}`;
      headingUtilities[`.ds-heading-${level}`] = {
        fontFamily: 'var(--ds-heading-font, var(--font-family, inherit))',
        fontSize: `var(${headingBase}-size, ${fallback.size})`,
        lineHeight: `var(${headingBase}-line-height, ${fallback.lineHeight})`,
        fontWeight: `var(${headingBase}-weight, ${fallback.weight})`,
        letterSpacing: `var(${headingBase}-letter-spacing, ${fallback.letterSpacing})`,
      };
    });

    addUtilities(headingUtilities);

    const bodyFallbacks: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { index: number; size: string; lineHeight: string; weight: string }> = {
      xs: {
        index: 1,
        size: 'clamp(0.8125rem, 0.2vw + 0.55rem, 0.875rem)',
        lineHeight: '1.5',
        weight: '400',
      },
      sm: {
        index: 2,
        size: 'clamp(0.9375rem, 0.25vw + 0.65rem, 1rem)',
        lineHeight: '1.6',
        weight: '400',
      },
      md: {
        index: 3,
        size: 'clamp(1rem, 0.3vw + 0.7rem, 1.0625rem)',
        lineHeight: '1.65',
        weight: '400',
      },
      lg: {
        index: 4,
        size: 'clamp(1.05rem, 0.4vw + 0.75rem, 1.15rem)',
        lineHeight: '1.65',
        weight: '400',
      },
      xl: {
        index: 4,
        size: 'clamp(1.05rem, 0.4vw + 0.75rem, 1.15rem)',
        lineHeight: '1.65',
        weight: '400',
      },
    };

    const bodyUtilities: Record<string, Record<string, string>> = {};

    Object.entries(bodyFallbacks).forEach(([key, fallback]) => {
      const bodyBase = `--ds-body-body-${fallback.index}`;
      bodyUtilities[`.ds-body-${key}`] = {
        fontFamily: 'var(--ds-body-font, var(--font-family, inherit))',
        fontSize: `var(${bodyBase}-size, ${fallback.size})`,
        lineHeight: `var(${bodyBase}-line-height, ${fallback.lineHeight})`,
        fontWeight: `var(${bodyBase}-weight, ${fallback.weight})`,
        letterSpacing: `var(${bodyBase}-letter-spacing, 0)`,
      };
    });

    addUtilities(bodyUtilities);

    // Add responsive design token utilities
    addUtilities({
      '.text-responsive-xs': {
        'font-size': resolveFontSize('xs'),
        '@screen sm': {
          'font-size': resolveFontSize('sm'),
        },
      },
      '.text-responsive-sm': {
        'font-size': resolveFontSize('sm'),
        '@screen sm': {
          'font-size': resolveFontSize('base'),
        },
      },
      '.text-responsive-base': {
        'font-size': resolveFontSize('base'),
        '@screen sm': {
          'font-size': resolveFontSize('lg'),
        },
      },
      '.text-responsive-lg': {
        'font-size': resolveFontSize('lg'),
        '@screen sm': {
          'font-size': resolveFontSize('xl'),
        },
        '@screen lg': {
          'font-size': resolveFontSize('2xl'),
        },
      },
      '.text-responsive-xl': {
        'font-size': resolveFontSize('xl'),
        '@screen sm': {
          'font-size': resolveFontSize('2xl'),
        },
        '@screen lg': {
          'font-size': resolveFontSize('3xl'),
        },
      },
      '.text-responsive-2xl': {
        'font-size': resolveFontSize('2xl'),
        '@screen sm': {
          'font-size': resolveFontSize('3xl'),
        },
        '@screen lg': {
          'font-size': resolveFontSize('4xl'),
        },
      },
    });
  };
});

export default catalystPlugin;
