import { setProjectAnnotations } from '@storybook/nextjs';
import * as projectAnnotations from './preview';
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';

// Ensure Vitest runs stories with the same decorators and globals as Storybook.
setProjectAnnotations([projectAnnotations, a11yAddonAnnotations]);
