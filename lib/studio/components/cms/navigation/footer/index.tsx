import React from 'react';

import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { FooterServer } from './footer.server';
import type { FooterProps } from './footer.types';

function FooterComponent(props: FooterProps) {
  return <FooterServer {...props} />;
}

export const Footer = withPerformanceTracking(FooterComponent, ComponentType.Footer);
export default Footer;
