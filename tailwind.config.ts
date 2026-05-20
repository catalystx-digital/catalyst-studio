import type { Config } from 'tailwindcss';
import { catalystPlugin } from './tailwind-plugin';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui standard color configuration
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // Catalyst internal surface colors (for app UI, not exports)
        // These map to CSS variables defined in globals.css
        surface: {
          DEFAULT: 'var(--color-bg-surface)',
          dark: 'var(--color-bg-surface-dark)',
          darker: 'rgba(255, 255, 255, 0.02)',
        },
        // Catalyst brand colors (for app UI, not exports)
        'catalyst-orange': {
          DEFAULT: 'var(--color-accent-orange, #ef6820)',
          hover: 'var(--color-accent-orange-hover, #e25713)',
          light: 'var(--color-accent-orange-light, rgba(239, 104, 32, 0.12))',
        },
        'catalyst-blue': {
          DEFAULT: 'var(--color-accent-blue, #0ea5e9)',
          hover: 'var(--color-accent-blue-hover, #0284c7)',
          light: 'var(--color-accent-blue-light, rgba(14, 165, 233, 0.12))',
        },
        'catalyst-green': {
          DEFAULT: 'var(--color-accent-green, #10b981)',
          hover: 'var(--color-accent-green-hover, #059669)',
          light: 'var(--color-accent-green-light, rgba(16, 185, 129, 0.1))',
        },
        // Catalyst dark theme backgrounds
        dark: {
          primary: '#0a0a0a',
          secondary: '#1a1a1a',
        },
      },
      fontFamily: {
        sans: 'var(--font-family, Inter, system-ui, -apple-system, sans-serif)',
      },
      spacing: {
        '3xs': 'var(--ds-spacing-xxs, 0.25rem)',
        '2xs': 'var(--ds-spacing-xs, 0.5rem)',
        xs: 'var(--ds-spacing-sm, 0.75rem)',
        sm: 'var(--ds-spacing-md, 1rem)',
        md: 'var(--ds-spacing-lg, 1.5rem)',
        lg: 'var(--ds-spacing-xl, 2rem)',
        xl: 'var(--ds-spacing-2xl, 3rem)',
        '2xl': 'var(--ds-spacing-3xl, 4rem)',
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        glass: '10px',
        lg: '12px',
        xl: '16px',
      },
      transitionTimingFunction: {
        catalyst: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-out': 'fadeOut 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(239, 104, 32, 0.3)',
        'glow-blue': '0 0 20px rgba(14, 165, 233, 0.3)',
        'inset-subtle': 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    catalystPlugin,
  ],
  safelist: [
    // Ensure theme classes are always available
    'theme-light',
    'theme-dark',
    'theme-inverted',

    // Ensure variant classes are always available
    'variant-default',
    'variant-minimal',
    'variant-detailed',
    'variant-compact',
    'variant-expanded',

    // Ensure component classes are always available
    'cms-component',
    'cms-card',
    'cms-button',
    'cms-button-secondary',
    'cms-heading',
    'cms-subheading',
    'cms-body',
    'cms-caption',
    'cms-section',
    'cms-container',
    'cms-grid',
    'cms-flex',

    // Ensure responsive text classes are always available
    'text-responsive-xs',
    'text-responsive-sm',
    'text-responsive-base',
    'text-responsive-lg',
    'text-responsive-xl',
    'text-responsive-2xl',
  ],
};
export default config;
