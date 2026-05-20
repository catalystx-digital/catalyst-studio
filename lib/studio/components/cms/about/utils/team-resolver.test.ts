import { resolveTeamGridContent } from './team-resolver';
import type { TeamGridContent } from '../team-grid/team-grid.types';
import { resetContentProviders, registerContentProvider, ContentResource } from '../../_core/data-providers';
import { mockTeamContentProvider } from '../../_core/providers/mock';

describe('resolveTeamGridContent', () => {
  beforeEach(() => {
    resetContentProviders();
    registerContentProvider(ContentResource.TeamMembers, mockTeamContentProvider);
  });

  it('auto-fills team members to the desired count', () => {
    const content: TeamGridContent = {
      manualMembers: [
        {
          id: 'manual-team-member',
          name: 'Spotlight Member',
          title: 'Head of Culture',
          photo: '/team/spotlight.jpg',
          bio: 'Pinned by the editor for visibility.'
        }
      ],
      autoFill: {
        desiredCount: 4
      }
    };

    const resolved = resolveTeamGridContent(content);

    expect(resolved.members?.length).toBeGreaterThanOrEqual(3);
    expect(resolved.members?.[0]?.id).toBe('manual-team-member');
    const autoIds = resolved.members?.slice(1).map(member => member.id) ?? [];
    expect(autoIds.length).toBeGreaterThan(0);
    expect(autoIds).toEqual(expect.arrayContaining(['mock-team-1', 'mock-team-2', 'mock-team-3']));
  });
});
