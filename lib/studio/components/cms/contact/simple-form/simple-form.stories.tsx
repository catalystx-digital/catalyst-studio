import type { Meta, StoryObj } from '@storybook/react';
import SimpleForm from './index';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Contact/SimpleForm',
  component: SimpleForm,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof SimpleForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'simpleform-1',
    type: ComponentType.SimpleForm,
    category: ComponentCategory.Contact,
    content: {
      fields: [
        { name: 'email', label: 'Email', type: 'email', placeholder: 'Enter your email' }
      ],
      submitButton: {
        text: 'Subscribe'
      }
    }
  }
};
