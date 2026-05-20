import { CMSComponentProps, ComponentContent } from '../../_core/types';
import { RichText } from '../../_core/rich-text';

// Text Block specific content interface
export interface TextBlockContent extends ComponentContent {
  heading?: string;
  subheading?: string;
  body: RichText; // Rich text content (HTML)
  alignment?: 'left' | 'center' | 'right' | 'justify';
  columns?: 1 | 2 | 3;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

// Text Block specific props
export interface TextBlockProps extends Omit<CMSComponentProps, 'content'> {
  content: TextBlockContent;
  analyticsId?: string;
}

export type TextBlockClientProps = Pick<TextBlockProps, 'id' | 'onInteraction'>;
