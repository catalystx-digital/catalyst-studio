import { ContentResource, getContentProvider, TeamMemberFilters, TeamMemberProvider, ContentQuery } from '../../_core/data-providers';
import type { TeamGridContent, TeamMemberData } from '../team-grid/team-grid.types';

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function dedupeMembers(members: TeamMemberData[]): TeamMemberData[] {
  const seen = new Set<string>();
  const result: TeamMemberData[] = [];

  for (const member of members) {
    const id = normalizeOptionalString(member.id);
    if (!id) {
      result.push(member);
      continue;
    }

    if (!seen.has(id)) {
      seen.add(id);
      result.push(member);
    }
  }

  return result;
}

function collectManualMembers(content: TeamGridContent): TeamMemberData[] {
  return dedupeMembers([
    ...(content.manualMembers ?? []),
    ...(content.members ?? [])
  ]);
}

function desiredMemberCount(content: TeamGridContent, manualCount: number): number {
  const config = content.autoFill;
  if (config?.desiredCount && config.desiredCount > 0) {
    return config.desiredCount;
  }

  if (manualCount > 0) {
    return manualCount;
  }

  return 6;
}

export function resolveTeamGridContent(content: TeamGridContent): TeamGridContent {
  const manualMembers = collectManualMembers(content);
  const provider = getContentProvider<TeamMemberData, TeamMemberFilters>(ContentResource.TeamMembers) as TeamMemberProvider | undefined;
  const desiredCount = desiredMemberCount(content, manualMembers.length);

  let members = [...manualMembers];

  if (provider && (content.autoFill?.enabled ?? true)) {
    const remaining = desiredCount - members.length;
    if (remaining > 0) {
      const query: ContentQuery<TeamMemberFilters> = {
        limit: remaining,
        filters: {
          department: normalizeOptionalString(content.autoFill?.department),
          role: normalizeOptionalString(content.autoFill?.role),
          location: normalizeOptionalString(content.autoFill?.location),
          excludeIds: members
            .map(member => normalizeOptionalString(member.id))
            .filter((id): id is string => Boolean(id))
        }
      };

      const { items } = provider.fetch(query);

      members = dedupeMembers([...members, ...items]);
    }
  }

  return {
    ...content,
    manualMembers,
    members
  };
}
