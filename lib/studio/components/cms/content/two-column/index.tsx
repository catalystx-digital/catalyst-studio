import React from 'react';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { TwoColumnServer } from './two-column.server';
import { TwoColumnClient } from './two-column.client';
import { TwoColumnProps } from './two-column.types';

const TwoColumn: React.FC<TwoColumnProps> = React.memo((props) => {
  return (
    <>
      <TwoColumnServer {...props} />
      <TwoColumnClient {...props} />
    </>
  );
});

TwoColumn.displayName = 'TwoColumn';

export default withPerformanceTracking(TwoColumn, ComponentType.TwoColumn);
export { TwoColumn };