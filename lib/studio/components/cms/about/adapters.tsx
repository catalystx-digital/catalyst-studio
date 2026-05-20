/**
 * Adapter components that wrap about components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 */

import React from 'react';
import { ComponentType } from '../_core/types';
import type { CMSComponentProps } from '../_core/types';
import TeamGrid from './team-grid';
import TeamMember from './team-member';
import AboutSection from './about-section';
import type { TeamGridProps, TeamGridContent } from './team-grid/team-grid.types';
import type { TeamMemberProps, TeamMemberContent } from './team-member/team-member.types';
import type { AboutSectionProps, AboutSectionContent } from './about-section/about-section.types';
import { resolveTeamGridContent } from './utils/team-resolver';

/**
 * TeamGrid Adapter Component
 */
export const TeamGridAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = resolveTeamGridContent(props.content as TeamGridContent);
  
  const adaptedProps: TeamGridProps = {
    id: props.id,
    type: ComponentType.TeamGrid,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  };
  
  return <TeamGrid {...adaptedProps} />;
};

/**
 * TeamMember Adapter Component
 */
export const TeamMemberAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = props.content as TeamMemberContent;
  
  const adaptedProps: TeamMemberProps = {
    id: props.id,
    type: ComponentType.TeamMember,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  };
  
  return <TeamMember {...adaptedProps} />;
};

/**
 * AboutSection Adapter Component
 */
export const AboutSectionAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = props.content as AboutSectionContent;
  
  const adaptedProps: AboutSectionProps = {
    id: props.id,
    type: ComponentType.AboutSection,
    category: props.category,
    content: content,
    className: props.className,
    style: props.style,
    theme: props.theme || 'auto',
    loading: props.loading || 'eager',
    priority: props.priority,
    interactive: props.interactive,
    aiMetadata: props.aiMetadata,
    analytics: props.analytics,
    onLoad: props.onLoad,
    onError: props.onError,
    onInteraction: props.onInteraction
  };
  
  return <AboutSection {...adaptedProps} />;
};
