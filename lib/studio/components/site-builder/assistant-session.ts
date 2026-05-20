export const BUILDER_ASSISTANT_PANEL_ID = 'studio-site-builder-assistant';

export function getBuilderAssistantSessionId(websiteId: string): string {
  return `${BUILDER_ASSISTANT_PANEL_ID}-${websiteId}`;
}
