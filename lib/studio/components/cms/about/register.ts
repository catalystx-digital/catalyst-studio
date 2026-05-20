/**
 * Component registration for About category components
 * Story 10.11: About & Team Components
 */

import { ComponentType, ComponentCategory } from '../_core/types';
import { cmsComponentFactory } from '../_factory/factory';
import { detectionToAIMetadata } from '../_core/component-definition';
import { TeamGridAdapter, TeamMemberAdapter, AboutSectionAdapter } from './adapters';
import { TeamGridDef } from './team-grid/team-grid.def';
import { TeamMemberDef } from './team-member/team-member.def';
import { AboutSectionDef } from './about-section/about-section.def';

// Register TeamGrid component
cmsComponentFactory.register({
  type: ComponentType.TeamGrid,
  category: ComponentCategory.About,
  component: TeamGridAdapter,
  metadata: {
    name: 'Team Grid',
    description: TeamGridDef.description || 'Team grid component',
    version: '1.0.0',
    author: 'Story 10.11',
    tags: ['team', 'staff', 'grid', 'about'],
    aiMetadata: detectionToAIMetadata(TeamGridDef.detection!, ComponentType.TeamGrid)
  },
  schema: TeamGridDef.schema
});

// Register TeamMember component
cmsComponentFactory.register({
  type: ComponentType.TeamMember,
  category: ComponentCategory.About,
  component: TeamMemberAdapter,
  metadata: {
    name: 'Team Member',
    description: TeamMemberDef.description || 'Team member component',
    version: '1.0.0',
    author: 'Story 10.11',
    tags: ['profile', 'bio', 'member', 'about'],
    aiMetadata: detectionToAIMetadata(TeamMemberDef.detection!, ComponentType.TeamMember)
  },
  schema: TeamMemberDef.schema,
  subOnly: true
});

// Register AboutSection component
cmsComponentFactory.register({
  type: ComponentType.AboutSection,
  category: ComponentCategory.About,
  component: AboutSectionAdapter,
  metadata: {
    name: 'About Section',
    description: AboutSectionDef.description || 'About section component',
    version: '1.0.0',
    author: 'Story 10.11',
    tags: ['about', 'mission', 'vision', 'story', 'values'],
    aiMetadata: detectionToAIMetadata(AboutSectionDef.detection!, ComponentType.AboutSection)
  },
  schema: AboutSectionDef.schema
});

// Export for testing and external use
export {
  TeamGridAdapter,
  TeamMemberAdapter,
  AboutSectionAdapter
};
