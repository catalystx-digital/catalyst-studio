import type { Meta, StoryObj } from '@storybook/react';
import { TextBlock } from './index';

const meta = {
  title: 'Studio/CMS/Content/TextBlock',
  component: TextBlock,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Studio text block component for displaying rich text content with various layouts and styles.'
      }
    }
  },
  argTypes: {
    content: {
      description: 'Text block content configuration',
      control: 'object'
    },
    className: {
      description: 'Additional CSS classes',
      control: 'text'
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TextBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper for common required props
const baseComponentProps = {
  id: 'text-block-1',
  category: 'content' as const,
  type: 'text-block' as const,
};

// Default text block
export const Default: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Welcome to Our Platform',
      subheading: 'Discover powerful features and capabilities',
      body: 'Our platform provides comprehensive solutions for modern businesses. With cutting-edge technology and user-friendly interfaces, we help you achieve your goals efficiently and effectively.',
      alignment: 'left'
    }
  }
};

// Center aligned
export const CenterAligned: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Centered Content',
      subheading: 'Perfect for hero sections',
      body: 'When you need to draw attention to important information, center-aligned text creates a focal point that naturally guides the reader\'s eye.',
      alignment: 'center'
    }
  }
};

// Right aligned
export const RightAligned: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Right Aligned Text',
      subheading: 'For special layouts',
      body: 'Right-aligned text can be used for special design purposes, creating visual interest and breaking monotony in your layouts.',
      alignment: 'right'
    }
  }
};

// Heading only
export const HeadingOnly: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Section Title Without Body Content',
      body: '',  // Required field, but empty
      alignment: 'center'
    }
  }
};

// With subheading
export const WithSubheading: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Main Title',
      subheading: 'Supporting subtitle that provides additional context',
      body: '',  // Required field, but empty
      alignment: 'left'
    }
  }
};

// Body only
export const BodyOnly: Story = {
  args: {
    ...baseComponentProps,
    content: {
      body: 'Sometimes you just need a simple paragraph of text without any headings. This component handles that gracefully, maintaining proper typography and spacing.',
      alignment: 'left'
    }
  }
};

// Long content
export const LongContent: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Comprehensive Overview',
      subheading: 'Everything you need to know',
      body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.`,
      alignment: 'left'
    }
  }
};

// With HTML content
export const WithHtmlContent: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Rich Text Support',
      body: '<p>This component supports <strong>bold text</strong>, <em>italic text</em>, and even <a href="#">links</a>.</p><ul><li>First item</li><li>Second item</li><li>Third item</li></ul><p>All HTML is properly sanitized for security.</p>',
      alignment: 'left'
    }
  }
};

// Justified text
export const JustifiedText: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Justified Alignment',
      body: 'Justified text creates clean edges on both sides of the text block. This alignment style is often used in newspapers and magazines to create a uniform appearance. However, it should be used carefully in web design as it can sometimes create awkward spacing between words.',
      alignment: 'justify'
    }
  }
};

// With custom styling
export const CustomStyling: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Custom Styled Block',
      subheading: 'With additional CSS classes',
      body: 'This text block demonstrates how custom styling can be applied through the className prop to achieve unique visual effects.',
      alignment: 'center'
    },
    className: 'bg-muted/40 p-8 rounded-xl border border-border/40 shadow-lg'
  }
};

// Multi-column layout with rich content
export const RichColumns: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Two Column Layout',
      subheading: 'For magazine-style content',
      body: `This text is displayed in a two-column layout, perfect for creating magazine-style articles or improving readability for longer content.

The columns automatically balance to create an even distribution of text, making your content more visually appealing and easier to scan.

Multi-column layouts work best with longer paragraphs of text and can significantly improve the reading experience on wider screens.`,
      columns: 2,
      alignment: 'left'
    }
  }
};

// Three columns
export const ThreeColumns: Story = {
  args: {
    ...baseComponentProps,
    content: {
      heading: 'Three Column Layout',
      subheading: 'For dashboard-style content',
      body: `Column one contains the first part of the content. This layout is ideal for presenting information in a dashboard or card-like format.

Column two continues with more information. The three-column layout maximizes screen real estate on larger displays.

Column three completes the layout. This format works well for comparisons, feature lists, or segmented content.`,
      columns: 3,
      alignment: 'center'
    }
  }
};

export const DarkTheme: Story = {
  args: {
    ...baseComponentProps,
    theme: 'dark',
    content: {
      heading: 'Dark Theme Example',
      subheading: 'Matches studio dark mode tokens automatically',
      body: '<p>When rendered in dark mode, the text block inherits the correct tokenized colors without additional configuration. Links, lists, and emphasis styles all honor the current theme.</p>',
      alignment: 'left'
    }
  }
};
