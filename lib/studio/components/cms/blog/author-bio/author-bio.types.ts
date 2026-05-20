/**
 * Type definitions for AuthorBio component
 * Story 10.12: Blog Components
 */

import { ComponentType, ComponentCategory, CMSComponentProps, ComponentContent } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Link } from '../../_core/value-objects';

export interface AuthorBioContent extends ComponentContent {
  name: string;
  title?: string;
  bio: RichText;
  photo?: string;
  email?: string;
  website?: Link | string;
  socialLinks?: {
    twitter?: Link | string;
    linkedin?: Link | string;
    github?: Link | string;
    facebook?: Link | string;
    instagram?: Link | string;
    youtube?: Link | string;
  };
  stats?: {
    articlesCount?: number;
    followersCount?: number;
    yearsExperience?: number;
  };
  expertise?: string[];
  expandable?: boolean;
  maxBioLength?: number;
}

export interface AuthorBioProps extends CMSComponentProps {
  type: ComponentType.AuthorBio;
  category: ComponentCategory.Blog;
  content: AuthorBioContent;
  onFollowClick?: () => void;
  onSocialClick?: (platform: string, url: string) => void;
  showStats?: boolean;
  showExpertise?: boolean;
  layout?: 'horizontal' | 'vertical' | 'compact';
}