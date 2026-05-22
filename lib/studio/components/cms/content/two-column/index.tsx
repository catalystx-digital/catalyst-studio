import type React from 'react';
import { TwoColumnServer } from './two-column.server';
import type { TwoColumnProps } from './two-column.types';

const TwoColumn = TwoColumnServer;

export default TwoColumn as unknown as React.ComponentType<TwoColumnProps>;
export { TwoColumn };
