#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// Component Scaffolding Script
// ============================================================================

// Parse command line arguments
const args = process.argv.slice(2);
const componentName = args[0];
const category = args[1];

// Validate arguments
if (!componentName || !category) {
  console.error('Usage: npm run cms:create <component-name> <category>');
  console.error('Categories: navigation, heroes, content, features, cta, social-proof, contact, about, blog, pricing, data');
  process.exit(1);
}

// Valid categories
const validCategories = [
  'navigation', 'heroes', 'content', 'features', 'cta',
  'social-proof', 'contact', 'about', 'blog', 'pricing', 'data'
];

if (!validCategories.includes(category)) {
  console.error(`Invalid category: ${category}`);
  console.error(`Valid categories: ${validCategories.join(', ')}`);
  process.exit(1);
}

// Convert component name to various formats
const kebabCase = componentName.toLowerCase().replace(/\s+/g, '-');
const pascalCase = componentName
  .split(/[-\s]+/)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join('');
const camelCase = pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
const componentType = kebabCase.replace(/-/g, '_').toUpperCase();

// Component directory path
const componentDir = path.join(
  __dirname,
  '..',
  'lib',
  'studio',
  'components',
  'cms',
  category,
  kebabCase
);

// Check if component already exists
if (fs.existsSync(componentDir)) {
  console.error(`Component already exists: ${componentDir}`);
  process.exit(1);
}

// Create component directory
fs.mkdirSync(componentDir, { recursive: true });
console.log(`✅ Created directory: ${componentDir}`);

// ============================================================================
// Template Files
// ============================================================================

// Main component file template
const componentTemplate = `import React from 'react';
import { CMSComponentProps, ComponentType, ComponentCategory } from '../../_core/types';
import { withPerformanceTracking } from '../../_core/monitoring';
import { cn } from '@/lib/utils';

export interface ${pascalCase}Props extends CMSComponentProps {
  // Add component-specific props here
}

const ${pascalCase}Component: React.FC<${pascalCase}Props> = ({
  id,
  type = ComponentType.${componentType},
  category = ComponentCategory.${pascalCase.replace(/([A-Z])/g, ' $1').trim().split(' ').join('')},
  content,
  className,
  style,
  theme = 'light',
  variant = 'default',
  loading = 'eager',
  priority = 'normal',
  interactive = false,
  aiMetadata,
  analytics,
  onLoad,
  onError,
  onInteraction,
}) => {
  React.useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  const handleClick = () => {
    if (interactive && onInteraction) {
      onInteraction('click', { componentId: id });
    }
  };

  return (
    <div
      id={id}
      className={cn(
        'cms-${kebabCase}',
        \`cms-${kebabCase}--\${variant}\`,
        theme === 'dark' && 'dark',
        className
      )}
      style={style}
      data-component-type={type}
      data-component-category={category}
      onClick={handleClick}
      role={aiMetadata?.accessibility?.role}
      aria-label={aiMetadata?.accessibility?.ariaLabel}
      aria-describedby={aiMetadata?.accessibility?.ariaDescribedBy}
    >
      {content.heading && (
        <h2 className="cms-${kebabCase}__heading">{content.heading}</h2>
      )}
      {content.subheading && (
        <h3 className="cms-${kebabCase}__subheading">{content.subheading}</h3>
      )}
      {content.body && (
        <div className="cms-${kebabCase}__body">{content.body}</div>
      )}
    </div>
  );
};

// Export with performance tracking
export const ${pascalCase} = withPerformanceTracking(
  ${pascalCase}Component,
  ComponentType.${componentType}
);

// Default export for dynamic imports
export default ${pascalCase};
`;

// TypeScript types file template
const typesTemplate = `import { CMSComponentProps } from '../../_core/types';

export interface ${pascalCase}Content {
  heading?: string;
  subheading?: string;
  body?: string;
  // Add content-specific fields here
}

export interface ${pascalCase}Props extends CMSComponentProps {
  content: ${pascalCase}Content;
  // Add component-specific props here
}

export type ${pascalCase}Variant = 'default' | 'minimal' | 'detailed' | 'compact' | 'expanded';
`;

// Test file template
const testTemplate = `import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ${pascalCase} } from '.';
import { ComponentType, ComponentCategory } from '../../_core/types';

describe('${pascalCase}', () => {
  const defaultProps = {
    id: '${kebabCase}-1',
    type: ComponentType.${componentType},
    category: ComponentCategory.${pascalCase.replace(/([A-Z])/g, ' $1').trim().split(' ').join('')},
    content: {
      heading: 'Test Heading',
      subheading: 'Test Subheading',
      body: 'Test body content'
    }
  };

  it('renders without crashing', () => {
    render(<${pascalCase} {...defaultProps} />);
    expect(screen.getByText('Test Heading')).toBeInTheDocument();
  });

  it('renders with minimal variant', () => {
    const { container } = render(
      <${pascalCase} {...defaultProps} variant="minimal" />
    );
    expect(container.querySelector('.cms-${kebabCase}--minimal')).toBeInTheDocument();
  });

  it('applies dark theme', () => {
    const { container } = render(
      <${pascalCase} {...defaultProps} theme="dark" />
    );
    expect(container.querySelector('.dark')).toBeInTheDocument();
  });

  it('handles click interaction', () => {
    const onInteraction = jest.fn();
    const { container } = render(
      <${pascalCase}
        {...defaultProps}
        interactive={true}
        onInteraction={onInteraction}
      />
    );
    
    const element = container.querySelector('.cms-${kebabCase}');
    fireEvent.click(element!);
    
    expect(onInteraction).toHaveBeenCalledWith('click', {
      componentId: '${kebabCase}-1'
    });
  });

  it('calls onLoad callback', () => {
    const onLoad = jest.fn();
    render(<${pascalCase} {...defaultProps} onLoad={onLoad} />);
    expect(onLoad).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <${pascalCase} {...defaultProps} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('applies accessibility attributes', () => {
    const { container } = render(
      <${pascalCase}
        {...defaultProps}
        aiMetadata={{
          keywords: [],
          patterns: [],
          commonNames: [],
          pageLocation: [],
          confidence: 0.9,
          accessibility: {
            role: 'region',
            ariaLabel: 'Test region',
            ariaDescribedBy: 'description-id'
          }
        }}
      />
    );
    
    const element = container.querySelector('.cms-${kebabCase}');
    expect(element).toHaveAttribute('role', 'region');
    expect(element).toHaveAttribute('aria-label', 'Test region');
    expect(element).toHaveAttribute('aria-describedby', 'description-id');
  });
});
`;

// Component definition file template (new .def.ts format)
const defTemplate = `import { z } from 'zod';
import { defineComponent } from '@/lib/studio/components/cms/_core/component-definition';
import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';

export const ${pascalCase}Def = defineComponent({
  type: ComponentType.${componentType},
  category: ComponentCategory.${pascalCase.replace(/([A-Z])/g, ' $1').trim().split(' ').join('')},

  schema: z.object({
    heading: z.string().optional(),
    subheading: z.string().optional(),
    body: z.string().optional(),
    // TODO: Define component-specific props schema
  }),

  detection: {
    aliases: ['${kebabCase}', '${componentName.toLowerCase()}'],
    keywords: ['${kebabCase}', '${componentName.toLowerCase()}'],
    confidence: 0.8
  },

  directives: [
    // TODO: Add LLM extraction directives
    // Example: 'Extract the main heading from the component'
  ],

  sample: {
    heading: 'Sample ${pascalCase} Heading',
    subheading: 'Sample subheading text',
    body: 'Sample body content',
    // TODO: Add realistic sample data
  }
});
`;

// AI metadata file template (kept for compatibility)
const aiTemplate = `import { AIComponentMetadata, ComponentType } from '../../_core/types';

export const ${camelCase}AIMetadata: AIComponentMetadata = {
  keywords: [
    '${kebabCase}',
    '${componentName.toLowerCase()}',
    // Add relevant keywords
  ],
  patterns: [
    // Add common text patterns that identify this component
  ],
  commonNames: [
    '${componentName}',
    // Add alternative names
  ],
  pageLocation: ['main'], // Update based on typical placement
  confidence: 0.85,
  suggestedVariants: ['default', 'minimal', 'detailed'],
  relatedComponents: [
    // Add related ComponentType values
  ],
  industry: [
    // Add relevant industries if applicable
  ],
  semanticRole: '${category}',
  accessibility: {
    role: 'region',
    ariaLabel: '${pascalCase} Component',
  }
};
`;

// Storybook story template
const storyTemplate = `import type { Meta, StoryObj } from '@storybook/react';
import { ${pascalCase} } from '.';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/${category.charAt(0).toUpperCase() + category.slice(1)}/${pascalCase}',
  component: ${pascalCase},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '${pascalCase} component for ${category} section.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    id: {
      control: 'text',
      description: 'Unique identifier for the component',
    },
    content: {
      control: 'object',
      description: 'Component content configuration',
    },
    theme: {
      control: 'select',
      options: ['light', 'dark', 'auto', 'inverted'],
      description: 'Component theme',
    },
    variant: {
      control: 'select',
      options: ['default', 'minimal', 'detailed', 'compact', 'expanded'],
      description: 'Component variant',
    },
  },
  args: {
    id: '${kebabCase}-1',
    type: ComponentType.${componentType},
    category: ComponentCategory.${pascalCase.replace(/([A-Z])/g, ' $1').trim().split(' ').join('')},
  },
} satisfies Meta<typeof ${pascalCase}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: {
      heading: 'Default ${pascalCase}',
      subheading: 'This is the default variant',
      body: 'Component content goes here.',
    },
  },
};

export const Minimal: Story = {
  args: {
    variant: 'minimal',
    content: {
      heading: 'Minimal ${pascalCase}',
    },
  },
};

export const Detailed: Story = {
  args: {
    variant: 'detailed',
    content: {
      heading: 'Detailed ${pascalCase}',
      subheading: 'With additional information',
      body: 'This variant includes more comprehensive content and details.',
    },
  },
};

export const DarkTheme: Story = {
  args: {
    theme: 'dark',
    content: {
      heading: 'Dark Theme ${pascalCase}',
      subheading: 'Component with dark theme',
    },
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

export const Interactive: Story = {
  args: {
    interactive: true,
    content: {
      heading: 'Interactive ${pascalCase}',
      subheading: 'Click for interactions',
    },
  },
};
`;

// Index file template
const indexTemplate = `export { ${pascalCase} } from './${kebabCase}';
export type { ${pascalCase}Props, ${pascalCase}Content } from './${kebabCase}.types';
export { ${camelCase}AIMetadata } from './${kebabCase}.ai';
`;

// ============================================================================
// Write Files
// ============================================================================

const files = [
  { name: `${kebabCase}.tsx`, content: componentTemplate },
  { name: `${kebabCase}.def.ts`, content: defTemplate },
  { name: `${kebabCase}.types.ts`, content: typesTemplate },
  { name: `${kebabCase}.test.tsx`, content: testTemplate },
  { name: `${kebabCase}.ai.ts`, content: aiTemplate },
  { name: `${kebabCase}.stories.tsx`, content: storyTemplate },
  { name: 'index.tsx', content: indexTemplate },
];

files.forEach(({ name, content }) => {
  const filePath = path.join(componentDir, name);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Created: ${name}`);
});

// ============================================================================
// Update Component Registry (optional)
// ============================================================================

console.log(`
✨ Component "${pascalCase}" created successfully!

Next steps:
1. Update the component implementation in ${kebabCase}.tsx
2. Configure component definition in ${kebabCase}.def.ts (schema, detection, directives, sample)
3. Add specific content fields in ${kebabCase}.types.ts
4. Update AI metadata in ${kebabCase}.ai.ts
5. Write comprehensive tests in ${kebabCase}.test.tsx
6. Create Storybook stories in ${kebabCase}.stories.tsx

To register the component, add it to the factory in:
lib/studio/components/cms/_factory/factory.ts

Run tests: npm run cms:test
Run Storybook: npm run cms:storybook
`);
