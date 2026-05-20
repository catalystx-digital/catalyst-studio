import { CMSComponentProps } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface TeamMemberContent {
  name: string;
  title: string;
  department?: string;
  photo?: Image | string; // Support both Image object and legacy string URL
  bio: RichText;
  email?: string;
  phone?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  github?: string;
  skills?: string[];
  education?: Array<{
    degree: string;
    institution: string;
    year?: string;
  }>;
  experience?: Array<{
    position: string;
    company: string;
    duration?: string;
    description?: string;
  }>;
  achievements?: string[];
  displayMode?: 'full' | 'compact' | 'modal';
}

export interface TeamMemberProps extends CMSComponentProps {
  content: TeamMemberContent;
}
