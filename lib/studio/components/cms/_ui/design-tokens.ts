export const spacingTokens = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
export type DesignSpacingScale = (typeof spacingTokens)[number];

const createSpacingUtility = (prefix: string) => (size: DesignSpacingScale): string => `${prefix}-${size}`;

export const dsSpacing = {
  gap: createSpacingUtility('ds-gap'),
  spacing: createSpacingUtility('ds-spacing'),
  spaceX: createSpacingUtility('ds-space-x'),
  spaceY: createSpacingUtility('ds-space-y'),
  padding: createSpacingUtility('ds-p'),
  px: createSpacingUtility('ds-px'),
  py: createSpacingUtility('ds-py'),
  pt: createSpacingUtility('ds-pt'),
  pr: createSpacingUtility('ds-pr'),
  pb: createSpacingUtility('ds-pb'),
  pl: createSpacingUtility('ds-pl'),
  margin: createSpacingUtility('ds-m'),
  mx: createSpacingUtility('ds-mx'),
  my: createSpacingUtility('ds-my'),
  mt: createSpacingUtility('ds-mt'),
  mr: createSpacingUtility('ds-mr'),
  mb: createSpacingUtility('ds-mb'),
  ml: createSpacingUtility('ds-ml'),
};

export const typographyScale = {
  heading(level: 1 | 2 | 3 | 4 | 5 | 6): string {
    return `ds-heading-${level}`;
  },
  body(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): string {
    return `ds-body-${size}`;
  },
};
