import { CMSComponentProps } from '../../_core/types';
import { type MenuItem, type SocialLink } from '@/lib/studio/components/cms/_core/value-objects';

export interface FooterColumn {
  title?: string;
  links: MenuItem[];
}

// FooterSocialLink now uses SocialLink from registry
export type FooterSocialLink = SocialLink

export interface FooterContent {
  columns?: FooterColumn[];
  logo?: string;
  logoAlt?: string;
  /** Site/organization name used in copyright if not provided explicitly */
  siteName?: string;
  description?: string;
  socialLinks?: FooterSocialLink[];
  copyright?: string;
  legalLinks?: MenuItem[];
  newsletter?: {
    heading: string;
    description?: string;
    placeholder?: string;
    buttonText?: string;
  };
  backgroundColor?: string;
  textColor?: string;
}

export interface FooterProps extends CMSComponentProps {
  content: FooterContent;
}
