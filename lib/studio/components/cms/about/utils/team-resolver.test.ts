import { resolveTeamGridContent } from './team-resolver';
import type { TeamGridContent } from '../team-grid/team-grid.types';
import { resetContentProviders, registerContentProvider, ContentResource } from '../../_core/data-providers';
import { mockTeamContentProvider } from '../../_core/providers/mock';

describe('resolveTeamGridContent', () => {
  beforeEach(() => {
    resetContentProviders();
  });

  it('does not inject provider data when no team provider is registered', () => {
    const content: TeamGridContent = {
      autoFill: {
        enabled: true,
        desiredCount: 4
      }
    };

    const resolved = resolveTeamGridContent(content);

    expect(resolved.members).toEqual([]);
    expect(resolved.manualMembers).toEqual([]);
  });

  it('auto-fills team members when autoFill config exists and enabled is not false', () => {
    registerContentProvider(ContentResource.TeamMembers, mockTeamContentProvider);

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

    expect(resolved.members).toHaveLength(4);
    expect(resolved.members?.[0]?.id).toBe('manual-team-member');
    const autoIds = resolved.members?.slice(1).map(member => member.id) ?? [];
    expect(autoIds).toEqual(expect.arrayContaining(['mock-team-1', 'mock-team-2', 'mock-team-3']));
  });

  it('auto-fills team members to the desired count when enabled', () => {
    registerContentProvider(ContentResource.TeamMembers, mockTeamContentProvider);

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
        enabled: true,
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

  it('does not auto-fill team members when autoFill is disabled', () => {
    registerContentProvider(ContentResource.TeamMembers, mockTeamContentProvider);

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
        enabled: false,
        desiredCount: 4
      }
    };

    const resolved = resolveTeamGridContent(content);

    expect(resolved.members).toEqual([
      expect.objectContaining({ id: 'manual-team-member' })
    ]);
  });

  it('surfaces registered team provider errors', () => {
    registerContentProvider(ContentResource.TeamMembers, {
      fetch: () => {
        throw new Error('team provider failed');
      }
    });

    const content: TeamGridContent = {
      autoFill: {
        enabled: true,
        desiredCount: 2
      }
    };

    expect(() => resolveTeamGridContent(content)).toThrow('team provider failed');
  });
});
