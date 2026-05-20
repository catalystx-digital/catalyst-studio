import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/nextjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // Studio CMS components stories
    '../lib/studio/components/cms/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: [resolve(__dirname, '..', 'public')],
  webpackFinal: async (storybookConfig) => {
    if (storybookConfig.resolve) {
      storybookConfig.resolve.alias = {
        ...(storybookConfig.resolve.alias ?? {}),
        '@': resolve(__dirname, '..'),
      };
      if (storybookConfig.resolve.extensions) {
        const extensions = new Set(storybookConfig.resolve.extensions);
        extensions.add('.ts');
        extensions.add('.tsx');
        storybookConfig.resolve.extensions = Array.from(extensions);
      }
    }
    return storybookConfig;
  },
};

export default config;
