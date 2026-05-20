import type { Meta, StoryObj } from '@storybook/react';
import FeatureShowcase from './index';

const meta = {
  title: 'Studio/CMS/Features/FeatureShowcase',
  component: FeatureShowcase,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof FeatureShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

const demoImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNlMGU3ZmYiLz48L3N2Zz4=';

export const Default: Story = {
  args: {
    content: {
      heading: 'Feature Showcase',
      subheading: 'Highlight your product strengths with rich storytelling sections.',
      sections: [
        {
          image: {
            src: demoImage,
            alt: 'Amazing Feature'
          },
          title: 'Amazing Feature',
          description: 'This feature will change everything for your customers.',
          features: [
            { text: 'Super fast performance', highlighted: true, highlightLabel: 'New' },
            { text: 'Built for teams' },
            { text: 'Secure by design' }
          ],
          cta: {
            text: 'Learn More',
            url: '/signup'
          },
          badge: 'Best value',
          imagePosition: 'left'
        },
        {
          image: {
            src: demoImage,
            alt: 'Powerful Feature'
          },
          title: 'Flexible Workflow',
          description: 'Customize the experience to match your needs.',
          features: [
            { text: 'Drag-and-drop layouts' },
            { text: 'Reusable components' },
            { text: 'Advanced analytics' }
          ],
          cta: {
            text: 'See Details',
            url: '/features'
          },
          badge: 'Customer favorite',
          imagePosition: 'right'
        }
      ]
    }
  }
};
