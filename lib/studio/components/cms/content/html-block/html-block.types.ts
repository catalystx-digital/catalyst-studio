import { CMSComponentProps, ComponentContent } from '../../_core/types';
import { RichText } from '../../_core/rich-text';

/**
 * HTML Block content interface.
 * A WYSIWYG container for rich HTML content - documentation pages, resource pages, etc.
 * Unlike blog-post, this has no author/date metadata.
 * Unlike text-block, this is for full-page content, not short snippets.
 */
export interface HtmlBlockContent extends ComponentContent {
  /** Optional title/heading for the content */
  title?: string;
  /** The full HTML content body */
  bodyHtml: RichText;
  /** Original source URL (for imports) */
  sourceUrl?: string;
}

export interface HtmlBlockProps extends Omit<CMSComponentProps, 'content'> {
  content: HtmlBlockContent;
  analyticsId?: string;
}

export type HtmlBlockClientProps = Pick<HtmlBlockProps, 'id' | 'onInteraction'>;
