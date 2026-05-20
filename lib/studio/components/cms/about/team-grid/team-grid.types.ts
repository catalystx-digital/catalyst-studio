import { CMSComponentProps } from '../../_core/types';
import { RichText } from '../../_core/rich-text';
import { type TeamMember } from '@/lib/studio/components/cms/_core/value-objects';

// Using TeamMember from value-objects registry
export type TeamMemberData = TeamMember & {
  // Extensions specific to team-grid
  photo: string; // Required in grid context
  bio?: RichText;
  facebook?: string;
  instagram?: string;
  github?: string;
}

export interface TeamAutoFillConfig {
  enabled?: boolean;
  /** Desired number of members to render when auto filling. */
  desiredCount?: number;
  department?: string;
  role?: string;
  location?: string;
}

export interface TeamGridContent {
  heading?: string;
  subheading?: string;
  members?: TeamMemberData[];
  manualMembers?: TeamMemberData[];
  columns?: {
    mobile?: 1 | 2;
    tablet?: 2 | 3;
    desktop?: 3 | 4 | 5;
    large?: 4 | 5 | 6;
  };
  showDepartment?: boolean;
  enableHover?: boolean;
  linkToProfile?: boolean;
  autoFill?: TeamAutoFillConfig;
}

export interface TeamGridProps extends CMSComponentProps {
  content: TeamGridContent;
}
